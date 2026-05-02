import { Router, type IRouter } from "express";
import { db, quotesTable, ordersTable, opportunitiesTable, salespeopleTable, clientsTable, activitiesTable } from "@workspace/db";
import { sql, eq, gte, and, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/reports/sales-summary", async (req, res) => {
  try {
    const days = Math.max(1, Math.min(365, parseInt(req.query.days as string) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [quoteCount] = await db.select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${quotesTable.total}::numeric),0)` }).from(quotesTable).where(gte(quotesTable.date, since));
    const [orderCount] = await db.select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${ordersTable.total}::numeric),0)` }).from(ordersTable).where(gte(ordersTable.date, since));
    const [oppCount] = await db.select({ count: sql<number>`count(*)` }).from(opportunitiesTable).where(gte(opportunitiesTable.createdAt, since));
    const [wonCount] = await db.select({ count: sql<number>`count(*)` }).from(opportunitiesTable).where(and(eq(opportunitiesTable.status, "won"), gte(opportunitiesTable.createdAt, since)));

    res.json({
      quotes: { count: Number(quoteCount.count), total: Number(quoteCount.total) },
      orders: { count: Number(orderCount.count), total: Number(orderCount.total) },
      opportunities: { count: Number(oppCount.count), won: Number(wonCount.count), winRate: oppCount.count ? (Number(wonCount.count) / Number(oppCount.count)) * 100 : 0 },
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/reports/sales-by-month", async (req, res) => {
  try {
    const months = Math.max(1, Math.min(24, parseInt(req.query.months as string) || 12));
    const since = new Date(); since.setMonth(since.getMonth() - months);
    const rows = await db.execute(sql`
      SELECT to_char(date_trunc('month', date), 'YYYY-MM') AS month,
             count(*)::int AS orders,
             coalesce(sum(total::numeric),0)::float AS total
      FROM orders WHERE date >= ${since.toISOString()}
      GROUP BY 1 ORDER BY 1
    `);
    res.json({ data: rows.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/reports/sales-by-salesperson", async (req, res) => {
  try {
    const days = Math.max(1, Math.min(365, parseInt(req.query.days as string) || 90));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db.execute(sql`
      SELECT s.id, s.name,
             count(o.id)::int AS orders,
             coalesce(sum(o.total::numeric),0)::float AS total,
             count(DISTINCT q.id)::int AS quotes
      FROM salespeople s
      LEFT JOIN orders o ON o.salesperson_id = s.id AND o.date >= ${since.toISOString()}
      LEFT JOIN quotes q ON q.salesperson_id = s.id AND q.date >= ${since.toISOString()}
      GROUP BY s.id, s.name
      ORDER BY total DESC
    `);
    res.json({ data: rows.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/reports/pipeline-funnel", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT status, count(*)::int AS count
      FROM opportunities GROUP BY status ORDER BY count DESC
    `);
    res.json({ data: rows.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/reports/top-clients", async (req, res) => {
  try {
    const days = Math.max(1, Math.min(365, parseInt(req.query.days as string) || 365));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db.execute(sql`
      SELECT c.id, c.company_name,
             count(o.id)::int AS orders,
             coalesce(sum(o.total::numeric),0)::float AS total
      FROM clients c
      JOIN orders o ON o.client_id = c.id
      WHERE o.date >= ${since.toISOString()}
      GROUP BY c.id, c.company_name
      ORDER BY total DESC LIMIT 20
    `);
    res.json({ data: rows.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/reports/activities-by-type", async (req, res) => {
  try {
    const days = Math.max(1, Math.min(365, parseInt(req.query.days as string) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db.execute(sql`
      SELECT type, count(*)::int AS count
      FROM activities WHERE created_at >= ${since.toISOString()}
      GROUP BY type ORDER BY count DESC
    `);
    res.json({ data: rows.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
