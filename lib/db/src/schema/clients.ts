import { pgTable, text, serial, timestamp, integer, json, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  taxId: text("tax_id"),
  industry: text("industry"),
  website: text("website"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  // prospect → potential → final (by OC). inactive if scale=0. Admin can override.
  status: text("status", { enum: ["prospect", "potential", "inactive", "final"] }).notNull().default("prospect"),
  assignedSalespersonId: integer("assigned_salesperson_id"),
  assignedUserId: integer("assigned_user_id"),
  assignedTeamId: integer("assigned_team_id"),
  clientEmails: json("client_emails").$type<string[]>().default([]),
  notes: text("notes"),
  // Proyección de consumo anual en USD (solo visible cuando status >= potential)
  consumptionScale: numeric("consumption_scale"),
  externalId: text("external_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
