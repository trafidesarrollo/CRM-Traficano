import { Router } from "express";
import { db, quoteLogsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/quotes/:id/logs", async (req, res) => {
  try {
    const quoteId = parseInt(req.params.id);
    if (isNaN(quoteId)) return res.status(400).json({ error: "ID inválido" });
    const logs = await db
      .select()
      .from(quoteLogsTable)
      .where(eq(quoteLogsTable.quoteId, quoteId))
      .orderBy(desc(quoteLogsTable.createdAt));
    res.json(logs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/quotes/:id/logs", async (req, res) => {
  try {
    const quoteId = parseInt(req.params.id);
    if (isNaN(quoteId)) return res.status(400).json({ error: "ID inválido" });
    const userId = (req as any).session?.userId;
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "El mensaje es requerido" });

    let userName: string | null = null;
    if (userId) {
      const [u] = await db.select({ fullName: usersTable.fullName, username: usersTable.username })
        .from(usersTable).where(eq(usersTable.id, userId));
      userName = u?.fullName || u?.username || null;
    }

    const [log] = await db.insert(quoteLogsTable).values({
      quoteId,
      userId: userId || null,
      userName,
      message: message.trim(),
    }).returning();

    res.json(log);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
