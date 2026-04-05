import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const importLogsTable = pgTable("import_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  entityType: text("entity_type").notNull(),
  fileName: text("file_name"),
  totalRows: integer("total_rows").notNull().default(0),
  insertedRows: integer("inserted_rows").notNull().default(0),
  updatedRows: integer("updated_rows").notNull().default(0),
  errorRows: integer("error_rows").notNull().default(0),
  skippedRows: integer("skipped_rows").notNull().default(0),
  mode: text("mode", { enum: ["insert", "update", "upsert"] }).notNull().default("insert"),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).notNull().default("pending"),
  columnMapping: jsonb("column_mapping"),
  errorDetails: jsonb("error_details"),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertImportLogSchema = createInsertSchema(importLogsTable).omit({ id: true, createdAt: true });
export type InsertImportLog = z.infer<typeof insertImportLogSchema>;
export type ImportLog = typeof importLogsTable.$inferSelect;
