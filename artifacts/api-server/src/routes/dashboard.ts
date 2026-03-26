import { Router, type IRouter } from "express";
import { db, clientsTable, opportunitiesTable, emailsTable, activitiesTable, salespeopleTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

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
      db.select().from(activitiesTable).orderBy(activitiesTable.createdAt).limit(10),
      db.select().from(salespeopleTable).where(eq(salespeopleTable.isActive, true)),
    ]);

    const emailsByCategory = {
      quote_request: Number(quoteRequestsResult[0].count),
      complaint: Number(complaintsResult[0].count),
      inquiry: Number(inquiriesResult[0].count),
    };

    const opportunitiesByStatus = {};

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

export default router;
