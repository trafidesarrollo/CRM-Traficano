import { Router, type IRouter } from "express";
import { db, automationRulesTable, automationLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/automation/rules", async (req, res) => {
  const rows = await db.select().from(automationRulesTable).orderBy(desc(automationRulesTable.createdAt));
  res.json({ data: rows });
});

router.get("/automation/rules/:id", async (req, res) => {
  const [row] = await db.select().from(automationRulesTable).where(eq(automationRulesTable.id, parseInt(req.params.id)));
  if (!row) { res.status(404).json({ error: "No encontrada" }); return; }
  res.json(row);
});

router.post("/automation/rules", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    const [row] = await db.insert(automationRulesTable).values({ ...req.body, createdBy: userId }).returning();
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/automation/rules/:id", async (req, res) => {
  try {
    const [row] = await db.update(automationRulesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(automationRulesTable.id, parseInt(req.params.id))).returning();
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/automation/rules/:id", async (req, res) => {
  await db.delete(automationRulesTable).where(eq(automationRulesTable.id, parseInt(req.params.id)));
  res.json({ ok: true });
});

router.get("/automation/logs", async (req, res) => {
  const ruleId = req.query.ruleId ? parseInt(req.query.ruleId as string) : null;
  const q = db.select().from(automationLogsTable).orderBy(desc(automationLogsTable.executedAt)).limit(100);
  const rows = ruleId ? await q.where(eq(automationLogsTable.ruleId, ruleId)) : await q;
  res.json({ data: rows });
});

export default router;
