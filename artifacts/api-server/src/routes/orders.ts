import { Router, type IRouter } from "express";
import { db, ordersTable, orderLinesTable, clientsTable, salespeopleTable, saleConditionsTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";

const router: IRouter = Router();

async function recalcOrder(orderId: number) {
  const lines = await db.select().from(orderLinesTable).where(eq(orderLinesTable.orderId, orderId));
  let net = 0, kg = 0;
  for (const l of lines) {
    const q = Number(l.quantity) || 0;
    const p = Number(l.unitPrice) || 0;
    const lineNet = +(q * p).toFixed(2);
    net += lineNet;
    kg += Number(l.quantityKg || 0);
    await db.update(orderLinesTable).set({ netTotal: String(lineNet) }).where(eq(orderLinesTable.id, l.id));
  }
  const avg = kg > 0 ? net / kg : 0;
  await db.update(ordersTable).set({
    netAmount: String(net.toFixed(2)),
    total: String(net.toFixed(2)),
    totalKg: String(kg.toFixed(4)),
    avgPricePerKg: String(avg.toFixed(4)),
  }).where(eq(ordersTable.id, orderId));
}

router.get("/orders", async (req, res) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit as string) || 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string | undefined;

    const where = status ? eq(ordersTable.status, status as any) : undefined;

    const [data, [{ count }]] = await Promise.all([
      db.select({
        o: ordersTable,
        clientName: clientsTable.companyName,
        salespersonName: salespeopleTable.name,
      }).from(ordersTable)
        .leftJoin(clientsTable, eq(ordersTable.clientId, clientsTable.id))
        .leftJoin(salespeopleTable, eq(ordersTable.salespersonId, salespeopleTable.id))
        .where(where as any)
        .orderBy(desc(ordersTable.date)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(where as any),
    ]);

    res.json({
      data: data.map(r => ({ ...r.o, clientName: r.clientName, salespersonName: r.salespersonName })),
      total: Number(count),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/orders/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!order) { res.status(404).json({ error: "No encontrado" }); return; }
    const lines = await db.select().from(orderLinesTable).where(eq(orderLinesTable.orderId, id)).orderBy(orderLinesTable.lineNumber);
    res.json({ ...order, lines });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/orders", async (req, res) => {
  try {
    const { lines, ...rest } = req.body;
    const userId = (req as any).session?.userId;
    const data: any = { ...rest, createdBy: userId };
    for (const k of ["date", "deliveryDate"]) {
      if (data[k] && typeof data[k] === "string") data[k] = new Date(data[k]);
    }
    const [order] = await db.insert(ordersTable).values(data).returning();
    const number = `PED-${String(order.id).padStart(5, "0")}`;
    await db.update(ordersTable).set({ number }).where(eq(ordersTable.id, order.id));
    if (Array.isArray(lines) && lines.length) {
      await db.insert(orderLinesTable).values(lines.map((l: any, idx: number) => ({
        ...l, orderId: order.id, lineNumber: l.lineNumber ?? idx + 1,
      })));
      await recalcOrder(order.id);
    }
    const [final] = await db.select().from(ordersTable).where(eq(ordersTable.id, order.id));
    res.status(201).json(final);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/orders/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { lines, ...rest } = req.body;
    const data: any = { ...rest };
    for (const k of ["date", "deliveryDate"]) {
      if (data[k] && typeof data[k] === "string") data[k] = new Date(data[k]);
    }
    if (Object.keys(data).length) {
      await db.update(ordersTable).set(data).where(eq(ordersTable.id, id));
    }
    if (Array.isArray(lines)) {
      await db.delete(orderLinesTable).where(eq(orderLinesTable.orderId, id));
      if (lines.length) {
        await db.insert(orderLinesTable).values(lines.map((l: any, idx: number) => ({
          ...l, orderId: id, lineNumber: l.lineNumber ?? idx + 1,
        })));
      }
      await recalcOrder(id);
    }
    const [row] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/orders/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(orderLinesTable).where(eq(orderLinesTable.orderId, id));
    await db.delete(ordersTable).where(eq(ordersTable.id, id));
    res.json({ message: "Eliminado" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/sale-conditions", async (_req, res) => {
  try {
    const data = await db.select().from(saleConditionsTable).where(eq(saleConditionsTable.isActive, true)).orderBy(saleConditionsTable.daysToPay);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/sale-conditions", async (req, res) => {
  try {
    const [row] = await db.insert(saleConditionsTable).values(req.body).returning();
    res.status(201).json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
