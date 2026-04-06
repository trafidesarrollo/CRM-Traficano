import { pgTable, text, serial, timestamp, integer, json } from "drizzle-orm/pg-core";
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
  status: text("status", { enum: ["active", "inactive", "prospect"] }).notNull().default("prospect"),
  assignedSalespersonId: integer("assigned_salesperson_id"),
  clientEmails: json("client_emails").$type<string[]>().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
