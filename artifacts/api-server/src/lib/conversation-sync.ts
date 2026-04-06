import {
  db,
  conversationsTable,
  conversationMessagesTable,
  conversationEventsTable,
  clientsTable,
  contactsTable,
} from "@workspace/db";
import { eq, ilike } from "drizzle-orm";

interface GmailMessagePart {
  mimeType: string;
  filename?: string;
  body: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailMessagePart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  historyId: string;
  labelIds: string[];
  payload: {
    headers: { name: string; value: string }[];
    body: { data?: string; size?: number };
    parts?: GmailMessagePart[];
    mimeType: string;
  };
  internalDate: string;
}

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractBodyFromParts(parts: GmailMessagePart[]): { text: string; html: string } {
  let text = "";
  let html = "";
  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body.data) {
      text = decodeBase64(part.body.data);
    } else if (part.mimeType === "text/html" && part.body.data) {
      html = decodeBase64(part.body.data);
    } else if (part.mimeType?.startsWith("multipart/") && part.parts) {
      const nested = extractBodyFromParts(part.parts);
      if (!text && nested.text) text = nested.text;
      if (!html && nested.html) html = nested.html;
    }
  }
  return { text, html };
}

function getEmailBody(message: GmailMessage): { text: string; html: string } {
  const payload = message.payload;
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return { text: decodeBase64(payload.body.data), html: "" };
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return { text: "", html: decodeBase64(payload.body.data) };
  }
  if (payload.parts) return extractBodyFromParts(payload.parts);
  if (payload.body?.data) return { text: decodeBase64(payload.body.data), html: "" };
  return { text: "", html: "" };
}

function extractAttachments(parts: GmailMessagePart[] | undefined): any[] {
  if (!parts) return [];
  const attachments: any[] = [];
  for (const part of parts) {
    if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId,
      });
    }
    if (part.parts) attachments.push(...extractAttachments(part.parts));
  }
  return attachments;
}

function parseEmailAddress(raw: string): { email: string; name?: string } {
  const match = raw.match(/^(.*?)\s*<(.+?)>$/);
  if (match) return { name: match[1].trim().replace(/"/g, ""), email: match[2].toLowerCase() };
  return { email: raw.trim().toLowerCase() };
}

function parseMultipleEmails(raw: string): string[] {
  if (!raw) return [];
  return raw.split(",").map(e => parseEmailAddress(e.trim()).email).filter(Boolean);
}

function getHeader(headers: { name: string; value: string }[], name: string): string | undefined {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
}

async function findClientByEmail(email: string): Promise<{ clientId: number | null; contactId: number | null }> {
  try {
    const domain = email.split("@")[1];
    if (!domain) return { clientId: null, contactId: null };

    const contacts = await db.select().from(contactsTable)
      .where(eq(contactsTable.email, email)).limit(1);
    if (contacts[0]) return { clientId: contacts[0].clientId, contactId: contacts[0].id };

    const clients = await db.select().from(clientsTable)
      .where(ilike(clientsTable.website, `%${domain}%`)).limit(1);
    if (clients[0]) return { clientId: clients[0].id, contactId: null };

    return { clientId: null, contactId: null };
  } catch {
    return { clientId: null, contactId: null };
  }
}

export interface ConversationSyncResult {
  conversationsCreated: number;
  conversationsUpdated: number;
  messagesCreated: number;
  duplicatesSkipped: number;
  errors: number;
}

export async function syncGmailToConversations(
  accessToken: string,
  accountEmail: string,
  options: { maxResults?: number; query?: string; pageToken?: string } = {},
): Promise<ConversationSyncResult> {
  const maxResults = options.maxResults || 50;
  let conversationsCreated = 0;
  let conversationsUpdated = 0;
  let messagesCreated = 0;
  let duplicatesSkipped = 0;
  let errors = 0;

  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (options.query) params.set("q", options.query);
  if (options.pageToken) params.set("pageToken", options.pageToken);

  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!listResponse.ok) {
    const errText = await listResponse.text();
    throw new Error(`Gmail API error ${listResponse.status}: ${errText}`);
  }

  const listData = await listResponse.json() as any;
  const gmailMessages: { id: string; threadId: string }[] = listData.messages || [];

  for (const msg of gmailMessages) {
    try {
      const existingMsg = await db.select({ id: conversationMessagesTable.id })
        .from(conversationMessagesTable)
        .where(eq(conversationMessagesTable.gmailMessageId, msg.id))
        .limit(1);

      if (existingMsg[0]) {
        duplicatesSkipped++;
        continue;
      }

      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!msgResponse.ok) {
        errors++;
        continue;
      }

      const msgData = await msgResponse.json() as GmailMessage;
      const headers = msgData.payload.headers;

      const subject = getHeader(headers, "subject") || "(Sin asunto)";
      const fromRaw = getHeader(headers, "from") || "";
      const toRaw = getHeader(headers, "to") || accountEmail;
      const ccRaw = getHeader(headers, "cc") || "";
      const dateRaw = getHeader(headers, "date");

      const { email: fromEmail, name: fromName } = parseEmailAddress(fromRaw);
      const toEmails = parseMultipleEmails(toRaw);
      const ccEmails = parseMultipleEmails(ccRaw);

      const isSent = msgData.labelIds?.includes("SENT") || false;
      const direction = isSent ? "outbound" as const : "inbound" as const;

      const { text, html } = getEmailBody(msgData);
      const bodyText = text || html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "";

      const attachmentsList = extractAttachments(msgData.payload.parts);
      const hasAttachments = attachmentsList.length > 0;

      const receivedAt = dateRaw ? new Date(dateRaw) : new Date(parseInt(msgData.internalDate));

      const snippet = bodyText.substring(0, 200);

      const existingConv = await db.select()
        .from(conversationsTable)
        .where(eq(conversationsTable.gmailThreadId, msgData.threadId))
        .limit(1);

      let conversationId: number;

      if (existingConv[0]) {
        conversationId = existingConv[0].id;

        const updates: any = {
          messageCount: existingConv[0].messageCount + 1,
          snippet,
          updatedAt: new Date(),
        };

        if (!existingConv[0].lastMessageAt || receivedAt > existingConv[0].lastMessageAt) {
          updates.lastMessageAt = receivedAt;
        }
        if (direction === "inbound") {
          if (!existingConv[0].lastInboundAt || receivedAt > existingConv[0].lastInboundAt) {
            updates.lastInboundAt = receivedAt;
          }
          updates.unreadCount = (existingConv[0].unreadCount || 0) + 1;
        }
        if (direction === "outbound") {
          if (!existingConv[0].lastOutboundAt || receivedAt > existingConv[0].lastOutboundAt) {
            updates.lastOutboundAt = receivedAt;
          }
          if (!existingConv[0].firstResponseAt && existingConv[0].lastInboundAt) {
            updates.firstResponseAt = receivedAt;
          }
        }

        await db.update(conversationsTable)
          .set(updates)
          .where(eq(conversationsTable.id, conversationId));

        conversationsUpdated++;
      } else {
        const { clientId, contactId } = direction === "inbound"
          ? await findClientByEmail(fromEmail)
          : { clientId: null, contactId: null };

        const [conv] = await db.insert(conversationsTable).values({
          gmailThreadId: msgData.threadId,
          subject,
          snippet,
          status: "nuevo",
          priority: "normal",
          clientId,
          contactId,
          lastMessageAt: receivedAt,
          lastInboundAt: direction === "inbound" ? receivedAt : undefined,
          lastOutboundAt: direction === "outbound" ? receivedAt : undefined,
          messageCount: 1,
          unreadCount: direction === "inbound" ? 1 : 0,
          fromEmail,
          fromName,
        }).returning();

        conversationId = conv.id;
        conversationsCreated++;

        await db.insert(conversationEventsTable).values({
          conversationId,
          eventType: "created",
          newValue: "nuevo",
          metadata: { fromEmail, subject },
        });
      }

      await db.insert(conversationMessagesTable).values({
        conversationId,
        gmailMessageId: msg.id,
        direction,
        fromEmail,
        fromName,
        toEmails,
        ccEmails,
        subject,
        bodyText: bodyText.substring(0, 50000),
        bodyHtml: html ? html.substring(0, 100000) : undefined,
        hasAttachments,
        attachments: hasAttachments ? attachmentsList : undefined,
        receivedAt,
      });

      messagesCreated++;

      await db.insert(conversationEventsTable).values({
        conversationId,
        eventType: direction === "inbound" ? "message_received" : "message_sent",
        newValue: fromEmail,
        metadata: { subject, direction },
      });

    } catch (err: any) {
      errors++;
    }
  }

  return { conversationsCreated, conversationsUpdated, messagesCreated, duplicatesSkipped, errors };
}
