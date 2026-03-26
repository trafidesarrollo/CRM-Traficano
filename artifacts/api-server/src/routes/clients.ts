import { Router, type IRouter } from "express";
import { db, clientsTable } from "@workspace/db";
import { eq, ilike, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/clients", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    let query = db.select().from(clientsTable);
    if (search) {
      query = query.where(ilike(clientsTable.companyName, `%${search}%`)) as any;
    }

    const [data, countResult] = await Promise.all([
      query.limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(clientsTable),
    ]);

    res.json({ data, total: Number(countResult[0].count), page, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar clientes" });
  }
});

router.post("/clients", async (req, res) => {
  try {
    const [client] = await db.insert(clientsTable).values(req.body).returning();
    res.status(201).json(client);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al crear cliente" });
  }
});

router.get("/clients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const clients = await db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
    if (!clients[0]) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
    res.json(clients[0]);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener cliente" });
  }
});

router.patch("/clients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(clientsTable).set(req.body).where(eq(clientsTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
});

router.delete("/clients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(clientsTable).where(eq(clientsTable.id, id));
    res.json({ message: "Cliente eliminado" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al eliminar cliente" });
  }
});

export default router;
