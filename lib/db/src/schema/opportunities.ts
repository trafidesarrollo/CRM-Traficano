import { pgTable, text, serial, timestamp, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const opportunitiesTable = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  clientId: integer("client_id"),
  contactId: integer("contact_id"),
  salespersonId: integer("salesperson_id"),
  hunterId: integer("hunter_id"),
  farmerId: integer("farmer_id"),
  emailId: integer("email_id"),
  status: text("status", { enum: ["new", "quote_requested", "quoted", "negotiating", "won", "lost", "closed"] }).notNull().default("new"),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull().default("medium"),
  estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }),
  currency: text("currency").default("ARS"),
  description: text("description"),
  extractedProducts: jsonb("extracted_products"),
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
  stageEnteredAt: timestamp("stage_entered_at", { withTimezone: true }).notNull().defaultNow(),
  pipelineId: integer("pipeline_id"),
  stageId: integer("stage_id"),
  lostReason: text("lost_reason"),
  wonReason: text("won_reason"),
  competitors: jsonb("competitors").$type<string[]>(),
  coOwnerIds: jsonb("co_owner_ids").$type<number[]>(),
  expectedCloseDate: timestamp("expected_close_date", { mode: "date" }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOpportunitySchema = createInsertSchema(opportunitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Opportunity = typeof opportunitiesTable.$inferSelect;
