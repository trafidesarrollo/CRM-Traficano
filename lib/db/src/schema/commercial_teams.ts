import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commercialTeamsTable = pgTable("commercial_teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const commercialTeamMembersTable = pgTable("commercial_team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role", { enum: ["vendedor", "apoyo"] }).notNull().default("vendedor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommercialTeamSchema = createInsertSchema(commercialTeamsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCommercialTeam = z.infer<typeof insertCommercialTeamSchema>;
export type CommercialTeam = typeof commercialTeamsTable.$inferSelect;
export type CommercialTeamMember = typeof commercialTeamMembersTable.$inferSelect;
