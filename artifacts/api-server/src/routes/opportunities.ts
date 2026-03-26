import { Router, type IRouter } from "express";
import { db, opportunitiesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/opportunities", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const assignedTo = req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined;
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;

    let conditions: any[] = [];
    if (status) conditions.push(eq(opportunitiesTable.status, status as any));
    if (assignedTo) conditions.push(eq(opportunitiesTable.salespersonId, assignedTo));
    if (clientId) conditions.push(eq(opportunitiesTable.clientId, clientId));

    const [data, countResult] = await Promise.all([
      conditions.length > 0
        ? db.select().from(opportunitiesTable).where(and(...conditions)).limit(limit).offset(offset).orderBy(opportunitiesTable.createdAt)
        : db.select().from(opportunitiesTable).limit(limit).offset(offset).orderBy(opportunitiesTable.createdAt),
      db.select({ count: sql<number>`count(*)` }).from(opportunitiesTable),
    ]);

    res.json({ data, total: Number(countResult[0].count), page, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar oportunidades" });
  }
});

router.post("/opportunities", async (req, res) => {
  try {
    const [opp] = await db.insert(opportunitiesTable).values(req.body).returning();
    res.status(201).json(opp);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al crear oportunidad" });
  }
});

router.get("/opportunities/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id)).limit(1);
    if (!data[0]) {
      res.status(404).json({ error: "Oportunidad no encontrada" });
      return;
    }
    res.json(data[0]);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener oportunidad" });
  }
});

router.patch("/opportunities/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(opportunitiesTable).set(req.body).where(eq(opportunitiesTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Oportunidad no encontrada" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al actualizar oportunidad" });
  }
});

export default router;
