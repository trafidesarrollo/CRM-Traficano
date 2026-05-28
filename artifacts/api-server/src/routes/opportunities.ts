import { Router, type IRouter } from "express";
import { db, opportunitiesTable, salespeopleTable, quotesTable, clientsTable, commercialTeamMembersTable } from "@workspace/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { notifyTeam } from "../lib/notify-team.js";

const router: IRouter = Router();

router.get("/opportunities", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const assignedTo = req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined;
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
    const hunterId = req.query.hunterId ? parseInt(req.query.hunterId as string) : undefined;
    const farmerId = req.query.farmerId ? parseInt(req.query.farmerId as string) : undefined;

    const callerRole = (req as any).userRole;
    const callerId: number = (req as any).session?.userId;

    let conditions: any[] = [];
    if (status) conditions.push(eq(opportunitiesTable.status, status as any));
    if (assignedTo) conditions.push(eq(opportunitiesTable.salespersonId, assignedTo));
    if (clientId) conditions.push(eq(opportunitiesTable.clientId, clientId));
    if (hunterId) conditions.push(eq(opportunitiesTable.hunterId, hunterId));
    if (farmerId) conditions.push(eq(opportunitiesTable.farmerId, farmerId));

    // Non-admin users only see opportunities for clients assigned to their commercial team
    if (!["admin", "gerente_comercial"].includes(callerRole) && callerId) {
      const userTeams = await db
        .select({ teamId: commercialTeamMembersTable.teamId })
        .from(commercialTeamMembersTable)
        .where(eq(commercialTeamMembersTable.userId, callerId));

      if (userTeams.length > 0) {
        const teamIds = userTeams.map((t) => t.teamId);
        const teamClients = await db
          .select({ id: clientsTable.id })
          .from(clientsTable)
          .where(inArray(clientsTable.assignedTeamId, teamIds));

        if (teamClients.length > 0) {
          conditions.push(inArray(opportunitiesTable.clientId, teamClients.map((c) => c.id)));
        } else {
          return res.json({ data: [], total: 0, page, limit });
        }
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      whereClause
        ? db.select().from(opportunitiesTable).where(whereClause).limit(limit).offset(offset).orderBy(opportunitiesTable.createdAt)
        : db.select().from(opportunitiesTable).limit(limit).offset(offset).orderBy(opportunitiesTable.createdAt),
      whereClause
        ? db.select({ count: sql<number>`count(*)` }).from(opportunitiesTable).where(whereClause)
        : db.select({ count: sql<number>`count(*)` }).from(opportunitiesTable),
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

    if (opp.clientId) {
      const actorUserId = (req as any).session?.userId;
      notifyTeam({
        clientId: opp.clientId,
        excludeUserId: actorUserId,
        type: "client_opportunity",
        title: "Nueva oportunidad",
        body: opp.title ?? undefined,
        link: `/clients/${opp.clientId}`,
        entityType: "opportunity",
        entityId: opp.id,
      });
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al crear oportunidad" });
  }
});

router.get("/opportunities/:id/quotes", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = await db.select({
      q: quotesTable,
      clientName: clientsTable.companyName,
      salespersonName: salespeopleTable.name,
    }).from(quotesTable)
      .leftJoin(clientsTable, eq(quotesTable.clientId, clientsTable.id))
      .leftJoin(salespeopleTable, eq(quotesTable.salespersonId, salespeopleTable.id))
      .where(eq(quotesTable.opportunityId, id))
      .orderBy(desc(quotesTable.date));
    res.json(data.map(r => ({ ...r.q, clientName: r.clientName, salespersonName: r.salespersonName })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener cotizaciones de la oportunidad" });
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
    const body = req.body;
    const session = (req as any).session;

    if (body.status === "quoted" || body.status === "quote_requested") {
      if (session?.userId) {
        const sp = await db.select().from(salespeopleTable).where(eq(salespeopleTable.userId, session.userId)).limit(1);
        if (sp[0]?.functionalRole === "hunter") {
          res.status(403).json({ error: "Los Hunters no pueden cotizar. Solicitá la cotización al Admin." });
          return;
        }
      }
    }

    const updateData: any = { ...body };
    if (body.status) {
      updateData.stageEnteredAt = new Date();
    }

    const [updated] = await db.update(opportunitiesTable).set(updateData).where(eq(opportunitiesTable.id, id)).returning();
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
