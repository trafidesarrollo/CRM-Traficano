import { pgTable, text, serial, timestamp, integer, json } from "drizzle-orm/pg-core";

export const anuraWebhooksTable = pgTable("anura_webhooks", {
  id: serial("id").primaryKey(),
  event: text("event"),
  externalCallId: text("external_call_id"),
  phone: text("phone"),
  toNumber: text("to_number"),
  direction: text("direction"),
  status: text("status"),
  durationSeconds: integer("duration_seconds"),
  agentId: text("agent_id"),
  recordingUrl: text("recording_url"),
  occurredAt: text("occurred_at"),
  rawPayload: json("raw_payload").notNull(),
  clientId: integer("client_id"),
  salespersonId: integer("salesperson_id"),
  notes: text("notes"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});
