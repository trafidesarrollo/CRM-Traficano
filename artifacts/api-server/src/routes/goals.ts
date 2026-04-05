import { Router, type IRouter } from "express";
import { db, goalsTable, salespeopleTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const salespersonId = req.query.salespersonId ? parseInt(req.query.salespersonId as string) : undefined;
    const period = req.query.period as string;

    let conditions: any[] = [];
    if (salespersonId) conditions.push(eq(goalsTable.salespersonId, salespersonId));
    if (period) conditions.push(eq(goalsTable.period, period as any));

    const data = conditions.length > 0
      ? await db.select().from(goalsTable).where(and(...conditions)).orderBy(goalsTable.createdAt)
      : await db.select().from(goalsTable).orderBy(goalsTable.createdAt);

    res.json(data);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar metas" });
  }
});

router.post("/", async (req, res) => {
  try {
    const [goal] = await db.insert(goalsTable).values(req.body).returning();
    res.status(201).json(goal);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al crear meta" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(goalsTable).set(req.body).where(eq(goalsTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Meta no encontrada" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al actualizar meta" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(goalsTable).where(eq(goalsTable.id, id));
    res.json({ message: "Meta eliminada" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al eliminar meta" });
  }
});

export default router;
