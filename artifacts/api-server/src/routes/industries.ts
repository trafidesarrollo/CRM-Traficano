import { Router, type IRouter } from "express";
import { db, industriesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/industries", async (req, res) => {
  try {
    const rows = await db.select().from(industriesTable).orderBy(asc(industriesTable.name));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/industries", async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: "El nombre es obligatorio" });
      return;
    }
    const [row] = await db.insert(industriesTable).values({ name: name.trim(), description: description?.trim() || null }).returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err.message?.includes("unique")) {
      res.status(409).json({ error: "Ya existe una industria con ese nombre" });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.patch("/industries/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const { name, description } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (!Object.keys(updates).length) { res.status(400).json({ error: "Sin cambios" }); return; }
    const [row] = await db.update(industriesTable).set(updates).where(eq(industriesTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "No encontrada" }); return; }
    res.json(row);
  } catch (err: any) {
    if (err.message?.includes("unique")) {
      res.status(409).json({ error: "Ya existe una industria con ese nombre" });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete("/industries/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    await db.delete(industriesTable).where(eq(industriesTable.id, id));
    res.json({ message: "Eliminada" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
