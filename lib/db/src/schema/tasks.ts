import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", { enum: ["task", "call", "meeting", "email", "followup", "reminder"] }).notNull().default("task"),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull().default("medium"),
  status: text("status", { enum: ["pending", "in_progress", "completed", "cancelled"] }).notNull().default("pending"),
  assignedTo: integer("assigned_to"),
  createdBy: integer("created_by"),
  clientId: integer("client_id"),
  contactId: integer("contact_id"),
  opportunityId: integer("opportunity_id"),
  quoteId: integer("quote_id"),
  orderId: integer("order_id"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  reminderAt: timestamp("reminder_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notifyOnDue: boolean("notify_on_due").notNull().default(true),
  deferCount: integer("defer_count").notNull().default(0),
  deferredAt: timestamp("deferred_at", { withTimezone: true }),
  originalDueDate: timestamp("original_due_date", { withTimezone: true }),
  googleEventId: text("google_event_id"),
  googleCalendarId: text("google_calendar_id"),
  googleSyncedAt: timestamp("google_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
