import { db } from "@workspace/db";
import {
  followupRulesTable,
  followupTemplatesTable,
  scheduledFollowupsTable,
  opportunitiesTable,
  clientsTable,
  contactsTable,
  emailsTable,
  salespeopleTable,
} from "@workspace/db/schema";
import { eq, and, lte, sql, desc } from "drizzle-orm";

interface TemplateVariables {
  contacto?: string;
  empresa?: string;
  producto?: string;
  fecha_cotizacion?: string;
  vendedor?: string;
  empresa_propia?: string;
  categoria?: string;
  [key: string]: string | undefined;
}

function renderTemplate(template: string, vars: TemplateVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}

export async function scheduleFollowup(params: {
  ruleId: number;
  opportunityId?: number;
  clientId?: number;
  contactId?: number;
  emailId?: number;
  assignedUserId?: number;
  delayDays: number;
  attemptNumber?: number;
  templateId?: number;
}) {
  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + params.delayDays);

  const dedupeConditions = [
    eq(scheduledFollowupsTable.ruleId, params.ruleId),
    eq(scheduledFollowupsTable.status, "pending"),
  ];
  if (params.opportunityId) dedupeConditions.push(eq(scheduledFollowupsTable.opportunityId, params.opportunityId));
  if (params.emailId) dedupeConditions.push(eq(scheduledFollowupsTable.emailId, params.emailId));
  if (params.clientId) dedupeConditions.push(eq(scheduledFollowupsTable.clientId, params.clientId));
  if (params.contactId) dedupeConditions.push(eq(scheduledFollowupsTable.contactId, params.contactId));

  const existing = await db
    .select()
    .from(scheduledFollowupsTable)
    .where(and(...dedupeConditions));

  if (existing.length > 0) {
    return existing[0];
  }

  const [scheduled] = await db
    .insert(scheduledFollowupsTable)
    .values({
      ruleId: params.ruleId,
      templateId: params.templateId,
      opportunityId: params.opportunityId,
      clientId: params.clientId,
      contactId: params.contactId,
      emailId: params.emailId,
      assignedUserId: params.assignedUserId,
      scheduledDate,
      attemptNumber: params.attemptNumber || 1,
    })
    .returning();

  return scheduled;
}

export async function triggerFollowupsForEvent(
  event: string,
  context: {
    opportunityId?: number;
    clientId?: number;
    contactId?: number;
    emailId?: number;
    assignedUserId?: number;
  },
) {
  const rules = await db
    .select()
    .from(followupRulesTable)
    .where(
      and(
        eq(followupRulesTable.triggerEvent, event),
        eq(followupRulesTable.isActive, true),
      ),
    )
    .orderBy(desc(followupRulesTable.priority));

  const scheduled = [];
  for (const rule of rules) {
    const result = await scheduleFollowup({
      ruleId: rule.id,
      templateId: rule.templateId || undefined,
      delayDays: rule.delayDays,
      ...context,
    });
    scheduled.push(result);
  }

  return scheduled;
}

export async function processScheduledFollowups(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  details: Array<{ id: number; status: string; reason?: string }>;
}> {
  const now = new Date();
  const pending = await db
    .select()
    .from(scheduledFollowupsTable)
    .where(
      and(
        eq(scheduledFollowupsTable.status, "pending"),
        lte(scheduledFollowupsTable.scheduledDate, now),
      ),
    )
    .orderBy(scheduledFollowupsTable.scheduledDate)
    .limit(50);

  const result = {
    processed: pending.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    details: [] as Array<{ id: number; status: string; reason?: string }>,
  };

  for (const followup of pending) {
    try {
      const [rule] = await db
        .select()
        .from(followupRulesTable)
        .where(eq(followupRulesTable.id, followup.ruleId))
        .limit(1);

      if (!rule || !rule.isActive) {
        await db
          .update(scheduledFollowupsTable)
          .set({ status: "skipped", skipReason: "Regla desactivada" })
          .where(eq(scheduledFollowupsTable.id, followup.id));
        result.skipped++;
        result.details.push({ id: followup.id, status: "skipped", reason: "Regla desactivada" });
        continue;
      }

      if (followup.opportunityId) {
        const [opp] = await db
          .select()
          .from(opportunitiesTable)
          .where(eq(opportunitiesTable.id, followup.opportunityId))
          .limit(1);

        if (opp && (opp.status === "won" || opp.status === "lost")) {
          await db
            .update(scheduledFollowupsTable)
            .set({ status: "skipped", skipReason: `Oportunidad ${opp.status === "won" ? "ganada" : "perdida"}` })
            .where(eq(scheduledFollowupsTable.id, followup.id));
          result.skipped++;
          result.details.push({ id: followup.id, status: "skipped", reason: `Oportunidad ${opp.status}` });
          continue;
        }
      }

      if (followup.emailId) {
        const recentReply = await db
          .select()
          .from(emailsTable)
          .where(
            and(
              eq(emailsTable.clientId, followup.clientId!),
              eq(emailsTable.direction, "inbound"),
            ),
          )
          .orderBy(desc(emailsTable.receivedAt))
          .limit(1);

        if (recentReply.length > 0) {
          const replyDate = new Date(recentReply[0].receivedAt!);
          const originalEmailDate = followup.createdAt;
          if (replyDate > originalEmailDate) {
            await db
              .update(scheduledFollowupsTable)
              .set({ status: "skipped", skipReason: "Cliente respondió" })
              .where(eq(scheduledFollowupsTable.id, followup.id));
            result.skipped++;
            result.details.push({ id: followup.id, status: "skipped", reason: "Cliente respondió" });
            continue;
          }
        }
      }

      const templateId = followup.templateId || rule.templateId;
      let generatedSubject = "";
      let generatedBody = "";

      if (templateId) {
        const [template] = await db
          .select()
          .from(followupTemplatesTable)
          .where(eq(followupTemplatesTable.id, templateId))
          .limit(1);

        if (template) {
          const vars = await buildTemplateVariables(followup);
          generatedSubject = renderTemplate(template.subject, vars);
          generatedBody = renderTemplate(template.body, vars);
        }
      }

      await db
        .update(scheduledFollowupsTable)
        .set({
          status: "sent",
          sentAt: new Date(),
          generatedSubject,
          generatedBody,
        })
        .where(eq(scheduledFollowupsTable.id, followup.id));

      if (followup.attemptNumber < rule.maxFollowups) {
        await scheduleFollowup({
          ruleId: rule.id,
          templateId: rule.templateId || undefined,
          delayDays: rule.delayDays,
          opportunityId: followup.opportunityId || undefined,
          clientId: followup.clientId || undefined,
          contactId: followup.contactId || undefined,
          emailId: followup.emailId || undefined,
          assignedUserId: followup.assignedUserId || undefined,
          attemptNumber: followup.attemptNumber + 1,
        });
      }

      result.sent++;
      result.details.push({ id: followup.id, status: "sent" });
    } catch (err: any) {
      await db
        .update(scheduledFollowupsTable)
        .set({ status: "failed", errorMessage: err.message })
        .where(eq(scheduledFollowupsTable.id, followup.id));
      result.failed++;
      result.details.push({ id: followup.id, status: "failed", reason: err.message });
    }
  }

  return result;
}

async function buildTemplateVariables(followup: any): Promise<TemplateVariables> {
  const vars: TemplateVariables = {
    empresa_propia: "Nuestra Empresa",
  };

  if (followup.clientId) {
    const [client] = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.id, followup.clientId))
      .limit(1);
    if (client) vars.empresa = client.companyName;
  }

  if (followup.contactId) {
    const [contact] = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.id, followup.contactId))
      .limit(1);
    if (contact) vars.contacto = `${contact.firstName} ${contact.lastName}`;
  }

  if (followup.assignedUserId) {
    const [sp] = await db
      .select()
      .from(salespeopleTable)
      .where(eq(salespeopleTable.userId, followup.assignedUserId))
      .limit(1);
    if (sp) vars.vendedor = sp.name;
  }

  if (followup.opportunityId) {
    const [opp] = await db
      .select()
      .from(opportunitiesTable)
      .where(eq(opportunitiesTable.id, followup.opportunityId))
      .limit(1);
    if (opp) {
      vars.producto = opp.title;
      if (opp.createdAt) {
        vars.fecha_cotizacion = new Date(opp.createdAt).toLocaleDateString("es-AR");
      }
    }
  }

  return vars;
}

export async function getFollowupStats() {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      sent: sql<number>`count(*) filter (where status = 'sent')::int`,
      skipped: sql<number>`count(*) filter (where status = 'skipped')::int`,
      failed: sql<number>`count(*) filter (where status = 'failed')::int`,
      cancelled: sql<number>`count(*) filter (where status = 'cancelled')::int`,
      dueToday: sql<number>`count(*) filter (where status = 'pending' and scheduled_date <= now())::int`,
      dueThisWeek: sql<number>`count(*) filter (where status = 'pending' and scheduled_date <= now() + interval '7 days')::int`,
    })
    .from(scheduledFollowupsTable);

  return stats;
}
