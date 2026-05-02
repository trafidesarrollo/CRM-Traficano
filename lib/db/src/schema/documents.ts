import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  storageKey: text("storage_key").notNull(),
  description: text("description"),
  uploadedBy: integer("uploaded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
