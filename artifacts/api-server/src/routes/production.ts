import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  productionOrdersTable,
  productionRecordsTable,
  productionLocationsTable,
  productsTable,
  usersTable,
  insertProductionOrderSchema,
  insertProductionRecordSchema,
  insertProductionLocationSchema,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireMinRole } from "../middleware/auth.js";

const router: IRouter = Router();
const requireGerente = requireMinRole("gerente");

// ===== LOCATIONS =====
router.get("/production/locations", async (_req, res) => {
  const rows = await db.select().from(productionLocationsTable).orderBy(productionLocationsTable.name);
  res.json(rows);
});

router.post("/production/locations", async (req: Request, res: Response) => {
  try {
    const parsed = insertProductionLocationSchema.parse(req.body);
    const [row] = await db.insert(productionLocationsTable).values(parsed).returning();
    res.status(201).json(row);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.patch("/production/locations/:id", requireGerente, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const allowed = ["code", "name", "description", "isActive"] as const;
    const updates: any = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    const [row] = await db.update(productionLocationsTable).set(updates).where(eq(productionLocationsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "No encontrado" }); return; }
    res.json(row);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ===== ORDERS =====
router.get("/production/orders", async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
  const conds: any[] = [];
  if (status && status !== "all") conds.push(eq(productionOrdersTable.status, status as any));
  if (locationId) conds.push(eq(productionOrdersTable.locationId, locationId));

  const rows = await db
    .select({
      o: productionOrdersTable,
      locName: productionLocationsTable.name,
      locCode: productionLocationsTable.code,
      productName: productsTable.name,
    })
    .from(productionOrdersTable)
    .leftJoin(productionLocationsTable, eq(productionOrdersTable.locationId, productionLocationsTable.id))
    .leftJoin(productsTable, eq(productionOrdersTable.productId, productsTable.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(productionOrdersTable.createdAt))
    .limit(500);

  res.json(rows.map(r => ({
    ...r.o,
    locationName: r.locName,
    locationCode: r.locCode,
    productNameFromMaster: r.productName,
  })));
});

router.get("/production/orders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [row] = await db
    .select({
      o: productionOrdersTable,
      locName: productionLocationsTable.name,
      productName: productsTable.name,
    })
    .from(productionOrdersTable)
    .leftJoin(productionLocationsTable, eq(productionOrdersTable.locationId, productionLocationsTable.id))
    .leftJoin(productsTable, eq(productionOrdersTable.productId, productsTable.id))
    .where(eq(productionOrdersTable.id, id));
  if (!row) { res.status(404).json({ error: "No encontrado" }); return; }
  res.json({ ...row.o, locationName: row.locName, productNameFromMaster: row.productName });
});

router.post("/production/orders", async (req: Request, res: Response) => {
  try {
    const raw = { ...req.body };
    for (const k of ["plannedStart", "plannedEnd", "startedAt", "completedAt"]) if (typeof raw[k] === "string") raw[k] = new Date(raw[k]);
    const parsed = insertProductionOrderSchema.parse(raw);
    const userId = (req as any).session?.userId;
    const [row] = await db.insert(productionOrdersTable).values({ ...parsed, createdBy: userId }).returning();
    res.status(201).json(row);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.patch("/production/orders/:id", async (req: Request, res: Response) => {
  // Status mutations to completed/cancelled are gerente+ only; vendedor may only edit non-status fields or move pending↔in_progress
  const role = (req as any).userRole;
  const newStatus = req.body?.status;
  if (newStatus && (newStatus === "completed" || newStatus === "cancelled") && role !== "admin" && role !== "gerente") {
    res.status(403).json({ error: "Solo gerente o admin pueden cerrar o cancelar órdenes" });
    return;
  }
  // re-bind role for inner scope
  const userRole = role;
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const [current] = await db.select().from(productionOrdersTable).where(eq(productionOrdersTable.id, id));
    if (!current) { res.status(404).json({ error: "No encontrado" }); return; }
    const allowed = ["number", "productId", "productName", "locationId", "plannedQty", "unit", "priority", "notes", "status", "plannedStart", "plannedEnd"] as const;
    const updates: any = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    for (const k of ["plannedStart", "plannedEnd"]) if (typeof updates[k] === "string") updates[k] = new Date(updates[k]);
    if (updates.status && updates.status !== current.status) {
      const allowedTransitions: Record<string, string[]> = {
        pending: ["in_progress", "cancelled"],
        in_progress: ["completed", "cancelled", "pending"],
        completed: userRole === "admin" || userRole === "gerente" ? ["in_progress"] : [],
        cancelled: userRole === "admin" || userRole === "gerente" ? ["pending"] : [],
      };
      if (!(allowedTransitions[current.status] || []).includes(updates.status)) {
        res.status(403).json({ error: `Transición ${current.status} → ${updates.status} no permitida` }); return;
      }
      if (updates.status === "in_progress" && !current.startedAt) updates.startedAt = new Date();
      if (updates.status === "completed") updates.completedAt = new Date();
      if (updates.status === "pending") { updates.startedAt = null; updates.completedAt = null; }
    }
    const [row] = await db.update(productionOrdersTable).set(updates).where(eq(productionOrdersTable.id, id)).returning();
    res.json(row);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete("/production/orders/:id", requireGerente, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  await db.delete(productionRecordsTable).where(eq(productionRecordsTable.productionOrderId, id));
  await db.delete(productionOrdersTable).where(eq(productionOrdersTable.id, id));
  res.json({ ok: true });
});

// ===== RECORDS =====
router.get("/production/orders/:id/records", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const rows = await db
    .select({
      r: productionRecordsTable,
      operatorUser: usersTable.fullName,
      locName: productionLocationsTable.name,
    })
    .from(productionRecordsTable)
    .leftJoin(usersTable, eq(productionRecordsTable.operatorId, usersTable.id))
    .leftJoin(productionLocationsTable, eq(productionRecordsTable.locationId, productionLocationsTable.id))
    .where(eq(productionRecordsTable.productionOrderId, id))
    .orderBy(desc(productionRecordsTable.createdAt));
  res.json(rows.map(x => ({ ...x.r, operatorDisplay: x.r.operatorName || x.operatorUser, locationName: x.locName })));
});

router.post("/production/orders/:id/records", async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) { res.status(400).json({ error: "ID inválido" }); return; }

    const raw = { ...req.body, productionOrderId: orderId };
    if (typeof raw.startTime === "string") raw.startTime = new Date(raw.startTime);
    if (typeof raw.endTime === "string") raw.endTime = new Date(raw.endTime);
    const parsed = insertProductionRecordSchema.parse(raw);
    let durationMin: any = parsed.durationMin;
    if (parsed.startTime && parsed.endTime && !durationMin) {
      const ms = new Date(parsed.endTime as any).getTime() - new Date(parsed.startTime as any).getTime();
      if (ms > 0) durationMin = (ms / 60000).toFixed(2);
    }

    const result = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(productionOrdersTable).where(eq(productionOrdersTable.id, orderId)).for("update");
      if (!order) throw new Error("__notfound");
      if (order.status === "completed" || order.status === "cancelled") throw new Error("__closed");

      const [rec] = await tx.insert(productionRecordsTable).values({ ...parsed, durationMin }).returning();

      const [agg] = await tx
        .select({
          prod: sql<string>`COALESCE(SUM(${productionRecordsTable.qtyProduced}), 0)`,
          rej: sql<string>`COALESCE(SUM(${productionRecordsTable.qtyRejected}), 0)`,
        })
        .from(productionRecordsTable)
        .where(eq(productionRecordsTable.productionOrderId, orderId));

      const planned = parseFloat(order.plannedQty as any) || 0;
      const produced = parseFloat(agg.prod) || 0;
      const rejected = parseFloat(agg.rej) || 0;
      const updates: any = { producedQty: agg.prod, rejectedQty: agg.rej };
      if (order.status === "pending") {
        updates.status = "in_progress";
        updates.startedAt = order.startedAt || new Date();
      }
      if (planned > 0 && produced + rejected >= planned) {
        updates.status = "completed";
        updates.completedAt = new Date();
      }
      await tx.update(productionOrdersTable).set(updates).where(eq(productionOrdersTable.id, orderId));
      return rec;
    });

    res.status(201).json(result);
  } catch (e: any) {
    if (e.message === "__notfound") { res.status(404).json({ error: "Orden no encontrada" }); return; }
    if (e.message === "__closed") { res.status(400).json({ error: "No se puede registrar en una orden cerrada" }); return; }
    res.status(400).json({ error: e.message });
  }
});

router.delete("/production/records/:id", requireGerente, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  try {
    await db.transaction(async (tx) => {
      const [rec] = await tx.select().from(productionRecordsTable).where(eq(productionRecordsTable.id, id));
      if (!rec) throw new Error("__notfound");
      const [order] = await tx.select().from(productionOrdersTable).where(eq(productionOrdersTable.id, rec.productionOrderId)).for("update");
      await tx.delete(productionRecordsTable).where(eq(productionRecordsTable.id, id));
      const [agg] = await tx
        .select({
          prod: sql<string>`COALESCE(SUM(${productionRecordsTable.qtyProduced}), 0)`,
          rej: sql<string>`COALESCE(SUM(${productionRecordsTable.qtyRejected}), 0)`,
        })
        .from(productionRecordsTable)
        .where(eq(productionRecordsTable.productionOrderId, rec.productionOrderId));
      const planned = parseFloat(order.plannedQty as any) || 0;
      const produced = parseFloat(agg.prod) || 0;
      const rejected = parseFloat(agg.rej) || 0;
      const updates: any = { producedQty: agg.prod, rejectedQty: agg.rej };
      // If order was completed but totals dropped below planned, reopen as in_progress
      if (order.status === "completed" && planned > 0 && produced + rejected < planned) {
        updates.status = "in_progress";
        updates.completedAt = null;
      }
      // If no production left, drop back to pending
      if (produced === 0 && rejected === 0 && order.status === "in_progress") {
        updates.status = "pending";
        updates.startedAt = null;
      }
      await tx.update(productionOrdersTable).set(updates).where(eq(productionOrdersTable.id, rec.productionOrderId));
    });
    res.json({ ok: true });
  } catch (e: any) {
    if (e.message === "__notfound") { res.status(404).json({ error: "No encontrado" }); return; }
    res.status(400).json({ error: e.message });
  }
});

// ===== DASHBOARD KPIs =====
router.get("/production/dashboard", async (_req, res) => {
  const [counts] = await db
    .select({
      pending: sql<number>`COUNT(*) FILTER (WHERE status='pending')`,
      inProgress: sql<number>`COUNT(*) FILTER (WHERE status='in_progress')`,
      completed: sql<number>`COUNT(*) FILTER (WHERE status='completed')`,
      cancelled: sql<number>`COUNT(*) FILTER (WHERE status='cancelled')`,
    })
    .from(productionOrdersTable);

  const [totals] = await db
    .select({
      planned: sql<string>`COALESCE(SUM(planned_qty), 0)`,
      produced: sql<string>`COALESCE(SUM(produced_qty), 0)`,
      rejected: sql<string>`COALESCE(SUM(rejected_qty), 0)`,
    })
    .from(productionOrdersTable)
    .where(sql`status != 'cancelled'`);

  const [recAgg] = await db
    .select({
      totalProd: sql<string>`COALESCE(SUM(qty_produced), 0)`,
      totalMin: sql<string>`COALESCE(SUM(duration_min), 0)`,
    })
    .from(productionRecordsTable);

  const totalProd = parseFloat(recAgg.totalProd) || 0;
  const totalMin = parseFloat(recAgg.totalMin) || 0;
  const unitsPerHour = totalMin > 0 ? (totalProd / (totalMin / 60)) : 0;
  const planned = parseFloat(totals.planned) || 0;
  const produced = parseFloat(totals.produced) || 0;
  const rejected = parseFloat(totals.rejected) || 0;
  const progressPct = planned > 0 ? (produced / planned) * 100 : 0;
  const efficiency = produced + rejected > 0 ? (produced / (produced + rejected)) * 100 : 0;

  // By location
  const byLoc = await db
    .select({
      locId: productionOrdersTable.locationId,
      locName: productionLocationsTable.name,
      planned: sql<string>`COALESCE(SUM(${productionOrdersTable.plannedQty}), 0)`,
      produced: sql<string>`COALESCE(SUM(${productionOrdersTable.producedQty}), 0)`,
      rejected: sql<string>`COALESCE(SUM(${productionOrdersTable.rejectedQty}), 0)`,
      orders: sql<number>`COUNT(*)`,
    })
    .from(productionOrdersTable)
    .leftJoin(productionLocationsTable, eq(productionOrdersTable.locationId, productionLocationsTable.id))
    .where(sql`${productionOrdersTable.status} != 'cancelled'`)
    .groupBy(productionOrdersTable.locationId, productionLocationsTable.name);

  res.json({
    counts: {
      pending: Number(counts.pending),
      inProgress: Number(counts.inProgress),
      completed: Number(counts.completed),
      cancelled: Number(counts.cancelled),
    },
    totals: { planned, produced, rejected },
    kpi: {
      progressPct: Number(progressPct.toFixed(2)),
      unitsPerHour: Number(unitsPerHour.toFixed(2)),
      efficiency: Number(efficiency.toFixed(2)),
    },
    byLocation: byLoc.map(b => ({
      locationId: b.locId,
      locationName: b.locName || "Sin ubicación",
      planned: parseFloat(b.planned),
      produced: parseFloat(b.produced),
      rejected: parseFloat(b.rejected),
      orders: Number(b.orders),
    })),
  });
});

export default router;
