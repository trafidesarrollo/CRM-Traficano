import { pgTable, text, serial, timestamp, integer, jsonb, boolean, unique } from "drizzle-orm/pg-core";

export const customFieldDefsTable = pgTable("custom_field_defs", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  fieldKey: text("field_key").notNull(),
  label: text("label").notNull(),
  fieldType: text("field_type").notNull(),
  options: jsonb("options"),
  isRequired: boolean("is_required").default(false),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({ uniq: unique().on(t.entityType, t.fieldKey) }));

export const customFieldValuesTable = pgTable("custom_field_values", {
  id: serial("id").primaryKey(),
  fieldDefId: integer("field_def_id"),
  entityId: integer("entity_id").notNull(),
  value: text("value"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({ uniq: unique().on(t.fieldDefId, t.entityId) }));
