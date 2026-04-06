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
import { requireAuth, requireRole, requireMinRole } from "../middleware/auth.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(integrationsRouter);

router.use(requireAuth);

router.get("/integrations/anura/webhooks", async (req, res) => {
  const { db: database, anuraWebhooksTable } = await import("@workspace/db");
  const { desc, sql } = await import("drizzle-orm");
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
  const [data, countResult] = await Promise.all([
    database.select().from(anuraWebhooksTable).orderBy(desc(anuraWebhooksTable.receivedAt)).limit(limit).offset(offset),
    database.select({ count: sql<number>`count(*)` }).from(anuraWebhooksTable),
  ]);
  res.json({ data, total: Number(countResult[0].count) });
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
router.use("/extractions", extractionsRouter);
router.use("/followups", requireMinRole("vendedor"), followupsRouter);

router.use("/goals", goalsRouter);

router.use("/settings", requireRole("admin"), settingsRouter);

router.use("/users", requireRole("admin"), usersRouter);
router.use("/prompts", requireRole("admin", "gerente"), promptsRouter);
router.use("/audit", requireRole("admin", "gerente"), auditRouter);

export default router;
