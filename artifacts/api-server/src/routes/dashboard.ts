import { Router, type IRouter } from "express";
import { db, clientsTable, opportunitiesTable, emailsTable, activitiesTable, salespeopleTable, goalsTable, quotesTable } from "@workspace/db";
import { eq, sql, and, gte, inArray, notInArray, isNotNull, desc } from "drizzle-orm";

const router: IRouter = Router();

function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(now);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getStartOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

router.get("/dashboard/metrics", async (req, res) => {
  try {
    const [
      totalClientsResult,
      totalOpportunitiesResult,
      openOpportunitiesResult,
      wonOpportunitiesResult,
      totalEmailsResult,
      pendingEmailsResult,
      quoteRequestsResult,
      complaintsResult,
      inquiriesResult,
      recentActivities,
      salespeople,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(clientsTable),
      db.select({ count: sql<number>`count(*)` }).from(opportunitiesTable),
      db.select({ count: sql<number>`count(*)` }).from(opportunitiesTable).where(eq(opportunitiesTable.status, "new")),
      db.select({ count: sql<number>`count(*)` }).from(opportunitiesTable).where(eq(opportunitiesTable.status, "won")),
      db.select({ count: sql<number>`count(*)` }).from(emailsTable),
      db.select({ count: sql<number>`count(*)` }).from(emailsTable).where(eq(emailsTable.status, "pending")),
      db.select({ count: sql<number>`count(*)` }).from(emailsTable).where(eq(emailsTable.category, "quote_request")),
      db.select({ count: sql<number>`count(*)` }).from(emailsTable).where(eq(emailsTable.category, "complaint")),
      db.select({ count: sql<number>`count(*)` }).from(emailsTable).where(eq(emailsTable.category, "inquiry")),
      db.select().from(activitiesTable).orderBy(desc(activitiesTable.createdAt)).limit(10),
      db.select().from(salespeopleTable).where(eq(salespeopleTable.isActive, true)),
    ]);

    const emailsByCategory = {
      quote_request: Number(quoteRequestsResult[0].count),
      complaint: Number(complaintsResult[0].count),
      inquiry: Number(inquiriesResult[0].count),
    };

    const opportunitiesByStatus: Record<string, number> = {};
    const oppStatusCounts = await db.select({
      status: opportunitiesTable.status,
      count: sql<number>`count(*)`,
    }).from(opportunitiesTable).groupBy(opportunitiesTable.status);
    for (const row of oppStatusCounts) {
      opportunitiesByStatus[row.status] = Number(row.count);
    }

    const salespersonMetrics = salespeople.map((s) => ({
      salespersonId: s.id,
      salespersonName: s.name,
      emailsHandled: 0,
      opportunitiesCreated: 0,
      activitiesLogged: 0,
      wonDeals: 0,
    }));

    res.json({
      totalClients: Number(totalClientsResult[0].count),
      totalOpportunities: Number(totalOpportunitiesResult[0].count),
      openOpportunities: Number(openOpportunitiesResult[0].count),
      wonOpportunities: Number(wonOpportunitiesResult[0].count),
      totalEmails: Number(totalEmailsResult[0].count),
      pendingEmails: Number(pendingEmailsResult[0].count),
      quoteRequests: Number(quoteRequestsResult[0].count),
      complaints: Number(complaintsResult[0].count),
      inquiries: Number(inquiriesResult[0].count),
      emailsByCategory,
      opportunitiesByStatus,
      recentActivities,
      salespersonMetrics,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener métricas" });
  }
});

router.get("/dashboard/commercial-plan", async (req, res) => {
  try {
    const startOfWeek = getStartOfWeek();
    const startOfMonth = getStartOfMonth();

    const allSalespeople = await db.select().from(salespeopleTable).where(eq(salespeopleTable.isActive, true));
    const allGoals = await db.select().from(goalsTable);
    const allActivities = await db.select().from(activitiesTable);
    const allOpportunities = await db.select().from(opportunitiesTable);

    const hunters = allSalespeople.filter(s => s.functionalRole === "hunter");
    const farmers = allSalespeople.filter(s => s.functionalRole === "farmer");
    const admins = allSalespeople.filter(s => s.functionalRole === "admin_ventas");

    function getGoalTarget(spId: number, metricType: string, defaultVal: number): number {
      const goal = allGoals.find(g => g.salespersonId === spId && g.metricType === metricType);
      return goal ? Number(goal.targetValue) : defaultVal;
    }

    const hunterMetrics = hunters.map(h => {
      const spActivities = allActivities.filter(a => a.salespersonId === h.id);
      const callsThisWeek = spActivities.filter(a => a.type === "call" && a.completedAt && new Date(a.completedAt) >= startOfWeek).length;
      const meetingsThisMonth = spActivities.filter(a => (a.type === "visit") && a.completedAt && new Date(a.completedAt) >= startOfMonth).length;
      const leadsGeneratedThisMonth = allOpportunities.filter(o => o.hunterId === h.id && new Date(o.createdAt) >= startOfMonth).length;

      return {
        salespersonId: h.id,
        name: h.name,
        callsThisWeek,
        callsWeekTarget: getGoalTarget(h.id, "calls", 100),
        meetingsThisMonth,
        meetingsMonthTarget: getGoalTarget(h.id, "meetings", 20),
        leadsGeneratedThisMonth,
      };
    });

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const closedStatuses = ["won", "lost", "closed"];

    const farmerMetrics = farmers.map(f => {
      const myOpps = allOpportunities.filter(o => o.farmerId === f.id);
      const leadsAwaitingResponse = myOpps.filter(o => o.status === "new" && new Date(o.stageEnteredAt) < twoHoursAgo).length;

      const assignedOpps = myOpps.filter(o => o.stageEnteredAt && o.createdAt);
      const responseTimes = assignedOpps
        .filter(o => o.status !== "new")
        .map(o => (new Date(o.stageEnteredAt).getTime() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60));
      const avgResponseTimeHours = responseTimes.length > 0 ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10 : 0;

      const activeOpportunities = myOpps.filter(o => !closedStatuses.includes(o.status)).length;

      const wonCount = myOpps.filter(o => o.status === "won").length;
      const lostCount = myOpps.filter(o => o.status === "lost").length;
      const closeRate = (wonCount + lostCount) > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;

      const recentActivityOppIds = new Set(
        allActivities
          .filter(a => a.completedAt && new Date(a.completedAt) >= threeDaysAgo && a.opportunityId)
          .map(a => a.opportunityId)
      );
      const staleOpportunities = myOpps.filter(o => !closedStatuses.includes(o.status) && !recentActivityOppIds.has(o.id)).length;

      return {
        salespersonId: f.id,
        name: f.name,
        leadsAwaitingResponse,
        avgResponseTimeHours,
        activeOpportunities,
        closeRate,
        staleOpportunities,
      };
    });

    const adminMetrics = admins.map(a => {
      const pendingQuotes = allOpportunities.filter(o => o.status === "quote_requested").length;

      const quotedOpps = allOpportunities.filter(o => o.status === "quoted" || o.status === "negotiating" || o.status === "won");
      const quoteRequestedOpps = allOpportunities.filter(o => {
        return o.status === "quoted" && o.updatedAt && o.stageEnteredAt;
      });

      const turnaroundHours = quoteRequestedOpps.map(o => {
        return (new Date(o.updatedAt).getTime() - new Date(o.stageEnteredAt).getTime()) / (1000 * 60 * 60);
      });
      const avgQuoteTurnaroundHours = turnaroundHours.length > 0
        ? Math.round((turnaroundHours.reduce((a, b) => a + b, 0) / turnaroundHours.length) * 10) / 10
        : 0;

      const onTimeCount = turnaroundHours.filter(h => h <= 24).length;
      const quotesOnTimeRate = turnaroundHours.length > 0 ? Math.round((onTimeCount / turnaroundHours.length) * 100) : 100;

      const quotesThisMonth = allOpportunities.filter(o =>
        ["quoted", "negotiating", "won"].includes(o.status) &&
        o.updatedAt && new Date(o.updatedAt) >= startOfMonth
      ).length;

      return {
        salespersonId: a.id,
        name: a.name,
        pendingQuotes,
        avgQuoteTurnaroundHours,
        quotesOnTimeRate,
        quotesThisMonth,
      };
    });

    const pipelineFunnel = {
      leadsNew: allOpportunities.filter(o => o.status === "new").length,
      quoteRequested: allOpportunities.filter(o => o.status === "quote_requested").length,
      quoted: allOpportunities.filter(o => o.status === "quoted").length,
      negotiating: allOpportunities.filter(o => o.status === "negotiating").length,
      won: allOpportunities.filter(o => o.status === "won").length,
      lost: allOpportunities.filter(o => o.status === "lost").length,
    };

    // ── Client counters ──────────────────────────────────────────────────────
    const [clientStatusCounts, quotedClientRows] = await Promise.all([
      db.select({ status: clientsTable.status, count: sql<number>`count(*)` })
        .from(clientsTable)
        .groupBy(clientsTable.status),
      db.selectDistinct({ clientId: quotesTable.clientId })
        .from(quotesTable)
        .where(isNotNull(quotesTable.clientId)),
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of clientStatusCounts) {
      statusMap[row.status] = Number(row.count);
    }

    const clientStats = {
      prospect: statusMap["prospect"] ?? 0,
      potential: statusMap["potential"] ?? 0,
      final: statusMap["final"] ?? 0,
      inactive: statusMap["inactive"] ?? 0,
      total: Object.values(statusMap).reduce((a, b) => a + b, 0),
      cotizados: quotedClientRows.length,
    };

    res.json({
      hunterMetrics,
      farmerMetrics,
      adminMetrics,
      pipelineFunnel,
      clientStats,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener métricas del plan comercial" });
  }
});

export default router;
