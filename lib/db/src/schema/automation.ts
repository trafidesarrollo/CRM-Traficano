import { pgTable, text, serial, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";

export const automationRulesTable = pgTable("automation_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  triggerEvent: text("trigger_event").notNull(),
  conditions: jsonb("conditions").default([]),
  actions: jsonb("actions").default([]),
  isActive: boolean("is_active").default(true),
  runCount: integer("run_count").default(0),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const automationLogsTable = pgTable("automation_logs", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id"),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  status: text("status"),
  message: text("message"),
  executedAt: timestamp("executed_at", { withTimezone: true }).defaultNow(),
});
