import { Router, type IRouter } from "express";
import { db, emailTemplatesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/email-templates", async (req, res) => {
  try {
    const rows = await db.select().from(emailTemplatesTable).orderBy(desc(emailTemplatesTable.createdAt));
    res.json({ data: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/email-templates/:id", async (req, res) => {
  const [row] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, parseInt(req.params.id)));
  if (!row) { res.status(404).json({ error: "No encontrado" }); return; }
  res.json(row);
});

router.post("/email-templates", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    const [row] = await db.insert(emailTemplatesTable).values({ ...req.body, createdBy: userId }).returning();
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/email-templates/:id", async (req, res) => {
  try {
    const [row] = await db.update(emailTemplatesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(emailTemplatesTable.id, parseInt(req.params.id))).returning();
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/email-templates/:id", async (req, res) => {
  await db.delete(emailTemplatesTable).where(eq(emailTemplatesTable.id, parseInt(req.params.id)));
  res.json({ ok: true });
});

router.post("/email-templates/:id/render", async (req, res) => {
  try {
    const [tpl] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, parseInt(req.params.id)));
    if (!tpl) { res.status(404).json({ error: "No encontrado" }); return; }
    const vars = req.body || {};
    const render = (s: string) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? `{{${k}}}`));
    res.json({ subject: render(tpl.subject), bodyHtml: render(tpl.bodyHtml) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
