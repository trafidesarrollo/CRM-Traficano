import { pgTable, text, serial, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";

export const emailTemplatesTable = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").default("general"),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  variables: jsonb("variables").default([]),
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
