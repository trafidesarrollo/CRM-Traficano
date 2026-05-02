import { Router, type IRouter } from "express";
import { db, documentsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

const ALLOWED_ENTITY_TYPES = new Set(["client", "contact", "opportunity", "quote", "order", "activity", "task"]);

router.get("/documents", async (req, res) => {
  try {
    const { entityType, entityId } = req.query as any;
    if (!entityType || !entityId) {
      res.status(400).json({ error: "entityType y entityId son requeridos" });
      return;
    }
    if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
      res.status(400).json({ error: "entityType inválido" });
      return;
    }
    const eid = parseInt(entityId);
    if (Number.isNaN(eid)) { res.status(400).json({ error: "entityId inválido" }); return; }
    const rows = await db.select().from(documentsTable)
      .where(and(eq(documentsTable.entityType, entityType), eq(documentsTable.entityId, eid)))
      .orderBy(desc(documentsTable.createdAt));
    res.json({ data: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/documents", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    const { entityType, entityId, fileName, mimeType, sizeBytes, storageKey } = req.body || {};
    if (!entityType || !ALLOWED_ENTITY_TYPES.has(entityType)) { res.status(400).json({ error: "entityType inválido" }); return; }
    if (!entityId || !fileName || !storageKey) { res.status(400).json({ error: "Campos requeridos faltantes" }); return; }
    if (typeof storageKey !== "string" || !storageKey.startsWith("/objects/")) { res.status(400).json({ error: "storageKey inválido" }); return; }
    const [row] = await db.insert(documentsTable).values({
      entityType, entityId: parseInt(entityId), fileName, mimeType, sizeBytes, storageKey, uploadedBy: userId,
    }).returning();
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/documents/:id", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    const userRole = (req as any).session?.role;
    const id = parseInt(req.params.id);
    const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, id));
    if (!doc) { res.status(404).json({ error: "No encontrado" }); return; }
    const isPrivileged = userRole === "admin" || userRole === "gerente";
    if (!isPrivileged && doc.uploadedBy !== userId) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }
    await db.delete(documentsTable).where(eq(documentsTable.id, id));
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
