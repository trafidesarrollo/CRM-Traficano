import { Router, type IRouter } from "express";
import { db, gmailConnectionsTable, emailsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../middleware/auth.js";
import { auditAction } from "../lib/audit.js";

const router: IRouter = Router();

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || "";
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || "";
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost"}/api/gmail/callback`;

router.get("/gmail/connect", requireRole("admin", "gerente"), (req, res) => {
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    res.status(400).json({ error: "Gmail no configurado. Configure GMAIL_CLIENT_ID y GMAIL_CLIENT_SECRET." });
    return;
  }

  const scope = encodeURIComponent("https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email");
  const userId = (req as any).userId;
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GMAIL_CLIENT_ID}&redirect_uri=${encodeURIComponent(GMAIL_REDIRECT_URI)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${userId}`;
  res.json({ authUrl });
});

router.get("/gmail/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      res.status(400).json({ error: "Código de autorización faltante" });
      return;
    }

    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
      res.status(400).json({ error: "Gmail no configurado. Configure GMAIL_CLIENT_ID y GMAIL_CLIENT_SECRET." });
      return;
    }

    const userId = parseInt(state as string);
    if (!userId || isNaN(userId)) {
      res.status(400).json({ error: "Estado de autenticación inválido" });
      return;
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        redirect_uri: GMAIL_REDIRECT_URI,
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

    let status = "conectada";
    if (connections[0].tokenExpiry && new Date(connections[0].tokenExpiry) < new Date()) {
      status = "token_vencido";
    }

    res.json({
      connected: true,
      email: connections[0].email,
      lastSyncAt: connections[0].lastSyncAt,
      status,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener estado de Gmail" });
  }
});

async function refreshAccessToken(connection: any): Promise<string> {
  if (!connection.refreshToken) {
    throw new Error("No hay refresh token. Reconecte Gmail.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
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

router.post("/gmail/sync", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const connections = await db.select().from(gmailConnectionsTable).where(eq(gmailConnectionsTable.userId, userId)).limit(1);
    if (!connections[0]) {
      res.status(400).json({ error: "Gmail no conectado" });
      return;
    }

    let accessToken = connections[0].accessToken;
    if (connections[0].tokenExpiry && new Date(connections[0].tokenExpiry) < new Date()) {
      try {
        accessToken = await refreshAccessToken(connections[0]);
      } catch (refreshErr: any) {
        res.status(401).json({ error: refreshErr.message, needsReconnect: true });
        return;
      }
    }

    let synced = 0;
    let classified = 0;
    let errors = 0;

    try {
      const { syncGmailMessages } = await import("../lib/gmail.js");
      const result = await syncGmailMessages(accessToken, connections[0].email, userId);
      synced = result.synced;
      classified = result.classified;
      errors = result.errors;

      await db.update(gmailConnectionsTable)
        .set({ lastSyncAt: new Date() })
        .where(eq(gmailConnectionsTable.userId, userId));

      await auditAction(req, "gmail_sync", "gmail_connection", undefined, { synced, classified, errors });
    } catch (syncErr: any) {
      req.log.warn(syncErr, "Gmail sync failed");
      if (syncErr.message?.includes("401")) {
        try {
          accessToken = await refreshAccessToken(connections[0]);
          const { syncGmailMessages } = await import("../lib/gmail.js");
          const result = await syncGmailMessages(accessToken, connections[0].email, userId);
          synced = result.synced;
          classified = result.classified;
          errors = result.errors;
        } catch (retryErr) {
          res.status(401).json({ error: "Token de Gmail vencido. Reconecte la cuenta.", needsReconnect: true });
          return;
        }
      } else {
        errors = 1;
      }
    }

    res.json({ synced, classified, errors, message: `Sincronización completada: ${synced} emails` });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al sincronizar Gmail" });
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
