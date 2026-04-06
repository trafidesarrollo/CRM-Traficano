import { pgTable, text, serial, timestamp, integer, boolean, json, index, uniqueIndex } from "drizzle-orm/pg-core";

export const conversationStatusEnum = ["nuevo", "sin_asignar", "en_gestion", "esperando_cliente", "esperando_interno", "resuelto", "archivado"] as const;
export const conversationPriorityEnum = ["urgente", "alta", "normal", "baja"] as const;
export const conversationTypeEnum = ["consulta_comercial", "pedido_cotizacion", "seguimiento", "reclamo", "postventa", "proveedor", "interno", "irrelevante"] as const;
export const nextActionTypeEnum = ["llamar", "responder_email", "enviar_cotizacion", "esperar_respuesta", "reenviar_interno", "agendar_reunion", "otro"] as const;

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  gmailThreadId: text("gmail_thread_id").unique().notNull(),
  subject: text("subject").notNull(),
  snippet: text("snippet"),
  type: text("type", { enum: conversationTypeEnum }).default("consulta_comercial"),
  status: text("status", { enum: conversationStatusEnum }).notNull().default("nuevo"),
  priority: text("priority", { enum: conversationPriorityEnum }).notNull().default("normal"),
  clientId: integer("client_id"),
  contactId: integer("contact_id"),
  opportunityId: integer("opportunity_id"),
  assignedToId: integer("assigned_to_id"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
  lastOutboundAt: timestamp("last_outbound_at", { withTimezone: true }),
  firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
  messageCount: integer("message_count").notNull().default(0),
  unreadCount: integer("unread_count").notNull().default(0),
  nextActionType: text("next_action_type", { enum: nextActionTypeEnum }),
  nextActionDate: timestamp("next_action_date", { withTimezone: true }),
  nextActionAssigneeId: integer("next_action_assignee_id"),
  nextActionNotes: text("next_action_notes"),
  aiSummary: text("ai_summary"),
  tags: json("tags").$type<string[]>().default([]),
  fromEmail: text("from_email"),
  fromName: text("from_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_conversations_status").on(table.status),
  index("idx_conversations_last_message").on(table.lastMessageAt),
  index("idx_conversations_assigned").on(table.assignedToId),
  index("idx_conversations_client").on(table.clientId),
]);

export type Conversation = typeof conversationsTable.$inferSelect;
export type InsertConversation = typeof conversationsTable.$inferInsert;

export const conversationMessagesTable = pgTable("conversation_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  gmailMessageId: text("gmail_message_id").unique().notNull(),
  direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  toEmails: json("to_emails").$type<string[]>().default([]),
  ccEmails: json("cc_emails").$type<string[]>().default([]),
  subject: text("subject"),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  hasAttachments: boolean("has_attachments").notNull().default(false),
  attachments: json("attachments").$type<any[]>(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_conv_messages_conversation").on(table.conversationId),
  index("idx_conv_messages_received").on(table.receivedAt),
]);

export type ConversationMessage = typeof conversationMessagesTable.$inferSelect;
export type InsertConversationMessage = typeof conversationMessagesTable.$inferInsert;

export const conversationEventsTable = pgTable("conversation_events", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  userId: integer("user_id"),
  eventType: text("event_type", {
    enum: ["created", "status_change", "priority_change", "assignment", "message_received", "message_sent", "linked_client", "linked_opportunity", "tag_added", "archived"]
  }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_conv_events_conversation").on(table.conversationId),
]);

export type ConversationEvent = typeof conversationEventsTable.$inferSelect;
