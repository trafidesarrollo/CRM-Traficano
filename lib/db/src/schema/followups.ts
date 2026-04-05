import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const followupRulesTable = pgTable("followup_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  triggerEvent: text("trigger_event", {
    enum: ["quote_sent", "quote_request_received", "opportunity_created", "no_response", "email_sent"],
  }).notNull(),
  delayDays: integer("delay_days").notNull().default(3),
  maxFollowups: integer("max_followups").notNull().default(3),
  templateId: integer("template_id"),
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  conditions: jsonb("conditions"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const followupTemplatesTable = pgTable("followup_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  category: text("category", {
    enum: ["quote_followup", "general_followup", "thank_you", "reminder", "reactivation"],
  }).notNull(),
  variables: jsonb("variables"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const scheduledFollowupsTable = pgTable("scheduled_followups", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").notNull(),
  templateId: integer("template_id"),
  opportunityId: integer("opportunity_id"),
  clientId: integer("client_id"),
  contactId: integer("contact_id"),
  emailId: integer("email_id"),
  assignedUserId: integer("assigned_user_id"),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
  status: text("status", {
    enum: ["pending", "sent", "skipped", "failed", "cancelled"],
  }).notNull().default("pending"),
  attemptNumber: integer("attempt_number").notNull().default(1),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  sentEmailId: integer("sent_email_id"),
  skipReason: text("skip_reason"),
  errorMessage: text("error_message"),
  generatedSubject: text("generated_subject"),
  generatedBody: text("generated_body"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFollowupRuleSchema = createInsertSchema(followupRulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFollowupRule = z.infer<typeof insertFollowupRuleSchema>;
export type FollowupRule = typeof followupRulesTable.$inferSelect;

export const insertFollowupTemplateSchema = createInsertSchema(followupTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFollowupTemplate = z.infer<typeof insertFollowupTemplateSchema>;
export type FollowupTemplate = typeof followupTemplatesTable.$inferSelect;

export const insertScheduledFollowupSchema = createInsertSchema(scheduledFollowupsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertScheduledFollowup = z.infer<typeof insertScheduledFollowupSchema>;
export type ScheduledFollowup = typeof scheduledFollowupsTable.$inferSelect;
