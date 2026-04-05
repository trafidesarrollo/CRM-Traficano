import { db, emailsTable, clientsTable, contactsTable } from "@workspace/db";
import { eq, or, ilike } from "drizzle-orm";
import { callAI } from "./ai.js";

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

  if (payload.parts) {
    return extractBodyFromParts(payload.parts);
  }

  if (payload.body?.data) {
    return { text: decodeBase64(payload.body.data), html: "" };
  }

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
    if (part.parts) {
      attachments.push(...extractAttachments(part.parts));
    }
  }

  return attachments;
}

function parseEmailAddress(raw: string): { email: string; name?: string } {
  const match = raw.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim().replace(/"/g, ""), email: match[2].toLowerCase() };
  }
  return { email: raw.trim().toLowerCase() };
}

function getHeader(headers: { name: string; value: string }[], name: string): string | undefined {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
}

async function findClientByEmail(email: string): Promise<{ clientId: number | null; contactId: number | null }> {
  try {
    const domain = email.split("@")[1];
    if (!domain) return { clientId: null, contactId: null };

    const contacts = await db.select().from(contactsTable)
      .where(eq(contactsTable.email, email))
      .limit(1);

    if (contacts[0]) {
      return { clientId: contacts[0].clientId, contactId: contacts[0].id };
    }

    const clients = await db.select().from(clientsTable)
      .where(ilike(clientsTable.website, `%${domain}%`))
      .limit(1);

    if (clients[0]) {
      return { clientId: clients[0].id, contactId: null };
    }

    return { clientId: null, contactId: null };
  } catch {
    return { clientId: null, contactId: null };
  }
}

export interface SyncOptions {
  maxResults?: number;
  query?: string;
  pageToken?: string;
}

export interface SyncResult {
  synced: number;
  classified: number;
  errors: number;
  skipped: number;
  nextPageToken?: string;
  historyId?: string;
}

export async function syncGmailMessages(
  accessToken: string,
  accountEmail: string,
  userId: number,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const maxResults = options.maxResults || 50;
  const query = options.query || "";
  let synced = 0;
  let classified = 0;
  let errors = 0;
  let skipped = 0;
  let nextPageToken: string | undefined;
  let latestHistoryId: string | undefined;

  const params = new URLSearchParams({
    maxResults: String(maxResults),
  });
  if (query) params.set("q", query);
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
  const messages: { id: string; threadId: string }[] = listData.messages || [];
  nextPageToken = listData.nextPageToken;

  for (const msg of messages) {
    try {
      const existing = await db.select({ id: emailsTable.id })
        .from(emailsTable)
        .where(eq(emailsTable.gmailMessageId, msg.id))
        .limit(1);

      if (existing[0]) {
        skipped++;
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

      if (!latestHistoryId || BigInt(msgData.historyId) > BigInt(latestHistoryId)) {
        latestHistoryId = msgData.historyId;
      }

      const subject = getHeader(headers, "subject") || "(Sin asunto)";
      const fromRaw = getHeader(headers, "from") || "";
      const toRaw = getHeader(headers, "to") || accountEmail;
      const ccRaw = getHeader(headers, "cc") || "";
      const dateRaw = getHeader(headers, "date");
      const messageIdHeader = getHeader(headers, "message-id");

      const { email: fromEmail, name: fromName } = parseEmailAddress(fromRaw);
      const { email: toEmail } = parseEmailAddress(toRaw.split(",")[0].trim());

      const isSent = msgData.labelIds?.includes("SENT") || false;
      const direction = isSent ? "outbound" as const : "inbound" as const;

      const { text, html } = getEmailBody(msgData);
      const body = text || html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "(Sin contenido)";

      const attachments = extractAttachments(msgData.payload.parts);
      const hasAttachments = attachments.length > 0;

      const labels = (msgData.labelIds || []).join(",");

      let category: string | undefined;
      let categoryConfidence: string | undefined;

      if (direction === "inbound") {
        try {
          const classification = await callAI("classification", body.substring(0, 3000), subject);
          category = classification.category;
          categoryConfidence = String(classification.confidence || 0.5);
          classified++;
        } catch {
          category = "other";
          categoryConfidence = "0.5";
        }
      }

      const { clientId, contactId } = await findClientByEmail(fromEmail);

      await db.insert(emailsTable).values({
        gmailMessageId: msg.id,
        gmailThreadId: msgData.threadId,
        gmailHistoryId: msgData.historyId,
        subject,
        fromEmail,
        fromName,
        toEmail,
        ccEmail: ccRaw || undefined,
        body: body.substring(0, 50000),
        bodyHtml: html ? html.substring(0, 100000) : undefined,
        direction,
        receivedAt: dateRaw ? new Date(dateRaw) : new Date(parseInt(msgData.internalDate)),
        category: category as any,
        categoryConfidence,
        categoryConfirmed: false,
        status: "pending",
        clientId,
        contactId,
        attachments: hasAttachments ? attachments : undefined,
        hasAttachments,
        gmailLabels: labels || undefined,
      });

      synced++;
    } catch (msgErr: any) {
      errors++;
    }
  }

  return { synced, classified, errors, skipped, nextPageToken, historyId: latestHistoryId };
}

export async function sendGmailReply(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  bodyHtml: string,
  threadId?: string,
  inReplyTo?: string,
): Promise<{ messageId: string; threadId: string }> {
  const boundary = "boundary_" + Date.now();

  let headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
    headers.push(`References: ${inReplyTo}`);
  }

  const rawMessage = [
    headers.join("\r\n"),
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    bodyHtml || body.replace(/\n/g, "<br>"),
    `--${boundary}--`,
  ].join("\r\n");

  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const sendBody: any = { raw: encodedMessage };
  if (threadId) sendBody.threadId = threadId;

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sendBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gmail send error ${response.status}: ${errText}`);
  }

  const result = await response.json() as any;
  return { messageId: result.id, threadId: result.threadId };
}

export async function getGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<{ data: string; size: number }> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    throw new Error(`Gmail attachment error: ${response.status}`);
  }

  const result = await response.json() as any;
  return { data: result.data, size: result.size };
}
