import { Router, type IRouter } from "express";
import { db, salesTargetsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

type PeriodType = "monthly" | "quarterly" | "semiannual" | "annual";

function buildDateFilter(periodType: PeriodType, period: number, year: number): string {
  switch (periodType) {
    case "quarterly": {
      const m1 = (period - 1) * 3 + 1;
      const m2 = period * 3;
      return `EXTRACT(YEAR FROM q.date) = ${year}
              AND EXTRACT(MONTH FROM q.date) BETWEEN ${m1} AND ${m2}`;
    }
    case "semiannual": {
      const m1 = period === 1 ? 1 : 7;
      const m2 = period === 1 ? 6 : 12;
      return `EXTRACT(YEAR FROM q.date) = ${year}
              AND EXTRACT(MONTH FROM q.date) BETWEEN ${m1} AND ${m2}`;
    }
    case "annual":
      return `EXTRACT(YEAR FROM q.date) = ${year}`;
    case "monthly":
    default:
      return `EXTRACT(YEAR FROM q.date) = ${year}
              AND EXTRACT(MONTH FROM q.date) = ${period}`;
  }
}

router.get("/sales-targets/progress", async (req, res) => {
  try {
    const now = new Date();
    const year       = parseInt(req.query.year       as string) || now.getFullYear();
    const periodType = (req.query.periodType as PeriodType) || "monthly";
    const period     = parseInt(req.query.period     as string) || (periodType === "monthly" ? now.getMonth() + 1 : 1);

    const dateFilter = buildDateFilter(periodType, period, year);

    const rows = await db.execute(sql.raw(`
      SELECT
        s.id,
        s.name,
        COALESCE(
          SUM(q.net_amount::numeric)
          FILTER (WHERE q.quote_status IN ('FINALIZADA','APROBADA')
                    AND ${dateFilter}),
          0
        ) AS actual_amount,
        st.id          AS target_id,
        st.target_amount,
        st.currency,
        st.period_type
      FROM salespeople s
      LEFT JOIN quotes q ON q.salesperson_id = s.id
      LEFT JOIN sales_targets st
        ON st.salesperson_id = s.id
        AND st.year        = ${year}
        AND st.period_type = '${periodType}'
        AND st.month       = ${period}
      WHERE s.is_active = true
      GROUP BY s.id, s.name, st.id, st.target_amount, st.currency, st.period_type
      ORDER BY s.name
    `));

    res.json({ year, periodType, period, data: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/sales-targets/my-progress", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const now = new Date();
    const year       = parseInt(req.query.year   as string) || now.getFullYear();
    const periodType = (req.query.periodType as PeriodType) || "monthly";
    const period     = parseInt(req.query.period as string) || (periodType === "monthly" ? now.getMonth() + 1 : 1);

    const dateFilter = buildDateFilter(periodType, period, year);

    const rows = await db.execute(sql.raw(`
      SELECT
        s.id,
        s.name,
        COALESCE(
          SUM(q.net_amount::numeric)
          FILTER (WHERE q.quote_status IN ('FINALIZADA','APROBADA')
                    AND ${dateFilter}),
          0
        ) AS actual_amount,
        st.id          AS target_id,
        st.target_amount,
        st.currency,
        st.period_type
      FROM salespeople s
      LEFT JOIN quotes q ON q.salesperson_id = s.id
      LEFT JOIN sales_targets st
        ON st.salesperson_id = s.id
        AND st.year        = ${year}
        AND st.period_type = '${periodType}'
        AND st.month       = ${period}
      WHERE s.user_id = ${userId}
      GROUP BY s.id, s.name, st.id, st.target_amount, st.currency, st.period_type
      LIMIT 1
    `));

    res.json({ year, periodType, period, data: rows.rows[0] || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/sales-targets/by-salesperson/:spId", async (req, res) => {
  try {
    const spId = parseInt(req.params.spId);
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const rows = await db.execute(sql`
      SELECT st.*,
        COALESCE(actual.amount, 0) AS actual_amount
      FROM sales_targets st
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(q.net_amount::numeric)
          FILTER (WHERE q.quote_status IN ('FINALIZADA','APROBADA')),0) AS amount
        FROM quotes q
        WHERE q.salesperson_id = st.salesperson_id
          AND EXTRACT(YEAR FROM q.date) = st.year
          AND (
            (st.period_type = 'monthly'   AND EXTRACT(MONTH FROM q.date) = st.month)
         OR (st.period_type = 'quarterly' AND EXTRACT(MONTH FROM q.date) BETWEEN (st.month-1)*3+1 AND st.month*3)
         OR (st.period_type = 'semiannual'AND EXTRACT(MONTH FROM q.date) BETWEEN CASE st.month WHEN 1 THEN 1 ELSE 7 END AND CASE st.month WHEN 1 THEN 6 ELSE 12 END)
         OR (st.period_type = 'annual')
          )
      ) actual ON true
      WHERE st.salesperson_id = ${spId}
        AND st.year = ${year}
      ORDER BY st.period_type, st.month
    `);

    res.json({ year, data: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/sales-targets", async (req, res) => {
  try {
    const { salespersonId, year, periodType = "monthly", month, targetAmount, currency = "USD" } = req.body;
    if (!salespersonId || !year || month === undefined || targetAmount === undefined) {
      return res.status(400).json({ error: "salespersonId, year, month y targetAmount son requeridos" });
    }

    const existing = await db
      .select()
      .from(salesTargetsTable)
      .where(
        and(
          eq(salesTargetsTable.salespersonId, salespersonId),
          eq(salesTargetsTable.year, year),
          eq(salesTargetsTable.periodType, periodType),
          eq(salesTargetsTable.month, month),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(salesTargetsTable)
        .set({ targetAmount: String(targetAmount), currency, updatedAt: new Date() })
        .where(eq(salesTargetsTable.id, existing[0].id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db
      .insert(salesTargetsTable)
      .values({ salespersonId, year, periodType, month, targetAmount: String(targetAmount), currency })
      .returning();
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/sales-targets/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(salesTargetsTable).where(eq(salesTargetsTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
