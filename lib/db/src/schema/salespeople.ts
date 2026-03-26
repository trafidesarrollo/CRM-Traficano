import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salespeopleTable = pgTable("salespeople", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  territory: text("territory"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSalespersonSchema = createInsertSchema(salespeopleTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesperson = z.infer<typeof insertSalespersonSchema>;
export type Salesperson = typeof salespeopleTable.$inferSelect;
