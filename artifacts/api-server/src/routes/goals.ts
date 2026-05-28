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

function computeDates(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = now.getMonth(); // 0-indexed
  const iso = (d: Date) => d.toISOString().split("T")[0];

  switch (period) {
    case "quarterly": {
      const q = Math.floor(m / 3);
      return { startDate: iso(new Date(y, q * 3, 1)), endDate: iso(new Date(y, q * 3 + 3, 0)) };
    }
    case "semiannual": {
      const h = m < 6 ? 0 : 1;
      return { startDate: iso(new Date(y, h * 6, 1)), endDate: iso(new Date(y, h * 6 + 6, 0)) };
    }
    case "annual":
      return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
    case "monthly":
    default:
      return { startDate: iso(new Date(y, m, 1)), endDate: iso(new Date(y, m + 1, 0)) };
  }
}

router.post("/", async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.startDate || !body.endDate) {
      const dates = computeDates(body.period || "monthly");
      body.startDate = body.startDate || dates.startDate;
      body.endDate   = body.endDate   || dates.endDate;
    }
    const [goal] = await db.insert(goalsTable).values(body).returning();
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
