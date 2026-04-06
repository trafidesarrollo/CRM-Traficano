import { Router, type IRouter } from "express";
import { db, conversationsTable, conversationMessagesTable, conversationEventsTable } from "@workspace/db";
import { eq, desc, ilike, sql, and, type SQL } from "drizzle-orm";

const router: IRouter = Router();

const VALID_STATUSES = ["nuevo", "sin_asignar", "en_gestion", "esperando_cliente", "esperando_interno", "resuelto", "archivado"];
const VALID_PRIORITIES = ["urgente", "alta", "normal", "baja"];

router.get("/conversations", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30));
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const priority = req.query.priority as string;
    const assignedToId = req.query.assignedToId as string;
    const search = req.query.search as string;

    const conditions: SQL[] = [];

    if (status) conditions.push(eq(conversationsTable.status, status as any));
    if (priority) conditions.push(eq(conversationsTable.priority, priority as any));
    if (assignedToId) conditions.push(eq(conversationsTable.assignedToId, parseInt(assignedToId)));
    if (search) {
      conditions.push(
        sql`(${ilike(conversationsTable.subject, `%${search}%`)} OR ${ilike(conversationsTable.fromEmail, `%${search}%`)})`
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select().from(conversationsTable)
        .where(where)
        .orderBy(desc(conversationsTable.lastMessageAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(conversationsTable).where(where),
    ]);

    const statusCounts = await db.select({
      status: conversationsTable.status,
      count: sql<number>`count(*)`,
    }).from(conversationsTable).groupBy(conversationsTable.status);

    res.json({
      data,
      total: Number(countResult[0].count),
      page,
      limit,
      statusCounts: Object.fromEntries(statusCounts.map(s => [s.status, Number(s.count)])),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar conversaciones" });
  }
});

router.get("/conversations/metrics/summary", async (req, res) => {
  try {
    const statusCounts = await db.select({
      status: conversationsTable.status,
      count: sql<number>`count(*)`,
    }).from(conversationsTable).groupBy(conversationsTable.status);

    const unassigned = await db.select({ count: sql<number>`count(*)` })
      .from(conversationsTable)
      .where(sql`${conversationsTable.assignedToId} IS NULL AND ${conversationsTable.status} NOT IN ('resuelto', 'archivado')`);

    const total = await db.select({ count: sql<number>`count(*)` }).from(conversationsTable);

    res.json({
      total: Number(total[0].count),
      unassigned: Number(unassigned[0].count),
      byStatus: Object.fromEntries(statusCounts.map(s => [s.status, Number(s.count)])),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener métricas" });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const conversations = await db.select().from(conversationsTable)
      .where(eq(conversationsTable.id, id)).limit(1);

    if (!conversations[0]) {
      res.status(404).json({ error: "Conversación no encontrada" });
      return;
    }

    const messages = await db.select().from(conversationMessagesTable)
      .where(eq(conversationMessagesTable.conversationId, id))
      .orderBy(conversationMessagesTable.receivedAt);

    const events = await db.select().from(conversationEventsTable)
      .where(eq(conversationEventsTable.conversationId, id))
      .orderBy(desc(conversationEventsTable.createdAt))
      .limit(50);

    res.json({
      ...conversations[0],
      messages,
      events,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener conversación" });
  }
});

router.patch("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const { status, priority, assignedToId, clientId, contactId, opportunityId } = req.body;
    const userId = (req as any).userId;

    if (status && !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `Estado inválido. Valores: ${VALID_STATUSES.join(", ")}` });
      return;
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      res.status(400).json({ error: `Prioridad inválida. Valores: ${VALID_PRIORITIES.join(", ")}` });
      return;
    }

    const existing = await db.select().from(conversationsTable)
      .where(eq(conversationsTable.id, id)).limit(1);

    if (!existing[0]) {
      res.status(404).json({ error: "Conversación no encontrada" });
      return;
    }

    const updates: any = { updatedAt: new Date() };
    const eventsToCreate: any[] = [];

    if (status && status !== existing[0].status) {
      eventsToCreate.push({
        conversationId: id,
        userId,
        eventType: "status_change",
        oldValue: existing[0].status,
        newValue: status,
      });
      updates.status = status;
    }

    if (priority && priority !== existing[0].priority) {
      eventsToCreate.push({
        conversationId: id,
        userId,
        eventType: "priority_change",
        oldValue: existing[0].priority,
        newValue: priority,
      });
      updates.priority = priority;
    }

    if (assignedToId !== undefined) {
      eventsToCreate.push({
        conversationId: id,
        userId,
        eventType: "assignment",
        oldValue: existing[0].assignedToId?.toString() || null,
        newValue: assignedToId?.toString() || null,
      });
      updates.assignedToId = assignedToId || null;
      if (!updates.status && existing[0].status === "nuevo") {
        updates.status = "en_gestion";
      }
    }

    if (clientId !== undefined) updates.clientId = clientId || null;
    if (contactId !== undefined) updates.contactId = contactId || null;
    if (opportunityId !== undefined) updates.opportunityId = opportunityId || null;

    const [updated] = await db.update(conversationsTable)
      .set(updates)
      .where(eq(conversationsTable.id, id))
      .returning();

    for (const evt of eventsToCreate) {
      await db.insert(conversationEventsTable).values(evt);
    }

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al actualizar conversación" });
  }
});

export default router;
