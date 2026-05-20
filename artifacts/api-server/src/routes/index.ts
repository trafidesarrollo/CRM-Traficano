import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import clientsRouter from "./clients.js";
import contactsRouter from "./contacts.js";
import salespeopleRouter from "./salespeople.js";
import productsRouter from "./products.js";
import emailsRouter from "./emails.js";
import gmailRouter from "./gmail.js";
import opportunitiesRouter from "./opportunities.js";
import activitiesRouter from "./activities.js";
import dashboardRouter from "./dashboard.js";
import promptsRouter from "./prompts.js";
import importsRouter from "./imports.js";
import extractionsRouter from "./extractions.js";
import followupsRouter from "./followups.js";
import auditRouter from "./audit.js";
import goalsRouter from "./goals.js";
import settingsRouter from "./settings.js";
import conversationsRouter from "./conversations.js";
import integrationsRouter from "./integrations.js";
import priceListsRouter from "./price-lists.js";
import quotesRouter from "./quotes.js";
import ordersRouter from "./orders.js";
import tasksRouter from "./tasks.js";
import notificationsRouter from "./notifications.js";
import emailTemplatesRouter from "./email-templates.js";
import documentsRouter from "./documents.js";
import automationRouter from "./automation.js";
import customFieldsRouter from "./custom-fields.js";
import reportsRouter from "./reports.js";
import storageRouter from "./storage.js";
import pipelinesRouter from "./pipelines.js";
import quotePdfRouter from "./quote-pdf.js";
import orderPdfRouter from "./order-pdf.js";
import reportsExportRouter from "./reports-export.js";
import gcalRouter from "./gcal.js";
import csvRouter from "./csv.js";
import importErpRouter from "./import-erp.js";
import searchRouter from "./search.js";
import bulkRouter from "./bulk.js";
import bulkActivitiesRouter from "./bulk-activities.js";
import duplicatesRouter from "./duplicates.js";
import productionRouter from "./production.js";
import {
  requireAuth,
  requireRole,
  requireMinRole,
} from "../middleware/auth.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(integrationsRouter);
router.use(importErpRouter);
router.use(requireAuth);


router.get("/integrations/anura/webhooks", async (req, res) => {
  const { db: database, anuraWebhooksTable } = await import("@workspace/db");
  const { desc, sql } = await import("drizzle-orm");
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.query.limit as string) || 50),
  );
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
  const [data, countResult] = await Promise.all([
    database
      .select()
      .from(anuraWebhooksTable)
      .orderBy(desc(anuraWebhooksTable.receivedAt))
      .limit(limit)
      .offset(offset),
    database.select({ count: sql<number>`count(*)` }).from(anuraWebhooksTable),
  ]);
  res.json({ data, total: Number(countResult[0].count) });
});

router.patch("/integrations/anura/webhooks/:id", async (req, res) => {
  const { db: database, anuraWebhooksTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const { clientId, salespersonId, notes } = req.body;
  const updates: any = {};
  if (clientId !== undefined) {
    if (
      clientId !== null &&
      (typeof clientId !== "number" || isNaN(clientId))
    ) {
      res.status(400).json({ error: "clientId debe ser un número o null" });
      return;
    }
    updates.clientId = clientId || null;
  }
  if (salespersonId !== undefined) {
    if (
      salespersonId !== null &&
      (typeof salespersonId !== "number" || isNaN(salespersonId))
    ) {
      res
        .status(400)
        .json({ error: "salespersonId debe ser un número o null" });
      return;
    }
    updates.salespersonId = salespersonId || null;
  }
  if (notes !== undefined) {
    if (notes !== null && typeof notes !== "string") {
      res.status(400).json({ error: "notes debe ser un string o null" });
      return;
    }
    updates.notes = notes || null;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No se enviaron campos para actualizar" });
    return;
  }
  const [updated] = await database
    .update(anuraWebhooksTable)
    .set(updates)
    .where(eq(anuraWebhooksTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Webhook no encontrado" });
    return;
  }
  res.json(updated);
});

router.get("/salespeople/:id/profile", async (req, res) => {
  const {
    db: database,
    salespeopleTable,
    activitiesTable,
    anuraWebhooksTable,
    emailsTable,
  } = await import("@workspace/db");
  const { eq, desc, sql } = await import("drizzle-orm");
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [sp] = await database
    .select()
    .from(salespeopleTable)
    .where(eq(salespeopleTable.id, id))
    .limit(1);
  if (!sp) {
    res.status(404).json({ error: "Vendedor no encontrado" });
    return;
  }

  const [calls, activities, emailCount, callStats, activityCount] =
    await Promise.all([
      database
        .select()
        .from(anuraWebhooksTable)
        .where(eq(anuraWebhooksTable.salespersonId, id))
        .orderBy(desc(anuraWebhooksTable.receivedAt))
        .limit(20),
      database
        .select()
        .from(activitiesTable)
        .where(eq(activitiesTable.salespersonId, id))
        .orderBy(desc(activitiesTable.createdAt))
        .limit(20),
      database
        .select({ count: sql<number>`count(*)` })
        .from(activitiesTable)
        .where(
          sql`${activitiesTable.salespersonId} = ${id} AND ${activitiesTable.type} = 'email'`,
        ),
      database
        .select({
          total: sql<number>`count(*)`,
          answered: sql<number>`count(*) filter (where status = 'answered')`,
          totalDuration: sql<number>`coalesce(sum(duration_seconds), 0)`,
        })
        .from(anuraWebhooksTable)
        .where(eq(anuraWebhooksTable.salespersonId, id)),
      database
        .select({ count: sql<number>`count(*)` })
        .from(activitiesTable)
        .where(eq(activitiesTable.salespersonId, id)),
    ]);

  res.json({
    salesperson: sp,
    calls,
    activities,
    stats: {
      totalCalls: Number(callStats[0]?.total || 0),
      answeredCalls: Number(callStats[0]?.answered || 0),
      totalCallDuration: Number(callStats[0]?.totalDuration || 0),
      totalEmails: Number(emailCount[0]?.count || 0),
      totalActivities: Number(activityCount[0]?.count || 0),
    },
  });
});

router.use(dashboardRouter);
router.use(emailsRouter);
router.use(opportunitiesRouter);
router.use(clientsRouter);
router.use(contactsRouter);
router.use(salespeopleRouter);
router.use(productsRouter);
router.use(activitiesRouter);

router.use(gmailRouter);
router.use(conversationsRouter);
router.use(importsRouter);
router.use(requireMinRole("vendedor"), priceListsRouter);
router.use(requireMinRole("vendedor"), quotesRouter);
router.use(requireMinRole("vendedor"), ordersRouter);
router.use(tasksRouter);
router.use(notificationsRouter);
router.use(requireMinRole("vendedor"), emailTemplatesRouter);
router.use(documentsRouter);
router.use(storageRouter);
router.use(requireMinRole("gerente"), automationRouter);
router.use(requireMinRole("gerente"), customFieldsRouter);
router.use(requireMinRole("vendedor"), reportsRouter);
router.use(pipelinesRouter);
router.use((req, res, next) => {
  // Defense-in-depth: only admin/gerente can mutate pipelines/stages
  if (req.method === "GET") return next();
  if (!req.path.startsWith("/pipelines")) return next();
  return requireMinRole("gerente")(req, res, next);
});
router.use(requireMinRole("vendedor"), quotePdfRouter);
router.use(requireMinRole("vendedor"), orderPdfRouter);
router.use(requireMinRole("vendedor"), reportsExportRouter);
router.use(gcalRouter);
router.use(requireMinRole("vendedor"), csvRouter);
router.use(requireMinRole("vendedor"), searchRouter);
router.use(requireMinRole("gerente"), bulkRouter);
router.use(requireMinRole("vendedor"), bulkActivitiesRouter);
router.use(requireMinRole("vendedor"), duplicatesRouter);
router.use(requireMinRole("vendedor"), productionRouter);
router.use("/extractions", extractionsRouter);
router.use("/followups", requireMinRole("vendedor"), followupsRouter);

router.use("/goals", goalsRouter);

router.use("/settings", requireRole("admin", "gerente_comercial"), settingsRouter);

router.use("/users", requireRole("admin", "gerente_comercial"), usersRouter);
router.use("/prompts", requireRole("admin", "gerente_comercial", "gerente"), promptsRouter);
router.use("/audit", requireRole("admin", "gerente_comercial", "gerente"), auditRouter);

export default router;
