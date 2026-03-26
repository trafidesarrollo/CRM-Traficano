import { Router, type IRouter } from "express";
import { db, activitiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/activities", async (req, res) => {
  try {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
    const salespersonId = req.query.salespersonId ? parseInt(req.query.salespersonId as string) : undefined;
    const opportunityId = req.query.opportunityId ? parseInt(req.query.opportunityId as string) : undefined;

    let conditions: any[] = [];
    if (clientId) conditions.push(eq(activitiesTable.clientId, clientId));
    if (salespersonId) conditions.push(eq(activitiesTable.salespersonId, salespersonId));
    if (opportunityId) conditions.push(eq(activitiesTable.opportunityId, opportunityId));

    const data = conditions.length > 0
      ? await db.select().from(activitiesTable).where(and(...conditions)).orderBy(activitiesTable.createdAt)
      : await db.select().from(activitiesTable).orderBy(activitiesTable.createdAt);

    res.json(data);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar actividades" });
  }
});

router.post("/activities", async (req, res) => {
  try {
    const [activity] = await db.insert(activitiesTable).values(req.body).returning();
    res.status(201).json(activity);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al crear actividad" });
  }
});

export default router;
