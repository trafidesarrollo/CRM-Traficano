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

// Quote followups — shows active quotes needing attention.
// Uses followupDate when set; falls back to showing all sent/partial/draft quotes.
// Date filters apply to followupDate (if set) OR dueDate as fallback.
router.get("/quotes/followups", async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from as string) : null;
    const to   = req.query.to   ? new Date(req.query.to   as string) : null;
    const salespersonId = req.query.salespersonId ? parseInt(req.query.salespersonId as string) : undefined;

    // Only show quotes that still need follow-up (not finalized)
    const statusCond = sql`${quotesTable.status} in ('draft','sent','partial','expired')`;
    const spCond = salespersonId ? eq(quotesTable.salespersonId, salespersonId) : sql`1=1`;

    let dateCond: any;
    if (from && to) {
      // Filter: followupDate in range, OR (no followupDate AND dueDate in range)
      dateCond = sql`(
        (${quotesTable.followupDate} >= ${from} AND ${quotesTable.followupDate} <= ${to})
        OR
        (${quotesTable.followupDate} IS NULL AND ${quotesTable.dueDate} >= ${from} AND ${quotesTable.dueDate} <= ${to})
      )`;
    } else if (to) {
      // Overdue: followupDate <= to, OR dueDate <= to when no followupDate
      dateCond = sql`(
        (${quotesTable.followupDate} IS NOT NULL AND ${quotesTable.followupDate} <= ${to})
        OR
        (${quotesTable.followupDate} IS NULL AND ${quotesTable.dueDate} <= ${to})
      )`;
    }
    // No date filter → show all active quotes

    const conds: any[] = [statusCond, spCond];
    if (dateCond) conds.push(dateCond);

    const data = await db.select({
      q: quotesTable,
      clientName: clientsTable.companyName,
      salespersonName: salespeopleTable.name,
    }).from(quotesTable)
      .leftJoin(clientsTable, eq(quotesTable.clientId, clientsTable.id))
      .leftJoin(salespeopleTable, eq(quotesTable.salespersonId, salespeopleTable.id))
      .where(and(...conds))
      .orderBy(
        // Sort: explicit followupDate first, then by dueDate
        sql`coalesce(${quotesTable.followupDate}, ${quotesTable.dueDate}) asc nulls last`
      )
      .limit(100);

    res.json(data.map(r => ({ ...r.q, clientName: r.clientName, salespersonName: r.salespersonName })));
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

function parseDateField(val: any): Date | null | undefined {
  if (!val || val === "") return null;
  if (typeof val === "string") return new Date(val);
  return val;
}

router.post("/quotes", async (req, res) => {
  try {
    const { lines, ...rest } = req.body;
    const userId = (req as any).session?.userId;
    const data: any = { ...rest, createdBy: userId };
    data.date = parseDateField(data.date) ?? new Date();
    data.deliveryDate = parseDateField(data.deliveryDate);
    data.dueDate = parseDateField(data.dueDate);
    data.followupDate = parseDateField(data.followupDate);
    data.sentAt = parseDateField(data.sentAt);
    data.approvedAt = parseDateField(data.approvedAt);

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
      data[k] = parseDateField(data[k]);
    }
    if (data.date === null) delete data.date;
    if (Object.keys(data).length) {
      await db.update(quotesTable).set(data).where(eq(quotesTable.id, id));
    }
    if (Array.isArray(lines)) {
      await db.delete(quoteLinesTable).where(eq(quoteLinesTable.quoteId, id));
      if (lines.length) {
        await db.insert(quoteLinesTable).values(lines.map((l: any, idx: number) => {
          const { id: _lineId, ...lineRest } = l;
          return { ...lineRest, quoteId: id, lineNumber: lineRest.lineNumber ?? idx + 1 };
        }));
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
