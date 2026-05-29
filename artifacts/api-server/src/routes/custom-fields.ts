import { Router, type IRouter } from "express";
import { db, customFieldDefsTable, customFieldValuesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireMinRole } from "../middleware/auth.js";

const router: IRouter = Router();
router.use(requireMinRole("gerente"));

router.get("/custom-fields/defs", async (req, res) => {
  const { entityType } = req.query as any;
  const q = db.select().from(customFieldDefsTable);
  const rows = entityType ? await q.where(eq(customFieldDefsTable.entityType, entityType)) : await q;
  res.json({ data: rows });
});

router.post("/custom-fields/defs", async (req, res) => {
  try {
    const [row] = await db.insert(customFieldDefsTable).values(req.body).returning();
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/custom-fields/defs/:id", async (req, res) => {
  try {
    const [row] = await db.update(customFieldDefsTable).set(req.body).where(eq(customFieldDefsTable.id, parseInt(req.params.id))).returning();
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/custom-fields/defs/:id", async (req, res) => {
  await db.delete(customFieldDefsTable).where(eq(customFieldDefsTable.id, parseInt(req.params.id)));
  res.json({ ok: true });
});

router.get("/custom-fields/values", async (req, res) => {
  const { entityType, entityId } = req.query as any;
  if (!entityType || !entityId) { res.status(400).json({ error: "entityType + entityId requeridos" }); return; }
  const defs = await db.select().from(customFieldDefsTable).where(eq(customFieldDefsTable.entityType, entityType));
  const ids = defs.map(d => d.id);
  if (!ids.length) { res.json({ data: [] }); return; }
  const vals = await db.select().from(customFieldValuesTable).where(eq(customFieldValuesTable.entityId, parseInt(entityId)));
  const filtered = vals.filter(v => ids.includes(v.fieldDefId as number));
  const merged = defs.map(d => ({ ...d, value: filtered.find(v => v.fieldDefId === d.id)?.value || null }));
  res.json({ data: merged });
});

router.post("/custom-fields/values", async (req, res) => {
  try {
    const { fieldDefId, entityId, value } = req.body;
    const existing = await db.select().from(customFieldValuesTable).where(and(eq(customFieldValuesTable.fieldDefId, fieldDefId), eq(customFieldValuesTable.entityId, entityId)));
    if (existing.length) {
      const [row] = await db.update(customFieldValuesTable).set({ value, updatedAt: new Date() }).where(eq(customFieldValuesTable.id, existing[0].id)).returning();
      res.json(row);
    } else {
      const [row] = await db.insert(customFieldValuesTable).values({ fieldDefId, entityId, value }).returning();
      res.json(row);
    }
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
