import { pgTable, text, serial, timestamp, integer, boolean, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emailsTable = pgTable("emails", {
  id: serial("id").primaryKey(),
  gmailMessageId: text("gmail_message_id").unique(),
  gmailThreadId: text("gmail_thread_id"),
  gmailHistoryId: text("gmail_history_id"),
  subject: text("subject").notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  toEmail: text("to_email").notNull(),
  ccEmail: text("cc_email"),
  body: text("body").notNull(),
  bodyHtml: text("body_html"),
  direction: text("direction", { enum: ["inbound", "outbound"] }).notNull().default("inbound"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  category: text("category", { enum: ["quote_request", "complaint", "inquiry", "follow_up", "supplier", "internal", "spam", "other"] }),
  categoryConfidence: numeric("category_confidence", { precision: 5, scale: 4 }),
  categoryConfirmed: boolean("category_confirmed").notNull().default(false),
  status: text("status", { enum: ["pending", "processing", "processed", "replied", "closed"] }).notNull().default("pending"),
  assignedSalespersonId: integer("assigned_salesperson_id"),
  clientId: integer("client_id"),
  contactId: integer("contact_id"),
  opportunityId: integer("opportunity_id"),
  extractedData: jsonb("extracted_data"),
  attachments: jsonb("attachments"),
  gmailLabels: text("gmail_labels"),
  hasAttachments: boolean("has_attachments").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEmailSchema = createInsertSchema(emailsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Email = typeof emailsTable.$inferSelect;
