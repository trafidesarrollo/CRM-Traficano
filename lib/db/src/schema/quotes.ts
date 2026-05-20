import { pgTable, text, serial, timestamp, integer, numeric, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quotesTable = pgTable("quotes", {
  id: serial("id").primaryKey(),
  number: text("number"),
  clientId: integer("client_id"),
  contactId: integer("contact_id"),
  opportunityId: integer("opportunity_id"),
  salespersonId: integer("salesperson_id"),
  priceListId: integer("price_list_id"),
  saleConditionId: integer("sale_condition_id"),
  cuit: text("cuit"),
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  deliveryDate: timestamp("delivery_date", { withTimezone: true }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  followupDate: timestamp("followup_date", { withTimezone: true }),
  currency: text("currency").notNull().default("USD"),
  exchangeRate: numeric("exchange_rate", { precision: 14, scale: 4 }).default("1"),
  exchangeRateType: text("exchange_rate_type").default("DIVISA VENTA BNA"),
  netAmount: numeric("net_amount", { precision: 14, scale: 2 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).default("0"),
  total: numeric("total", { precision: 14, scale: 2 }).default("0"),
  totalKg: numeric("total_kg", { precision: 14, scale: 4 }).default("0"),
  avgPricePerKg: numeric("avg_price_per_kg", { precision: 14, scale: 4 }).default("0"),
  quoteStatus: text("quote_status").default("EN PROCESO"),
  status: text("status", { enum: ["draft", "sent", "approved", "rejected", "partial", "expired"] }).notNull().default("draft"),
  priority: text("priority", { enum: ["NINGUNA", "BAJA", "MEDIA", "ALTA"] }).default("MEDIA"),
  quoteType: text("quote_type").default("COTIZACION"),
  orderType: text("order_type").default("REVENTA"),
  description: text("description"),
  internalNote: text("internal_note"),
  reference: text("reference"),
  purchaseOrder: text("purchase_order"),
  closeReason: text("close_reason"),
  createSchedule: boolean("create_schedule").default(false),
  pdfUrl: text("pdf_url"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const quoteLinesTable = pgTable("quote_lines", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").notNull(),
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
  discount: numeric("discount", { precision: 6, scale: 2 }).default("0"),
  netTotal: numeric("net_total", { precision: 14, scale: 2 }).default("0"),
  deliveryTime: text("delivery_time"),
  clientCode: text("client_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertQuoteSchema = createInsertSchema(quotesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotesTable.$inferSelect;
export type QuoteLine = typeof quoteLinesTable.$inferSelect;
