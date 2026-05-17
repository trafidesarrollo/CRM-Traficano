import { pgTable, text, serial, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// =============================================================================
// products (tabla original - se conserva para no romper código existente)
// =============================================================================
export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  code: text("code"),
  name: text("name").notNull(),
  description: text("description"),
  unit: text("unit"),
  category: text("category"),
  dimensions: text("dimensions"),
  standard: text("standard"),
  price: numeric("price", { precision: 12, scale: 2 }),
  currency: text("currency").default("ARS"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;

// =============================================================================
// products_accesorios — catálogo de accesorios (bridas, codos, tees, etc.)
// Migrado desde el ERP Traficaño "Accesorios.csv"
// =============================================================================
export const productsAccesoriosTable = pgTable("products_accesorios", {
  id: serial("id").primaryKey(),
  // "Código" del ERP (ej: "A0000324"). Único.
  code: text("code").notNull().unique(),
  // "Nombre" — descripción larga del accesorio
  name: text("name").notNull(),
  // "Tipo de accesorio" (BRIDA, CODO, TEE, etc.)
  accessoryType: text("accessory_type"),
  // "Subtipo" (ej: "SERIE 150", "SERIE 300")
  subtype: text("subtype"),
  // "Unidad de medida" (un, kg, etc.)
  unit: text("unit"),
  // Valores numéricos del accesorio (diámetro, espesor, etc.)
  value1: numeric("value1", { precision: 14, scale: 4 }),
  value2: numeric("value2", { precision: 14, scale: 4 }),
  value3: numeric("value3", { precision: 14, scale: 4 }),
  value4: numeric("value4", { precision: 14, scale: 4 }),
  value5: text("value5"),
  weight: numeric("weight", { precision: 14, scale: 4 }),
  // Norma (ASTM A 105 B16.5, etc.)
  standard: text("standard"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProductAccesorioSchema = createInsertSchema(productsAccesoriosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProductAccesorio = z.infer<typeof insertProductAccesorioSchema>;
export type ProductAccesorio = typeof productsAccesoriosTable.$inferSelect;

// =============================================================================
// products_medidas — catálogo de caños medidos (tubos, etc.)
// Migrado desde el ERP Traficaño "Medidas.csv"
// =============================================================================
export const productsMedidasTable = pgTable("products_medidas", {
  id: serial("id").primaryKey(),
  // "Código" del ERP (ej: "C0000001"). Único.
  code: text("code").notNull().unique(),
  // "Nombre" — descripción larga del caño
  name: text("name").notNull(),
  // Diámetro exterior en mm
  outerDiameter: numeric("outer_diameter", { precision: 14, scale: 4 }),
  // Espesor nominal en mm
  nominalThickness: numeric("nominal_thickness", { precision: 14, scale: 4 }),
  // Largo mínimo / máximo
  minLength: numeric("min_length", { precision: 14, scale: 4 }),
  maxLength: numeric("max_length", { precision: 14, scale: 4 }),
  // Tipo Costura (CCC, LF, etc.)
  seamType: text("seam_type"),
  // Tipo de Acero (SAE 1004/1008, ASTM A 106, etc.)
  steelType: text("steel_type"),
  // Tratamiento Térmico (LF, etc.)
  heatTreatment: text("heat_treatment"),
  // Norma (IRAM 500-2590, ASTM A 106, etc.)
  standard: text("standard"),
  // Forma (REDONDA, CUADRADA, etc.)
  shape: text("shape"),
  // Rubro
  category: text("category"),
  // Materia prima (mp, pt, etc.)
  rawMaterial: text("raw_material"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProductMedidaSchema = createInsertSchema(productsMedidasTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProductMedida = z.infer<typeof insertProductMedidaSchema>;
export type ProductMedida = typeof productsMedidasTable.$inferSelect;
