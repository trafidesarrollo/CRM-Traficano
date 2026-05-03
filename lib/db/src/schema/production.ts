import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productionLocationsTable = pgTable("production_locations", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productionOrdersTable = pgTable("production_orders", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  productId: integer("product_id"),
  productName: text("product_name"),
  orderId: integer("order_id"),
  locationId: integer("location_id"),
  plannedQty: numeric("planned_qty", { precision: 14, scale: 4 }).notNull().default("0"),
  producedQty: numeric("produced_qty", { precision: 14, scale: 4 }).notNull().default("0"),
  rejectedQty: numeric("rejected_qty", { precision: 14, scale: 4 }).notNull().default("0"),
  unit: text("unit").default("u"),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull().default("medium"),
  status: text("status", { enum: ["pending", "in_progress", "completed", "cancelled"] }).notNull().default("pending"),
  plannedStart: timestamp("planned_start", { withTimezone: true }),
  plannedEnd: timestamp("planned_end", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const productionRecordsTable = pgTable("production_records", {
  id: serial("id").primaryKey(),
  productionOrderId: integer("production_order_id").notNull(),
  locationId: integer("location_id"),
  operatorId: integer("operator_id"),
  operatorName: text("operator_name"),
  qtyProduced: numeric("qty_produced", { precision: 14, scale: 4 }).notNull().default("0"),
  qtyRejected: numeric("qty_rejected", { precision: 14, scale: 4 }).notNull().default("0"),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  durationMin: numeric("duration_min", { precision: 10, scale: 2 }),
  notes: text("notes"),
  incident: text("incident"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProductionLocationSchema = createInsertSchema(productionLocationsTable).omit({ id: true, createdAt: true });
export const insertProductionOrderSchema = createInsertSchema(productionOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductionRecordSchema = createInsertSchema(productionRecordsTable).omit({ id: true, createdAt: true });

export type ProductionLocation = typeof productionLocationsTable.$inferSelect;
export type ProductionOrder = typeof productionOrdersTable.$inferSelect;
export type ProductionRecord = typeof productionRecordsTable.$inferSelect;
export type InsertProductionLocation = z.infer<typeof insertProductionLocationSchema>;
export type InsertProductionOrder = z.infer<typeof insertProductionOrderSchema>;
export type InsertProductionRecord = z.infer<typeof insertProductionRecordSchema>;
