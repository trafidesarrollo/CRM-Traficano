import { Router, type IRouter } from "express";
import { db, activitiesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

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
      ? await db.select().from(activitiesTable).where(and(...conditions)).orderBy(desc(activitiesTable.createdAt))
      : await db.select().from(activitiesTable).orderBy(desc(activitiesTable.createdAt));

    res.json(data);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar actividades" });
  }
});

router.post("/activities", async (req, res) => {
  try {
    const { type, title, clientId, outcome, description, completedAt, scheduledAt, salespersonId, opportunityId, contactId } = req.body;

    if (!type || !title) {
      res.status(400).json({ error: "Los campos 'type' y 'title' son obligatorios" });
      return;
    }

    const validTypes = ["call", "visit", "email", "task", "note", "follow_up"];
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: `Tipo inválido. Debe ser uno de: ${validTypes.join(", ")}` });
      return;
    }

    const insertData: any = {
      type,
      title: String(title),
    };

    if (clientId != null) insertData.clientId = Number(clientId);
    if (salespersonId != null) insertData.salespersonId = Number(salespersonId);
    if (opportunityId != null) insertData.opportunityId = Number(opportunityId);
    if (contactId != null) insertData.contactId = Number(contactId);
    if (outcome != null) insertData.outcome = String(outcome);
    if (description != null) insertData.description = String(description);
    if (completedAt != null) insertData.completedAt = new Date(completedAt);
    if (scheduledAt != null) insertData.scheduledAt = new Date(scheduledAt);

    const [activity] = await db.insert(activitiesTable).values(insertData).returning();
    res.status(201).json(activity);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al crear actividad" });
  }
});

export default router;
