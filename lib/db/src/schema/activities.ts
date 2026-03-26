import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: text("type", { enum: ["call", "visit", "email", "task", "note", "follow_up"] }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  clientId: integer("client_id"),
  contactId: integer("contact_id"),
  salespersonId: integer("salesperson_id"),
  opportunityId: integer("opportunity_id"),
  emailId: integer("email_id"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  outcome: text("outcome"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;
