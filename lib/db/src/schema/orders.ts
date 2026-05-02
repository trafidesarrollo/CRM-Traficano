import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  number: text("number"),
  quoteId: integer("quote_id"),
  clientId: integer("client_id"),
  contactId: integer("contact_id"),
  salespersonId: integer("salesperson_id"),
  priceListId: integer("price_list_id"),
  saleConditionId: integer("sale_condition_id"),
  cuit: text("cuit"),
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  deliveryDate: timestamp("delivery_date", { withTimezone: true }),
  currency: text("currency").notNull().default("USD"),
  exchangeRate: numeric("exchange_rate", { precision: 14, scale: 4 }).default("1"),
  exchangeRateType: text("exchange_rate_type").default("DIVISA VENTA BNA"),
  netAmount: numeric("net_amount", { precision: 14, scale: 2 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).default("0"),
  total: numeric("total", { precision: 14, scale: 2 }).default("0"),
  totalKg: numeric("total_kg", { precision: 14, scale: 4 }).default("0"),
  avgPricePerKg: numeric("avg_price_per_kg", { precision: 14, scale: 4 }).default("0"),
  orderStatus: text("order_status").default("PENDIENTE"),
  status: text("status", { enum: ["draft", "confirmed", "in_production", "shipped", "delivered", "invoiced", "cancelled"] }).notNull().default("draft"),
  isUrgent: boolean("is_urgent").default(false),
  isAuthorized: boolean("is_authorized").default(false),
  orderType: text("order_type").default("REVENTA"),
  description: text("description"),
  internalNote: text("internal_note"),
  purchaseOrder: text("purchase_order"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const orderLinesTable = pgTable("order_lines", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  quoteLineId: integer("quote_line_id"),
  lineNumber: integer("line_number"),
  productType: text("product_type"),
  productId: integer("product_id"),
  productName: text("product_name"),
  productCode: text("product_code"),
  description: text("description"),
  unit: text("unit"),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull().default("1"),
  quantityKg: numeric("quantity_kg", { precision: 14, scale: 4 }).default("0"),
  unitPrice: numeric("unit_price", { precision: 14, scale: 4 }).notNull().default("0"),
  unitPriceUm: numeric("unit_price_um", { precision: 14, scale: 4 }).default("0"),
  netTotal: numeric("net_total", { precision: 14, scale: 2 }).default("0"),
  deliveryTime: text("delivery_time"),
  clientCode: text("client_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const saleConditionsTable = pgTable("sale_conditions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  daysToPay: integer("days_to_pay").default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderLine = typeof orderLinesTable.$inferSelect;
export type SaleCondition = typeof saleConditionsTable.$inferSelect;
