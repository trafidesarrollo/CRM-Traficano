import { Router, type IRouter } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const entityType = req.query.entityType as string;
    const action = req.query.action as string;
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;

    let conditions: any[] = [];
    if (entityType) conditions.push(eq(auditLogsTable.entityType, entityType));
    if (action) conditions.push(eq(auditLogsTable.action, action));
    if (userId) conditions.push(eq(auditLogsTable.userId, userId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const [data, countResult] = await Promise.all([
      whereClause
        ? db.select().from(auditLogsTable).where(whereClause).orderBy(desc(auditLogsTable.createdAt)).limit(limit).offset(offset)
        : db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(limit).offset(offset),
      whereClause
        ? db.select({ count: sql<number>`count(*)` }).from(auditLogsTable).where(whereClause)
        : db.select({ count: sql<number>`count(*)` }).from(auditLogsTable),
    ]);

    res.json({ data, total: Number(countResult[0].count), page, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar auditoría" });
  }
});

export default router;
