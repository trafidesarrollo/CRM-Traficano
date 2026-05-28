import { Router, type IRouter } from "express";
import { db, salesTargetsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

type PeriodType  = "monthly" | "quarterly" | "semiannual" | "annual";
type MetricType  = "amount_approved" | "count_quotes" | "count_approved" | "count_orders" | "amount_orders";

// Map metric type → SQL aggregate expression (uses alias q for quotes, o for orders)
function metricAggregate(metricType: MetricType, dateFilter: string): string {
  switch (metricType) {
    case "count_quotes":
      return `COUNT(DISTINCT q.id) FILTER (WHERE ${dateFilter})`;
    case "count_approved":
      return `COUNT(DISTINCT q.id) FILTER (WHERE q.quote_status IN ('FINALIZADA','APROBADA') AND ${dateFilter})`;
    case "count_orders":
      return `COUNT(DISTINCT o.id) FILTER (WHERE ${dateFilter.replace(/q\./g, "o.")})`;
    case "amount_orders":
      return `COALESCE(SUM(DISTINCT o.total_amount::numeric) FILTER (WHERE ${dateFilter.replace(/q\./g, "o.")}), 0)`;
    case "amount_approved":
    default:
      return `COALESCE(SUM(q.net_amount::numeric) FILTER (WHERE q.quote_status IN ('FINALIZADA','APROBADA') AND ${dateFilter}), 0)`;
  }
}

function buildDateFilter(periodType: PeriodType, period: number, year: number, alias = "q"): string {
  switch (periodType) {
    case "quarterly": {
      const m1 = (period - 1) * 3 + 1;
      const m2 = period * 3;
      return `EXTRACT(YEAR FROM ${alias}.date) = ${year} AND EXTRACT(MONTH FROM ${alias}.date) BETWEEN ${m1} AND ${m2}`;
    }
    case "semiannual": {
      const m1 = period === 1 ? 1 : 7;
      const m2 = period === 1 ? 6 : 12;
      return `EXTRACT(YEAR FROM ${alias}.date) = ${year} AND EXTRACT(MONTH FROM ${alias}.date) BETWEEN ${m1} AND ${m2}`;
    }
    case "annual":
      return `EXTRACT(YEAR FROM ${alias}.date) = ${year}`;
    case "monthly":
    default:
      return `EXTRACT(YEAR FROM ${alias}.date) = ${year} AND EXTRACT(MONTH FROM ${alias}.date) = ${period}`;
  }
}

function buildProgressQuery(
  whereClause: string,
  periodType: PeriodType, period: number, year: number,
  metricType: MetricType,
): string {
  const dateFilterQ = buildDateFilter(periodType, period, year, "q");
  const agg = metricAggregate(metricType, dateFilterQ);
  const needsOrders = metricType === "count_orders" || metricType === "amount_orders";

  return `
    SELECT
      s.id,
      s.name,
      ${agg} AS actual_amount,
      st.id           AS target_id,
      st.target_amount,
      st.currency,
      st.period_type,
      st.metric_type
    FROM salespeople s
    ${needsOrders ? "" : "LEFT JOIN quotes q ON q.salesperson_id = s.id"}
    ${needsOrders ? "LEFT JOIN orders o ON o.salesperson_id = s.id" : ""}
    LEFT JOIN sales_targets st
      ON  st.salesperson_id = s.id
      AND st.year        = ${year}
      AND st.period_type = '${periodType}'
      AND st.month       = ${period}
      AND st.metric_type = '${metricType}'
    ${whereClause}
    GROUP BY s.id, s.name, st.id, st.target_amount, st.currency, st.period_type, st.metric_type
    ORDER BY s.name
  `;
}

router.get("/sales-targets/progress", async (req, res) => {
  try {
    const now        = new Date();
    const year       = parseInt(req.query.year       as string) || now.getFullYear();
    const periodType = (req.query.periodType as PeriodType) || "monthly";
    const period     = parseInt(req.query.period     as string) || (periodType === "monthly" ? now.getMonth() + 1 : 1);
    const metricType = (req.query.metricType as MetricType) || "amount_approved";

    const q = buildProgressQuery("WHERE s.is_active = true", periodType, period, year, metricType);
    const rows = await db.execute(sql.raw(q));
    res.json({ year, periodType, period, metricType, data: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/sales-targets/my-progress", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const now        = new Date();
    const year       = parseInt(req.query.year       as string) || now.getFullYear();
    const periodType = (req.query.periodType as PeriodType) || "monthly";
    const period     = parseInt(req.query.period     as string) || (periodType === "monthly" ? now.getMonth() + 1 : 1);
    const metricType = (req.query.metricType as MetricType) || "amount_approved";

    const q = buildProgressQuery(`WHERE s.user_id = ${userId}`, periodType, period, year, metricType);
    const rows = await db.execute(sql.raw(q + " LIMIT 1"));
    res.json({ year, periodType, period, metricType, data: rows.rows[0] || null });
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
        SELECT
          CASE st.metric_type
            WHEN 'count_quotes'
              THEN COUNT(DISTINCT q.id)::numeric
            WHEN 'count_approved'
              THEN COUNT(DISTINCT q.id) FILTER (WHERE q.quote_status IN ('FINALIZADA','APROBADA'))::numeric
            WHEN 'amount_approved'
              THEN COALESCE(SUM(q.net_amount::numeric) FILTER (WHERE q.quote_status IN ('FINALIZADA','APROBADA')), 0)
            WHEN 'count_orders'
              THEN (SELECT COUNT(*) FROM orders o2
                    WHERE o2.salesperson_id = st.salesperson_id
                      AND EXTRACT(YEAR FROM o2.date) = st.year
                      AND (
                        (st.period_type = 'monthly'    AND EXTRACT(MONTH FROM o2.date) = st.month)
                     OR (st.period_type = 'quarterly'  AND EXTRACT(MONTH FROM o2.date) BETWEEN (st.month-1)*3+1 AND st.month*3)
                     OR (st.period_type = 'semiannual' AND EXTRACT(MONTH FROM o2.date) BETWEEN CASE st.month WHEN 1 THEN 1 ELSE 7 END AND CASE st.month WHEN 1 THEN 6 ELSE 12 END)
                     OR (st.period_type = 'annual')
                      ))::numeric
            WHEN 'amount_orders'
              THEN (SELECT COALESCE(SUM(o2.total_amount::numeric), 0) FROM orders o2
                    WHERE o2.salesperson_id = st.salesperson_id
                      AND EXTRACT(YEAR FROM o2.date) = st.year
                      AND (
                        (st.period_type = 'monthly'    AND EXTRACT(MONTH FROM o2.date) = st.month)
                     OR (st.period_type = 'quarterly'  AND EXTRACT(MONTH FROM o2.date) BETWEEN (st.month-1)*3+1 AND st.month*3)
                     OR (st.period_type = 'semiannual' AND EXTRACT(MONTH FROM o2.date) BETWEEN CASE st.month WHEN 1 THEN 1 ELSE 7 END AND CASE st.month WHEN 1 THEN 6 ELSE 12 END)
                     OR (st.period_type = 'annual')
                      ))::numeric
            ELSE 0
          END AS amount
        FROM quotes q
        WHERE q.salesperson_id = st.salesperson_id
          AND EXTRACT(YEAR FROM q.date) = st.year
          AND (
            (st.period_type = 'monthly'    AND EXTRACT(MONTH FROM q.date) = st.month)
         OR (st.period_type = 'quarterly'  AND EXTRACT(MONTH FROM q.date) BETWEEN (st.month-1)*3+1 AND st.month*3)
         OR (st.period_type = 'semiannual' AND EXTRACT(MONTH FROM q.date) BETWEEN CASE st.month WHEN 1 THEN 1 ELSE 7 END AND CASE st.month WHEN 1 THEN 6 ELSE 12 END)
         OR (st.period_type = 'annual')
          )
      ) actual ON true
      WHERE st.salesperson_id = ${spId}
        AND st.year = ${year}
      ORDER BY st.period_type, st.metric_type, st.month
    `);

    res.json({ year, data: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/sales-targets", async (req, res) => {
  try {
    const {
      salespersonId, year,
      periodType = "monthly", month,
      metricType = "amount_approved",
      targetAmount, currency = "USD",
    } = req.body;

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
          eq(salesTargetsTable.metricType, metricType),
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
      .values({ salespersonId, year, periodType, month, metricType, targetAmount: String(targetAmount), currency })
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
