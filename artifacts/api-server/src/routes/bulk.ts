import { Router, type IRouter, type Request, type Response } from "express";
import { db, clientsTable, contactsTable, productsTable, opportunitiesTable, tasksTable } from "@workspace/db";
import { inArray, sql } from "drizzle-orm";

const router: IRouter = Router();

const TABLES: Record<string, any> = {
  clients: clientsTable,
  contacts: contactsTable,
  products: productsTable,
  opportunities: opportunitiesTable,
  tasks: tasksTable,
};

router.post("/bulk/delete", async (req: Request, res: Response) => {
  try {
    const { entity, ids } = req.body || {};
    const t = TABLES[entity];
    if (!t) { res.status(400).json({ error: "entidad no soportada" }); return; }
    if (!Array.isArray(ids) || !ids.length) { res.status(400).json({ error: "ids vacío" }); return; }
    const numIds = ids.map((x: any) => parseInt(x)).filter((n: number) => !isNaN(n));
    const result = await db.delete(t).where(inArray(t.id, numIds)).returning({ id: t.id });
    res.json({ ok: true, deleted: result.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/bulk/update", async (req: Request, res: Response) => {
  try {
    const { entity, ids, patch } = req.body || {};
    const t = TABLES[entity];
    if (!t) { res.status(400).json({ error: "entidad no soportada" }); return; }
    if (!Array.isArray(ids) || !ids.length) { res.status(400).json({ error: "ids vacío" }); return; }
    if (!patch || typeof patch !== "object") { res.status(400).json({ error: "patch requerido" }); return; }
    const allowed: Record<string, string[]> = {
      clients: ["status", "industry", "country", "assignedSalespersonId"],
      contacts: ["status", "source", "leadScore"],
      products: ["isActive", "category", "currency"],
      opportunities: ["status", "priority", "pipelineId", "stageId", "hunterId", "farmerId"],
      tasks: ["status", "priority", "assignedTo"],
    };
    const data: any = {};
    for (const k of allowed[entity] || []) if (patch[k] !== undefined) data[k] = patch[k];
    if (!Object.keys(data).length) { res.status(400).json({ error: "no hay campos válidos para actualizar" }); return; }
    const numIds = ids.map((x: any) => parseInt(x)).filter((n: number) => !isNaN(n));
    const result = await db.update(t).set(data).where(inArray(t.id, numIds)).returning({ id: t.id });
    res.json({ ok: true, updated: result.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
