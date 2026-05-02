import { Router, type IRouter, type Request, type Response } from "express";
import { db, gmailConnectionsTable, tasksTable } from "@workspace/db";
import { eq, and, isNotNull, gt } from "drizzle-orm";

const router: IRouter = Router();

async function getValidAccessToken(conn: any): Promise<string> {
  if (conn.tokenExpiry && new Date(conn.tokenExpiry) < new Date()) {
    if (!conn.refreshToken) throw new Error("Sin refresh token, reconectar Gmail");
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID || "",
        client_secret: process.env.GMAIL_CLIENT_SECRET || "",
        refresh_token: conn.refreshToken, grant_type: "refresh_token",
      }),
    });
    const t = await r.json() as any;
    if (!t.access_token) throw new Error("No se pudo renovar token");
    await db.update(gmailConnectionsTable).set({
      accessToken: t.access_token,
      tokenExpiry: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : undefined,
    }).where(eq(gmailConnectionsTable.id, conn.id));
    return t.access_token;
  }
  return conn.accessToken;
}

async function getUserConnection(userId: number) {
  const [c] = await db.select().from(gmailConnectionsTable).where(eq(gmailConnectionsTable.userId, userId)).limit(1);
  return c;
}

router.get("/gcal/status", async (req: Request, res: Response) => {
  const userId = (req as any).session?.userId;
  if (!userId) { res.status(401).json({ error: "No autenticado" }); return; }
  const conn = await getUserConnection(userId);
  if (!conn) { res.json({ connected: false }); return; }
  res.json({
    connected: true,
    email: conn.email,
    syncEnabled: conn.calendarSyncEnabled,
    lastSyncAt: conn.calendarLastSyncAt,
  });
});

router.post("/gcal/toggle", async (req: Request, res: Response) => {
  const userId = (req as any).session?.userId;
  if (!userId) { res.status(401).json({ error: "No autenticado" }); return; }
  const conn = await getUserConnection(userId);
  if (!conn) { res.status(400).json({ error: "Conectá Gmail primero (incluye permisos de Calendar)" }); return; }
  const enabled = !!req.body?.enabled;
  await db.update(gmailConnectionsTable).set({ calendarSyncEnabled: enabled }).where(eq(gmailConnectionsTable.id, conn.id));
  res.json({ ok: true, syncEnabled: enabled });
});

async function pushTaskToGCal(token: string, task: any): Promise<{ id: string } | null> {
  if (!task.dueDate) return null;
  const start = new Date(task.dueDate);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const event = {
    summary: `[CRM] ${task.title}`,
    description: `${task.description || ""}\n\n— Sincronizado desde CRM Comercial`,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: { private: { crmTaskId: String(task.id) } },
  };
  if (task.googleEventId) {
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${task.googleEventId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    if (r.status === 404) {
      // event was deleted in GCal — recreate
    } else if (r.ok) {
      const j = await r.json() as any;
      return { id: j.id };
    }
  }
  const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!r.ok) return null;
  const j = await r.json() as any;
  return { id: j.id };
}

router.post("/gcal/push", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).session?.userId;
    if (!userId) { res.status(401).json({ error: "No autenticado" }); return; }
    const conn = await getUserConnection(userId);
    if (!conn || !conn.calendarSyncEnabled) { res.status(400).json({ error: "Sync no habilitada" }); return; }
    const token = await getValidAccessToken(conn);
    const tasks = await db.select().from(tasksTable).where(and(
      eq(tasksTable.assignedTo, userId),
      isNotNull(tasksTable.dueDate),
    )).limit(100);
    let pushed = 0, errors = 0;
    for (const t of tasks) {
      try {
        const r = await pushTaskToGCal(token, t);
        if (r) {
          await db.update(tasksTable).set({ googleEventId: r.id, googleSyncedAt: new Date() }).where(eq(tasksTable.id, t.id));
          pushed++;
        }
      } catch { errors++; }
    }
    await db.update(gmailConnectionsTable).set({ calendarLastSyncAt: new Date() }).where(eq(gmailConnectionsTable.id, conn.id));
    res.json({ ok: true, pushed, errors, total: tasks.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/gcal/pull", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).session?.userId;
    if (!userId) { res.status(401).json({ error: "No autenticado" }); return; }
    const conn = await getUserConnection(userId);
    if (!conn || !conn.calendarSyncEnabled) { res.status(400).json({ error: "Sync no habilitada" }); return; }
    const token = await getValidAccessToken(conn);
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(since)}&singleEvents=true&maxResults=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) { res.status(502).json({ error: "Error consultando Calendar" }); return; }
    const j = await r.json() as any;
    let imported = 0, updated = 0;
    for (const ev of (j.items || [])) {
      const crmId = ev.extendedProperties?.private?.crmTaskId;
      const due = ev.start?.dateTime ? new Date(ev.start.dateTime) : (ev.start?.date ? new Date(ev.start.date) : null);
      if (ev.status === "cancelled" && (crmId || ev.id)) {
        const tid = crmId ? parseInt(crmId) : null;
        if (tid) {
          await db.update(tasksTable).set({ status: "cancelled", googleSyncedAt: new Date() }).where(eq(tasksTable.id, tid));
          updated++;
        }
        continue;
      }
      if (crmId) {
        const tid = parseInt(crmId);
        if (!tid || !due) continue;
        const cleanTitle = (ev.summary || "").replace(/^\[CRM\]\s*/, "");
        await db.update(tasksTable).set({
          title: cleanTitle || "Sin título",
          description: ev.description || null,
          dueDate: due,
          googleSyncedAt: new Date(),
        }).where(eq(tasksTable.id, tid));
        updated++;
        continue;
      }
      if (!due) continue;
      const existing = await db.select().from(tasksTable).where(eq(tasksTable.googleEventId, ev.id)).limit(1);
      if (existing.length) {
        await db.update(tasksTable).set({
          title: ev.summary || "Sin título", description: ev.description || null,
          dueDate: due, googleSyncedAt: new Date(),
        }).where(eq(tasksTable.id, existing[0].id));
        updated++;
      } else {
        await db.insert(tasksTable).values({
          title: ev.summary || "Evento de Calendar",
          description: ev.description || null,
          type: "meeting",
          assignedTo: userId, createdBy: userId,
          dueDate: due,
          googleEventId: ev.id, googleCalendarId: "primary", googleSyncedAt: new Date(),
        });
        imported++;
      }
    }
    await db.update(gmailConnectionsTable).set({ calendarLastSyncAt: new Date() }).where(eq(gmailConnectionsTable.id, conn.id));
    res.json({ ok: true, imported, updated });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export { pushTaskToGCal, getValidAccessToken, getUserConnection };
export default router;
