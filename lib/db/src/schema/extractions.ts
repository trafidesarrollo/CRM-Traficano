import { pgTable, text, serial, timestamp, integer, numeric, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const extractionsTable = pgTable("extractions", {
  id: serial("id").primaryKey(),
  emailId: integer("email_id").notNull(),
  opportunityId: integer("opportunity_id"),
  originalText: text("original_text").notNull(),
  normalizedMeasurement: text("normalized_measurement"),
  detectedStandard: text("detected_standard"),
  detectedQuantity: numeric("detected_quantity"),
  detectedUnit: text("detected_unit"),
  suggestedFamily: text("suggested_family"),
  suggestedProductId: integer("suggested_product_id"),
  matchType: text("match_type", { enum: ["exact", "approximate", "no_match", "manual"] }),
  matchScore: numeric("match_score", { precision: 5, scale: 2 }),
  status: text("status", { enum: ["pending", "accepted", "corrected", "rejected"] }).notNull().default("pending"),
  correctedProductId: integer("corrected_product_id"),
  correctedByUserId: integer("corrected_by_user_id"),
  promptVersionId: integer("prompt_version_id"),
  rawAiOutput: jsonb("raw_ai_output"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const productEquivalencesTable = pgTable("product_equivalences", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  alias: text("alias").notNull(),
  aliasType: text("alias_type", { enum: ["measurement", "standard", "name", "code", "description"] }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExtractionSchema = createInsertSchema(extractionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExtraction = z.infer<typeof insertExtractionSchema>;
export type Extraction = typeof extractionsTable.$inferSelect;

export const insertProductEquivalenceSchema = createInsertSchema(productEquivalencesTable).omit({ id: true, createdAt: true });
export type InsertProductEquivalence = z.infer<typeof insertProductEquivalenceSchema>;
export type ProductEquivalence = typeof productEquivalencesTable.$inferSelect;
