import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/notifications", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    if (!userId) { res.status(401).json({ error: "No autenticado" }); return; }
    const onlyUnread = req.query.unread === "true";
    const limit = Math.min(100, parseInt(req.query.limit as string) || 30);

    const where = onlyUnread
      ? and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false))
      : eq(notificationsTable.userId, userId);

    const [data, [{ count }]] = await Promise.all([
      db.select().from(notificationsTable).where(where as any).orderBy(desc(notificationsTable.createdAt)).limit(limit),
      db.select({ count: sql<number>`count(*)` }).from(notificationsTable).where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false))),
    ]);

    res.json({ data, unreadCount: Number(count) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/notifications/:id/read", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    const id = parseInt(req.params.id);
    await db.update(notificationsTable).set({ isRead: true, readAt: new Date() }).where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)));
    res.json({ message: "Marcada como leída" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/notifications/read-all", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    await db.update(notificationsTable).set({ isRead: true, readAt: new Date() }).where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));
    res.json({ message: "Todas marcadas como leídas" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/notifications/:id", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    const id = parseInt(req.params.id);
    await db.delete(notificationsTable).where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)));
    res.json({ message: "Eliminada" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
