import { Router, type IRouter } from "express";
import { db, pipelinesTable, pipelineStagesTable, opportunitiesTable } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/pipelines", async (_req, res) => {
  try {
    const pipelines = await db.select().from(pipelinesTable).orderBy(asc(pipelinesTable.sortOrder));
    const stages = await db.select().from(pipelineStagesTable).orderBy(asc(pipelineStagesTable.sortOrder));
    const counts = await db.select({
      stageId: opportunitiesTable.stageId,
      count: sql<number>`count(*)::int`,
    }).from(opportunitiesTable).groupBy(opportunitiesTable.stageId);
    const countMap = new Map(counts.map(c => [c.stageId, Number(c.count)]));
    const data = pipelines.map(p => ({
      ...p,
      stages: stages.filter(s => s.pipelineId === p.id).map(s => ({ ...s, oppCount: countMap.get(s.id) || 0 })),
    }));
    res.json({ data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/pipelines", async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name) { res.status(400).json({ error: "name requerido" }); return; }
    const [p] = await db.insert(pipelinesTable).values({ name, description }).returning();
    res.json(p);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/pipelines/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, isActive, isDefault, sortOrder } = req.body || {};
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (isActive !== undefined) data.isActive = isActive;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;
    if (isDefault === true) {
      await db.update(pipelinesTable).set({ isDefault: false });
      data.isDefault = true;
    }
    const [p] = await db.update(pipelinesTable).set(data).where(eq(pipelinesTable.id, id)).returning();
    res.json(p);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/pipelines/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [p] = await db.select().from(pipelinesTable).where(eq(pipelinesTable.id, id));
    if (!p) { res.status(404).json({ error: "Pipeline no encontrado" }); return; }
    if (p.isDefault) { res.status(400).json({ error: "No se puede eliminar el pipeline por defecto" }); return; }
    const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(opportunitiesTable).where(eq(opportunitiesTable.pipelineId, id));
    if (Number(c) > 0) { res.status(400).json({ error: `No se puede eliminar: ${c} oportunidades activas en este pipeline. Movelas primero.` }); return; }
    await db.delete(pipelineStagesTable).where(eq(pipelineStagesTable.pipelineId, id));
    await db.delete(pipelinesTable).where(eq(pipelinesTable.id, id));
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/pipelines/:id/stages", async (req, res) => {
  try {
    const pipelineId = parseInt(req.params.id);
    const { name, color, sortOrder, winProbability, slaHours, isWon, isLost } = req.body || {};
    if (!name) { res.status(400).json({ error: "name requerido" }); return; }
    const [s] = await db.insert(pipelineStagesTable).values({
      pipelineId, name, color: color || "#3b82f6",
      sortOrder: sortOrder ?? 999, winProbability: winProbability ?? 0,
      slaHours: slaHours ?? null, isWon: !!isWon, isLost: !!isLost,
    }).returning();
    res.json(s);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/pipelines/stages/:stageId", async (req, res) => {
  try {
    const id = parseInt(req.params.stageId);
    const allowed = ["name", "color", "sortOrder", "winProbability", "slaHours", "isWon", "isLost"];
    const data: any = {};
    for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
    const [s] = await db.update(pipelineStagesTable).set(data).where(eq(pipelineStagesTable.id, id)).returning();
    res.json(s);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/pipelines/stages/:stageId", async (req, res) => {
  try {
    const id = parseInt(req.params.stageId);
    const cnt = await db.select({ c: sql<number>`count(*)::int` }).from(opportunitiesTable).where(eq(opportunitiesTable.stageId, id));
    if (Number(cnt[0]?.c) > 0) { res.status(400).json({ error: "Hay oportunidades en esta etapa. Movelas antes de eliminar." }); return; }
    await db.delete(pipelineStagesTable).where(eq(pipelineStagesTable.id, id));
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/pipelines/stages/reorder", async (req, res) => {
  try {
    const { order } = req.body || {};
    if (!Array.isArray(order)) { res.status(400).json({ error: "order debe ser array de {id, sortOrder}" }); return; }
    for (const item of order) {
      await db.update(pipelineStagesTable).set({ sortOrder: item.sortOrder }).where(eq(pipelineStagesTable.id, item.id));
    }
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
