import { Router, type IRouter } from "express";
import { db, salesTargetsTable, salespeopleTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/sales-targets/progress", async (req, res) => {
  try {
    const now = new Date();
    const year  = parseInt(req.query.year  as string) || now.getFullYear();
    const month = parseInt(req.query.month as string) || now.getMonth() + 1;

    const rows = await db.execute(sql`
      SELECT
        s.id,
        s.name,
        COALESCE(
          SUM(q.net_amount::numeric)
          FILTER (WHERE q.quote_status IN ('FINALIZADA','APROBADA')
                    AND EXTRACT(YEAR  FROM q.date) = ${year}
                    AND EXTRACT(MONTH FROM q.date) = ${month}),
          0
        ) AS actual_amount,
        st.id          AS target_id,
        st.target_amount,
        st.currency
      FROM salespeople s
      LEFT JOIN quotes q ON q.salesperson_id = s.id
      LEFT JOIN sales_targets st
        ON st.salesperson_id = s.id
        AND st.year  = ${year}
        AND st.month = ${month}
      WHERE s.is_active = true
      GROUP BY s.id, s.name, st.id, st.target_amount, st.currency
      ORDER BY s.name
    `);

    res.json({ year, month, data: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/sales-targets/my-progress", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const now = new Date();
    const year  = parseInt(req.query.year  as string) || now.getFullYear();
    const month = parseInt(req.query.month as string) || now.getMonth() + 1;

    const rows = await db.execute(sql`
      SELECT
        s.id,
        s.name,
        COALESCE(
          SUM(q.net_amount::numeric)
          FILTER (WHERE q.quote_status IN ('FINALIZADA','APROBADA')
                    AND EXTRACT(YEAR  FROM q.date) = ${year}
                    AND EXTRACT(MONTH FROM q.date) = ${month}),
          0
        ) AS actual_amount,
        st.id          AS target_id,
        st.target_amount,
        st.currency
      FROM salespeople s
      LEFT JOIN quotes q ON q.salesperson_id = s.id
      LEFT JOIN sales_targets st
        ON st.salesperson_id = s.id
        AND st.year  = ${year}
        AND st.month = ${month}
      WHERE s.user_id = ${userId}
      GROUP BY s.id, s.name, st.id, st.target_amount, st.currency
      LIMIT 1
    `);

    res.json({ year, month, data: rows.rows[0] || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/sales-targets", async (req, res) => {
  try {
    const { salespersonId, year, month, targetAmount, currency = "USD" } = req.body;
    if (!salespersonId || !year || !month || targetAmount === undefined) {
      return res.status(400).json({ error: "salespersonId, year, month y targetAmount son requeridos" });
    }

    const existing = await db
      .select()
      .from(salesTargetsTable)
      .where(
        and(
          eq(salesTargetsTable.salespersonId, salespersonId),
          eq(salesTargetsTable.year, year),
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
      .values({ salespersonId, year, month, targetAmount: String(targetAmount), currency })
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
