import { pgTable, serial, integer, numeric, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salesTargetsTable = pgTable("sales_targets", {
  id: serial("id").primaryKey(),
  salespersonId: integer("salesperson_id").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  targetAmount: numeric("target_amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  uniqueSpMonth: unique().on(t.salespersonId, t.year, t.month),
}));

export const insertSalesTargetSchema = createInsertSchema(salesTargetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesTarget = z.infer<typeof insertSalesTargetSchema>;
export type SalesTarget = typeof salesTargetsTable.$inferSelect;
