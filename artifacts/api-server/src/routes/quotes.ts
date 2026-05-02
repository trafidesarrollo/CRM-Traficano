import { Router, type IRouter } from "express";
import { db, quotesTable, quoteLinesTable, ordersTable, orderLinesTable, clientsTable, salespeopleTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";

const router: IRouter = Router();

async function recalcTotals(quoteId: number, tx: any = db) {
  const lines = await tx.select().from(quoteLinesTable).where(eq(quoteLinesTable.quoteId, quoteId));
  let net = 0, kg = 0;
  for (const l of lines) {
    const q = Number(l.quantity) || 0;
    const p = Number(l.unitPrice) || 0;
    const lineNet = +(q * p).toFixed(2);
    net += lineNet;
    kg += Number(l.quantityKg || 0);
    await tx.update(quoteLinesTable).set({ netTotal: String(lineNet) }).where(eq(quoteLinesTable.id, l.id));
  }
  const avg = kg > 0 ? net / kg : 0;
  await tx.update(quotesTable).set({
    netAmount: String(net.toFixed(2)),
    total: String(net.toFixed(2)),
    totalKg: String(kg.toFixed(4)),
    avgPricePerKg: String(avg.toFixed(4)),
  }).where(eq(quotesTable.id, quoteId));
}

router.get("/quotes", async (req, res) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit as string) || 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string | undefined;
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;

    const conds: any[] = [];
    if (status) conds.push(eq(quotesTable.status, status as any));
    if (clientId) conds.push(eq(quotesTable.clientId, clientId));

    const where = conds.length ? and(...conds) : undefined;

    const [data, [{ count }]] = await Promise.all([
      db.select({
        q: quotesTable,
        clientName: clientsTable.companyName,
        salespersonName: salespeopleTable.name,
      }).from(quotesTable)
        .leftJoin(clientsTable, eq(quotesTable.clientId, clientsTable.id))
        .leftJoin(salespeopleTable, eq(quotesTable.salespersonId, salespeopleTable.id))
        .where(where as any)
        .orderBy(desc(quotesTable.date))
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(quotesTable).where(where as any),
    ]);

    res.json({
      data: data.map(r => ({ ...r.q, clientName: r.clientName, salespersonName: r.salespersonName })),
      total: Number(count),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/quotes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote) { res.status(404).json({ error: "No encontrada" }); return; }
    const lines = await db.select().from(quoteLinesTable).where(eq(quoteLinesTable.quoteId, id)).orderBy(quoteLinesTable.lineNumber);
    res.json({ ...quote, lines });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/quotes", async (req, res) => {
  try {
    const { lines, ...rest } = req.body;
    const userId = (req as any).session?.userId;
    const data: any = { ...rest, createdBy: userId };
    if (data.date && typeof data.date === "string") data.date = new Date(data.date);
    if (data.deliveryDate && typeof data.deliveryDate === "string") data.deliveryDate = new Date(data.deliveryDate);
    if (data.dueDate && typeof data.dueDate === "string") data.dueDate = new Date(data.dueDate);
    if (data.followupDate && typeof data.followupDate === "string") data.followupDate = new Date(data.followupDate);

    const [quote] = await db.insert(quotesTable).values(data).returning();
    const number = `COT-${String(quote.id).padStart(5, "0")}`;
    await db.update(quotesTable).set({ number }).where(eq(quotesTable.id, quote.id));

    if (Array.isArray(lines) && lines.length) {
      await db.insert(quoteLinesTable).values(lines.map((l: any, idx: number) => ({
        ...l,
        quoteId: quote.id,
        lineNumber: l.lineNumber ?? idx + 1,
      })));
      await recalcTotals(quote.id);
    }

    const [final] = await db.select().from(quotesTable).where(eq(quotesTable.id, quote.id));
    res.status(201).json(final);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/quotes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { lines, ...rest } = req.body;
    const data: any = { ...rest };
    for (const k of ["date", "deliveryDate", "dueDate", "followupDate", "sentAt", "approvedAt"]) {
      if (data[k] && typeof data[k] === "string") data[k] = new Date(data[k]);
    }
    if (Object.keys(data).length) {
      await db.update(quotesTable).set(data).where(eq(quotesTable.id, id));
    }
    if (Array.isArray(lines)) {
      await db.delete(quoteLinesTable).where(eq(quoteLinesTable.quoteId, id));
      if (lines.length) {
        await db.insert(quoteLinesTable).values(lines.map((l: any, idx: number) => ({
          ...l, quoteId: id, lineNumber: l.lineNumber ?? idx + 1,
        })));
      }
      await recalcTotals(id);
    }
    const [row] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/quotes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(quoteLinesTable).where(eq(quoteLinesTable.quoteId, id));
    await db.delete(quotesTable).where(eq(quotesTable.id, id));
    res.json({ message: "Eliminada" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/quotes/:id/convert-to-order", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).session?.userId;
    const result = await db.transaction(async (tx) => {
      const [quote] = await tx.select().from(quotesTable).where(eq(quotesTable.id, id));
      if (!quote) throw new Error("NOT_FOUND");
      const lines = await tx.select().from(quoteLinesTable).where(eq(quoteLinesTable.quoteId, id));

      const [order] = await tx.insert(ordersTable).values({
        quoteId: id, clientId: quote.clientId, contactId: quote.contactId,
        salespersonId: quote.salespersonId, priceListId: quote.priceListId,
        saleConditionId: quote.saleConditionId, cuit: quote.cuit, currency: quote.currency,
        exchangeRate: quote.exchangeRate, exchangeRateType: quote.exchangeRateType,
        netAmount: quote.netAmount, total: quote.total, totalKg: quote.totalKg,
        avgPricePerKg: quote.avgPricePerKg, orderType: quote.orderType,
        description: quote.description, internalNote: quote.internalNote,
        purchaseOrder: quote.purchaseOrder, createdBy: userId,
      }).returning();

      const number = `PED-${String(order.id).padStart(5, "0")}`;
      await tx.update(ordersTable).set({ number }).where(eq(ordersTable.id, order.id));

      if (lines.length) {
        await tx.insert(orderLinesTable).values(lines.map(l => ({
          orderId: order.id, quoteLineId: l.id, lineNumber: l.lineNumber,
          productType: l.productType, productId: l.productId, productName: l.productName,
          productCode: l.productCode, description: l.description, unit: l.unit,
          quantity: l.quantity, quantityKg: l.quantityKg, unitPrice: l.unitPrice,
          unitPriceUm: l.unitPriceUm, netTotal: l.netTotal,
          deliveryTime: l.deliveryTime, clientCode: l.clientCode, notes: l.notes,
        })));
      }
      await tx.update(quotesTable).set({ status: "approved", approvedAt: new Date() }).where(eq(quotesTable.id, id));
      return { orderId: order.id, orderNumber: number };
    });
    res.json(result);
  } catch (err: any) {
    if (err.message === "NOT_FOUND") { res.status(404).json({ error: "Cotización no encontrada" }); return; }
    res.status(500).json({ error: err.message });
  }
});

export default router;
