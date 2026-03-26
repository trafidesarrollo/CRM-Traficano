import { Router, type IRouter } from "express";
import { db, gmailConnectionsTable, emailsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || "";
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || "";
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost"}/api/gmail/callback`;

router.get("/gmail/connect", (req, res) => {
  const scope = encodeURIComponent("https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email");
  const userId = (req.session as any)?.userId || "1";
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
      res.status(400).json({ error: "Error al obtener tokens de Gmail" });
      return;
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileResponse.json() as any;

    const userId = parseInt(state as string) || 1;
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

    res.json({ connected: true, email: profile.email, lastSyncAt: null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error en callback de Gmail" });
  }
});

router.get("/gmail/status", async (req, res) => {
  try {
    const userId = (req.session as any)?.userId || 1;
    const connections = await db.select().from(gmailConnectionsTable).where(eq(gmailConnectionsTable.userId, userId)).limit(1);
    if (!connections[0]) {
      res.json({ connected: false, email: null, lastSyncAt: null });
      return;
    }
    res.json({
      connected: true,
      email: connections[0].email,
      lastSyncAt: connections[0].lastSyncAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener estado de Gmail" });
  }
});

router.post("/gmail/sync", async (req, res) => {
  try {
    const userId = (req.session as any)?.userId || 1;
    const connections = await db.select().from(gmailConnectionsTable).where(eq(gmailConnectionsTable.userId, userId)).limit(1);
    if (!connections[0]) {
      res.status(400).json({ error: "Gmail no conectado" });
      return;
    }

    let synced = 0;
    let classified = 0;
    let errors = 0;

    try {
      const { syncGmailMessages } = await import("../lib/gmail.js");
      const result = await syncGmailMessages(connections[0].accessToken, connections[0].email, userId);
      synced = result.synced;
      classified = result.classified;
      errors = result.errors;

      await db.update(gmailConnectionsTable)
        .set({ lastSyncAt: new Date() })
        .where(eq(gmailConnectionsTable.userId, userId));
    } catch (syncErr) {
      req.log.warn(syncErr, "Gmail sync failed");
      errors = 1;
    }

    res.json({ synced, classified, errors, message: `Sincronización completada: ${synced} emails` });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al sincronizar Gmail" });
  }
});

router.post("/gmail/disconnect", async (req, res) => {
  try {
    const userId = (req.session as any)?.userId || 1;
    await db.delete(gmailConnectionsTable).where(eq(gmailConnectionsTable.userId, userId));
    res.json({ message: "Gmail desconectado" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al desconectar Gmail" });
  }
});

export default router;
