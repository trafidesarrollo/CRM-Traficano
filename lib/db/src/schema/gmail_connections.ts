import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gmailConnectionsTable = pgTable("gmail_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  email: text("email").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry", { withTimezone: true }),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastHistoryId: text("last_history_id"),
  syncStatus: text("sync_status", { enum: ["idle", "syncing", "error"] }).notNull().default("idle"),
  syncError: text("sync_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGmailConnectionSchema = createInsertSchema(gmailConnectionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGmailConnection = z.infer<typeof insertGmailConnectionSchema>;
export type GmailConnection = typeof gmailConnectionsTable.$inferSelect;
