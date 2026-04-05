import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  followupRulesTable,
  followupTemplatesTable,
  scheduledFollowupsTable,
  clientsTable,
  contactsTable,
} from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  triggerFollowupsForEvent,
  processScheduledFollowups,
  getFollowupStats,
} from "../lib/followup-engine.js";

const router = Router();

router.get("/rules", async (_req: Request, res: Response) => {
  const rules = await db
    .select()
    .from(followupRulesTable)
    .orderBy(desc(followupRulesTable.priority));
  res.json(rules);
});

router.post("/rules", async (req: Request, res: Response) => {
  const { name, description, triggerEvent, delayDays, maxFollowups, templateId, priority, conditions } = req.body;
  if (!name || !triggerEvent) {
    res.status(400).json({ error: "Se requiere nombre y evento disparador" });
    return;
  }

  const [rule] = await db
    .insert(followupRulesTable)
    .values({
      name,
      description,
      triggerEvent,
      delayDays: delayDays || 3,
      maxFollowups: maxFollowups || 3,
      templateId,
      priority: priority || 0,
      conditions,
    })
    .returning();

  res.status(201).json(rule);
});

router.patch("/rules/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const updates: any = {};

  for (const field of ["name", "description", "triggerEvent", "delayDays", "maxFollowups", "templateId", "isActive", "priority", "conditions"]) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const [updated] = await db
    .update(followupRulesTable)
    .set(updates)
    .where(eq(followupRulesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Regla no encontrada" });
    return;
  }
  res.json(updated);
});

router.delete("/rules/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const [deleted] = await db
    .delete(followupRulesTable)
    .where(eq(followupRulesTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Regla no encontrada" });
    return;
  }
  res.json({ message: "Regla eliminada" });
});

router.get("/templates", async (_req: Request, res: Response) => {
  const templates = await db
    .select()
    .from(followupTemplatesTable)
    .orderBy(followupTemplatesTable.category);
  res.json(templates);
});

router.post("/templates", async (req: Request, res: Response) => {
  const { name, subject, body, category, variables } = req.body;
  if (!name || !subject || !body || !category) {
    res.status(400).json({ error: "Se requiere nombre, asunto, cuerpo y categoría" });
    return;
  }

  const [template] = await db
    .insert(followupTemplatesTable)
    .values({ name, subject, body, category, variables })
    .returning();

  res.status(201).json(template);
});

router.patch("/templates/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const updates: any = {};

  for (const field of ["name", "subject", "body", "category", "variables", "isActive"]) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const [updated] = await db
    .update(followupTemplatesTable)
    .set(updates)
    .where(eq(followupTemplatesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Plantilla no encontrada" });
    return;
  }
  res.json(updated);
});

router.delete("/templates/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const [deleted] = await db
    .delete(followupTemplatesTable)
    .where(eq(followupTemplatesTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Plantilla no encontrada" });
    return;
  }
  res.json({ message: "Plantilla eliminada" });
});

router.get("/scheduled", async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const conditions = [];
  if (status) {
    conditions.push(eq(scheduledFollowupsTable.status, status as any));
  }

  const followups = await db
    .select({
      id: scheduledFollowupsTable.id,
      ruleId: scheduledFollowupsTable.ruleId,
      ruleName: followupRulesTable.name,
      opportunityId: scheduledFollowupsTable.opportunityId,
      clientId: scheduledFollowupsTable.clientId,
      clientName: clientsTable.companyName,
      contactId: scheduledFollowupsTable.contactId,
      scheduledDate: scheduledFollowupsTable.scheduledDate,
      status: scheduledFollowupsTable.status,
      attemptNumber: scheduledFollowupsTable.attemptNumber,
      sentAt: scheduledFollowupsTable.sentAt,
      skipReason: scheduledFollowupsTable.skipReason,
      errorMessage: scheduledFollowupsTable.errorMessage,
      generatedSubject: scheduledFollowupsTable.generatedSubject,
      createdAt: scheduledFollowupsTable.createdAt,
    })
    .from(scheduledFollowupsTable)
    .leftJoin(followupRulesTable, eq(scheduledFollowupsTable.ruleId, followupRulesTable.id))
    .leftJoin(clientsTable, eq(scheduledFollowupsTable.clientId, clientsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(scheduledFollowupsTable.scheduledDate))
    .limit(limit)
    .offset(offset);

  res.json(followups);
});

router.patch("/scheduled/:id/cancel", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  const [updated] = await db
    .update(scheduledFollowupsTable)
    .set({ status: "cancelled", skipReason: req.body.reason || "Cancelado manualmente" })
    .where(and(eq(scheduledFollowupsTable.id, id), eq(scheduledFollowupsTable.status, "pending")))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Seguimiento no encontrado o ya procesado" });
    return;
  }
  res.json(updated);
});

router.patch("/scheduled/:id/reschedule", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { scheduledDate } = req.body;

  if (!scheduledDate) {
    res.status(400).json({ error: "Se requiere nueva fecha" });
    return;
  }

  const [updated] = await db
    .update(scheduledFollowupsTable)
    .set({ scheduledDate: new Date(scheduledDate) })
    .where(and(eq(scheduledFollowupsTable.id, id), eq(scheduledFollowupsTable.status, "pending")))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Seguimiento no encontrado o ya procesado" });
    return;
  }
  res.json(updated);
});

router.post("/trigger", async (req: Request, res: Response) => {
  const { event, opportunityId, clientId, contactId, emailId, assignedUserId } = req.body;
  if (!event) {
    res.status(400).json({ error: "Se requiere evento" });
    return;
  }

  const scheduled = await triggerFollowupsForEvent(event, {
    opportunityId,
    clientId,
    contactId,
    emailId,
    assignedUserId,
  });

  res.json({ triggered: scheduled.length, followups: scheduled });
});

router.post("/process", async (_req: Request, res: Response) => {
  const result = await processScheduledFollowups();
  res.json(result);
});

router.get("/stats", async (_req: Request, res: Response) => {
  const stats = await getFollowupStats();
  res.json(stats);
});

router.post("/preview", async (req: Request, res: Response) => {
  const { templateId, clientId, contactId, opportunityId } = req.body;

  if (!templateId) {
    res.status(400).json({ error: "Se requiere templateId" });
    return;
  }

  const [template] = await db
    .select()
    .from(followupTemplatesTable)
    .where(eq(followupTemplatesTable.id, templateId))
    .limit(1);

  if (!template) {
    res.status(404).json({ error: "Plantilla no encontrada" });
    return;
  }

  const vars: Record<string, string> = { empresa_propia: "Nuestra Empresa" };

  if (clientId) {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
    if (client) vars.empresa = client.companyName;
  }

  if (contactId) {
    const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, contactId)).limit(1);
    if (contact) vars.contacto = `${contact.firstName} ${contact.lastName}`;
  }

  const renderVar = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);

  res.json({
    subject: renderVar(template.subject),
    body: renderVar(template.body),
    template: template.name,
    variables: vars,
    missingVariables: (template.variables as string[] || []).filter((v: string) => !vars[v]),
  });
});

export default router;
