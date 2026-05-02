import { Router, type IRouter } from "express";
import { db, gmailConnectionsTable, emailsTable, activitiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../middleware/auth.js";
import { auditAction } from "../lib/audit.js";

const router: IRouter = Router();

function getGmailConfig() {
  return {
    clientId: process.env.GMAIL_CLIENT_ID || "",
    clientSecret: process.env.GMAIL_CLIENT_SECRET || "",
    redirectUri: process.env.GMAIL_REDIRECT_URI || `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost"}/api/gmail/callback`,
  };
}

async function refreshAccessToken(connection: any): Promise<string> {
  if (!connection.refreshToken) {
    throw new Error("No hay refresh token. Reconecte Gmail.");
  }

  const config = getGmailConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokens = await response.json() as any;
  if (!tokens.access_token) {
    throw new Error("No se pudo renovar el token de Gmail. Reconecte la cuenta.");
  }

  await db.update(gmailConnectionsTable).set({
    accessToken: tokens.access_token,
    tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
  }).where(eq(gmailConnectionsTable.id, connection.id));

  return tokens.access_token;
}

async function getValidAccessToken(connection: any): Promise<string> {
  if (connection.tokenExpiry && new Date(connection.tokenExpiry) < new Date()) {
    return refreshAccessToken(connection);
  }
  return connection.accessToken;
}

router.get("/gmail/connect", (req, res) => {
  const config = getGmailConfig();
  if (!config.clientId || !config.clientSecret) {
    res.status(400).json({ error: "Gmail no configurado. Configure GMAIL_CLIENT_ID y GMAIL_CLIENT_SECRET en Configuración." });
    return;
  }

  const scope = encodeURIComponent("https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar");
  const userId = (req as any).userId;
  const nonce = require("crypto").randomBytes(24).toString("hex");
  const sess = (req as any).session;
  if (sess) {
    sess.gmailOAuthState = { nonce, userId, exp: Date.now() + 10 * 60 * 1000 };
  }
  const state = `${nonce}.${userId}`;
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
  res.json({ authUrl });
});

router.get("/gmail/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      res.status(400).json({ error: "Código de autorización faltante" });
      return;
    }

    const config = getGmailConfig();
    if (!config.clientId || !config.clientSecret) {
      res.status(400).json({ error: "Gmail no configurado." });
      return;
    }

    const stateStr = String(state || "");
    const [nonce, userIdStr] = stateStr.split(".");
    const userId = parseInt(userIdStr || "");
    if (!userId || isNaN(userId) || !nonce) {
      res.status(400).json({ error: "Estado de autenticación inválido" });
      return;
    }
    const sess = (req as any).session;
    const stored = sess?.gmailOAuthState;
    if (!stored || stored.nonce !== nonce || stored.userId !== userId || stored.exp < Date.now()) {
      res.status(400).json({ error: "Estado de OAuth inválido o vencido. Reintentá la conexión." });
      return;
    }
    if (sess) delete sess.gmailOAuthState;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResponse.json() as any;
    if (!tokens.access_token) {
      req.log.error({ tokenError: tokens }, "Gmail token exchange failed");
      res.status(400).json({ error: "Error al obtener tokens de Gmail" });
      return;
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileResponse.json() as any;

    const existing = await db.select().from(gmailConnectionsTable).where(eq(gmailConnectionsTable.userId, userId)).limit(1);

    if (existing[0]) {
      await db.update(gmailConnectionsTable).set({
        email: profile.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || existing[0].refreshToken,
        tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        syncStatus: "idle",
        syncError: null,
      }).where(eq(gmailConnectionsTable.userId, userId));
    } else {
      await db.insert(gmailConnectionsTable).values({
        userId,
        email: profile.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
      });
    }

    await auditAction(req, "gmail_conectar", "gmail_connection", undefined, { email: profile.email, userId });

    const redirectUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/gmail?connected=true`
      : "/gmail?connected=true";
    res.redirect(redirectUrl);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error en callback de Gmail" });
  }
});

router.get("/gmail/status", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const connections = await db.select().from(gmailConnectionsTable).where(eq(gmailConnectionsTable.userId, userId)).limit(1);
    if (!connections[0]) {
      res.json({ connected: false, email: null, lastSyncAt: null, status: "desconectada" });
      return;
    }

    let status = connections[0].syncStatus === "error" ? "error" : "conectada";
    if (connections[0].tokenExpiry && new Date(connections[0].tokenExpiry) < new Date()) {
      if (connections[0].refreshToken) {
        status = "token_vencido_renovable";
      } else {
        status = "reconectar_requerida";
      }
    }

    res.json({
      connected: true,
      email: connections[0].email,
      lastSyncAt: connections[0].lastSyncAt,
      status,
      syncError: connections[0].syncError,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener estado de Gmail" });
  }
});

router.post("/gmail/sync", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const connections = await db.select().from(gmailConnectionsTable).where(eq(gmailConnectionsTable.userId, userId)).limit(1);
    if (!connections[0]) {
      res.status(400).json({ error: "Gmail no conectado" });
      return;
    }

    await db.update(gmailConnectionsTable)
      .set({ syncStatus: "syncing", syncError: null })
      .where(eq(gmailConnectionsTable.id, connections[0].id));

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(connections[0]);
    } catch (refreshErr: any) {
      await db.update(gmailConnectionsTable)
        .set({ syncStatus: "error", syncError: refreshErr.message })
        .where(eq(gmailConnectionsTable.id, connections[0].id));
      res.status(401).json({ error: refreshErr.message, needsReconnect: true });
      return;
    }

    const maxResults = parseInt(req.body.maxResults as string) || 50;
    const query = (req.body.query as string) || "";

    try {
      const { syncGmailMessages } = await import("../lib/gmail.js");
      const { syncGmailToConversations } = await import("../lib/conversation-sync.js");

      const [result, convResult] = await Promise.all([
        syncGmailMessages(accessToken, connections[0].email, userId, {
          maxResults,
          query,
          pageToken: req.body.pageToken,
        }),
        syncGmailToConversations(accessToken, connections[0].email, {
          maxResults,
          query,
          pageToken: req.body.pageToken,
        }),
      ]);

      const updateData: any = {
        lastSyncAt: new Date(),
        syncStatus: "idle",
        syncError: null,
      };
      if (result.historyId) {
        updateData.lastHistoryId = result.historyId;
      }

      await db.update(gmailConnectionsTable)
        .set(updateData)
        .where(eq(gmailConnectionsTable.id, connections[0].id));

      await auditAction(req, "gmail_sync", "gmail_connection", undefined, {
        synced: result.synced,
        classified: result.classified,
        errors: result.errors,
        skipped: result.skipped,
        conversations: {
          created: convResult.conversationsCreated,
          updated: convResult.conversationsUpdated,
          messages: convResult.messagesCreated,
        },
      });

      res.json({
        synced: result.synced,
        classified: result.classified,
        errors: result.errors,
        skipped: result.skipped,
        conversations: {
          created: convResult.conversationsCreated,
          updated: convResult.conversationsUpdated,
          messages: convResult.messagesCreated,
        },
        nextPageToken: result.nextPageToken,
        message: `Sincronización completada: ${result.synced} emails, ${convResult.conversationsCreated} conversaciones nuevas`,
      });
    } catch (syncErr: any) {
      req.log.error(syncErr, "Gmail sync failed");

      if (syncErr.message?.includes("401") || syncErr.message?.includes("403")) {
        try {
          accessToken = await refreshAccessToken(connections[0]);
          const { syncGmailMessages } = await import("../lib/gmail.js");
          const { syncGmailToConversations } = await import("../lib/conversation-sync.js");

          const [result, convResult] = await Promise.all([
            syncGmailMessages(accessToken, connections[0].email, userId, { maxResults, query }),
            syncGmailToConversations(accessToken, connections[0].email, { maxResults, query }),
          ]);

          await db.update(gmailConnectionsTable)
            .set({ lastSyncAt: new Date(), syncStatus: "idle", syncError: null })
            .where(eq(gmailConnectionsTable.id, connections[0].id));

          res.json({
            synced: result.synced,
            classified: result.classified,
            errors: result.errors,
            skipped: result.skipped,
            conversations: {
              created: convResult.conversationsCreated,
              updated: convResult.conversationsUpdated,
              messages: convResult.messagesCreated,
            },
            message: `Sincronización completada (token renovado): ${result.synced} emails, ${convResult.conversationsCreated} conversaciones`,
          });
          return;
        } catch (retryErr: any) {
          await db.update(gmailConnectionsTable)
            .set({ syncStatus: "error", syncError: "Token vencido. Reconecte Gmail." })
            .where(eq(gmailConnectionsTable.id, connections[0].id));
          res.status(401).json({ error: "Token de Gmail vencido. Reconecte la cuenta.", needsReconnect: true });
          return;
        }
      }

      await db.update(gmailConnectionsTable)
        .set({ syncStatus: "error", syncError: syncErr.message })
        .where(eq(gmailConnectionsTable.id, connections[0].id));
      res.status(500).json({ error: `Error de sincronización: ${syncErr.message}` });
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al sincronizar Gmail" });
  }
});

router.post("/emails/:id/send-reply", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { subject, body, bodyHtml } = req.body;
    const userId = (req as any).userId;

    const emails = await db.select().from(emailsTable).where(eq(emailsTable.id, id)).limit(1);
    const email = emails[0];
    if (!email) {
      res.status(404).json({ error: "Email no encontrado" });
      return;
    }

    const connections = await db.select().from(gmailConnectionsTable).where(eq(gmailConnectionsTable.userId, userId)).limit(1);

    if (connections[0]) {
      try {
        let accessToken = await getValidAccessToken(connections[0]);

        const { sendGmailReply } = await import("../lib/gmail.js");
        const result = await sendGmailReply(
          accessToken,
          email.fromEmail,
          subject || `Re: ${email.subject}`,
          body,
          bodyHtml || body.replace(/\n/g, "<br>"),
          email.gmailThreadId || undefined,
        );

        await db.insert(emailsTable).values({
          gmailMessageId: result.messageId,
          gmailThreadId: result.threadId,
          subject: subject || `Re: ${email.subject}`,
          fromEmail: connections[0].email,
          fromName: (req as any).userFullName || undefined,
          toEmail: email.fromEmail,
          body,
          bodyHtml: bodyHtml || body.replace(/\n/g, "<br>"),
          direction: "outbound",
          receivedAt: new Date(),
          status: "replied",
          clientId: email.clientId,
          contactId: email.contactId,
          opportunityId: email.opportunityId,
        });

        await db.update(emailsTable).set({ status: "replied" }).where(eq(emailsTable.id, id));

        await db.insert(activitiesTable).values({
          type: "email",
          title: `Respuesta enviada por Gmail: ${subject || email.subject}`,
          description: body.substring(0, 200),
          emailId: id,
          opportunityId: email.opportunityId || undefined,
        });

        await auditAction(req, "enviar_respuesta_gmail", "email", id, {
          to: email.fromEmail,
          gmailMessageId: result.messageId,
          threadId: result.threadId,
        });

        res.json({
          message: "Respuesta enviada por Gmail",
          sent: true,
          gmailMessageId: result.messageId,
          threadId: result.threadId,
        });
        return;
      } catch (sendErr: any) {
        req.log.error(sendErr, "Gmail send failed");
        res.status(500).json({
          error: `Error al enviar por Gmail: ${sendErr.message}`,
          sent: false,
        });
        return;
      }
    }

    res.status(400).json({
      error: "No hay cuenta Gmail conectada. Conecte Gmail para enviar respuestas reales.",
      sent: false,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al enviar respuesta" });
  }
});

router.get("/gmail/attachment/:messageId/:attachmentId", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { messageId, attachmentId } = req.params;

    const connections = await db.select().from(gmailConnectionsTable).where(eq(gmailConnectionsTable.userId, userId)).limit(1);
    if (!connections[0]) {
      res.status(400).json({ error: "Gmail no conectado" });
      return;
    }

    const accessToken = await getValidAccessToken(connections[0]);
    const { getGmailAttachment } = await import("../lib/gmail.js");
    const attachment = await getGmailAttachment(accessToken, messageId, attachmentId);

    const buffer = Buffer.from(attachment.data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    res.set("Content-Length", String(buffer.length));
    res.set("Content-Disposition", "attachment");
    res.send(buffer);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al descargar adjunto" });
  }
});

router.post("/gmail/disconnect", requireRole("admin", "gerente"), async (req, res) => {
  try {
    const userId = (req as any).userId;
    const connections = await db.select().from(gmailConnectionsTable).where(eq(gmailConnectionsTable.userId, userId)).limit(1);
    await db.delete(gmailConnectionsTable).where(eq(gmailConnectionsTable.userId, userId));

    await auditAction(req, "gmail_desconectar", "gmail_connection", undefined, {
      email: connections[0]?.email,
    });

    res.json({ message: "Gmail desconectado" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al desconectar Gmail" });
  }
});

export default router;
