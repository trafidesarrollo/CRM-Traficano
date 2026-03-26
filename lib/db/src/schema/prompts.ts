import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const promptsTable = pgTable("prompts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["classification", "extraction", "reply_draft"] }).notNull(),
  content: text("content").notNull(),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPromptSchema = createInsertSchema(promptsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPrompt = z.infer<typeof insertPromptSchema>;
export type Prompt = typeof promptsTable.$inferSelect;
