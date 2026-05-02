import { pgTable, text, serial, timestamp, boolean, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const priceListsTable = pgTable("price_lists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("USD"),
  isPurchase: boolean("is_purchase").notNull().default(false),
  isSale: boolean("is_sale").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const priceListItemsTable = pgTable("price_list_items", {
  id: serial("id").primaryKey(),
  priceListId: integer("price_list_id").notNull(),
  productId: integer("product_id").notNull(),
  price: numeric("price", { precision: 14, scale: 4 }).notNull(),
  currency: text("currency"),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validTo: timestamp("valid_to", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPriceListSchema = createInsertSchema(priceListsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPriceList = z.infer<typeof insertPriceListSchema>;
export type PriceList = typeof priceListsTable.$inferSelect;
export type PriceListItem = typeof priceListItemsTable.$inferSelect;
