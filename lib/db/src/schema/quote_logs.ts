import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const quoteLogsTable = pgTable("quote_logs", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").notNull(),
  userId: integer("user_id"),
  userName: text("user_name"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type QuoteLog = typeof quoteLogsTable.$inferSelect;
