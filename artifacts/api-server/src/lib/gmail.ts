import { db, emailsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { callAI } from "./ai.js";

interface GmailMessage {
  id: string;
  threadId: string;
  payload: {
    headers: { name: string; value: string }[];
    body: { data?: string };
    parts?: { mimeType: string; body: { data?: string } }[];
  };
  internalDate: string;
}

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function getEmailBody(message: GmailMessage): { text: string; html: string } {
  const payload = message.payload;
  let text = "";
  let html = "";

  if (payload.body?.data) {
    text = decodeBase64(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body.data) {
        text = decodeBase64(part.body.data);
      } else if (part.mimeType === "text/html" && part.body.data) {
        html = decodeBase64(part.body.data);
      }
    }
  }

  return { text, html };
}

export async function syncGmailMessages(accessToken: string, accountEmail: string, userId: number): Promise<{ synced: number; classified: number; errors: number }> {
  let synced = 0;
  let classified = 0;
  let errors = 0;

  try {
    const listResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=is:unread",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listResponse.ok) {
      throw new Error(`Gmail API error: ${listResponse.status}`);
    }

    const listData = await listResponse.json() as any;
    const messages = listData.messages || [];

    for (const msg of messages) {
      try {
        const existing = await db.select().from(emailsTable)
          .where(eq(emailsTable.gmailMessageId, msg.id))
          .limit(1);

        if (existing[0]) continue;

        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!msgResponse.ok) continue;

        const msgData = await msgResponse.json() as GmailMessage;
        const headers = msgData.payload.headers;

        const subject = headers.find(h => h.name.toLowerCase() === "subject")?.value || "(Sin asunto)";
        const from = headers.find(h => h.name.toLowerCase() === "from")?.value || "";
        const to = headers.find(h => h.name.toLowerCase() === "to")?.value || accountEmail;
        const date = headers.find(h => h.name.toLowerCase() === "date")?.value;

        let fromEmail = from;
        let fromName: string | undefined;
        const emailMatch = from.match(/^(.*?)\s*<(.+?)>$/);
        if (emailMatch) {
          fromName = emailMatch[1].trim().replace(/"/g, "");
          fromEmail = emailMatch[2];
        }

        const { text, html } = getEmailBody(msgData);
        const body = text || html.replace(/<[^>]*>/g, "") || "(Sin contenido)";

        let category: string | undefined;
        let categoryConfidence: string | undefined;

        try {
          const classification = await callAI("classification", body, subject);
          category = classification.category;
          categoryConfidence = String(classification.confidence || 0.5);
          classified++;
        } catch {
          category = "other";
          categoryConfidence = "0.5";
        }

        await db.insert(emailsTable).values({
          gmailMessageId: msg.id,
          gmailThreadId: msg.threadId || msgData.threadId,
          subject,
          fromEmail,
          fromName,
          toEmail: to.includes("<") ? to.match(/<(.+?)>/)?.[1] || to : to,
          body,
          bodyHtml: html || undefined,
          receivedAt: date ? new Date(date) : new Date(parseInt(msgData.internalDate)),
          category: category as any,
          categoryConfidence: categoryConfidence,
          categoryConfirmed: false,
          status: "pending",
        });

        synced++;
      } catch (msgErr) {
        errors++;
      }
    }
  } catch (err) {
    throw err;
  }

  return { synced, classified, errors };
}
