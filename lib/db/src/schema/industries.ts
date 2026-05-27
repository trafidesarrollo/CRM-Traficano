import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const industriesTable = pgTable("industries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Industry = typeof industriesTable.$inferSelect;
