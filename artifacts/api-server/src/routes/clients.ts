import { Router, type IRouter } from "express";
import { db, clientsTable, quotesTable, ordersTable, contactsTable, activitiesTable, salespeopleTable, tasksTable } from "@workspace/db";
import { eq, ilike, sql, desc, inArray, and } from "drizzle-orm";

const router: IRouter = Router();

// Compute the automatic status based on filled fields + consumptionScale.
// Rules:
//   prospect  → default, any client with incomplete required fields
//   potential → required fields filled AND consumptionScale > 0
//   inactive  → required fields filled AND consumptionScale === 0
//   final     → set automatically when client makes a first OC (convert-to-order)
//               or manually by admin (never auto-downgraded from final)
function computeStatus(data: any, existingStatus?: string): string {
  // final can only be set explicitly
  if (existingStatus === "final") return "final";

  const requiredFilled =
    data.companyName?.trim() &&
    data.taxId?.trim() &&
    data.industry?.trim() &&
    data.phone?.trim() &&
    (data.clientEmails?.length > 0) &&
    data.city?.trim();

  if (!requiredFilled) return "prospect";

  const scale = parseFloat(data.consumptionScale ?? "");
  if (isNaN(scale)) return "potential"; // scale not set yet → potential with no scale
  if (scale === 0) return "inactive";
  return "potential";
}

router.get("/clients", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 200;
    const search = req.query.search as string;
    const statusFilter = req.query.status as string; // comma-separated
    const offset = (page - 1) * limit;

    let base = db.select().from(clientsTable).$dynamic();

    const conditions: any[] = [];
    if (search) conditions.push(ilike(clientsTable.companyName, `%${search}%`));
    if (statusFilter) {
      const statuses = statusFilter.split(",").map(s => s.trim()).filter(Boolean);
      if (statuses.length) conditions.push(inArray(clientsTable.status, statuses as any));
    }

    if (conditions.length === 1) base = base.where(conditions[0]);
    else if (conditions.length > 1) base = base.where(and(...conditions));

    const [data, countResult] = await Promise.all([
      base.limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(clientsTable),
    ]);

    res.json({ data, total: Number(countResult[0].count), page, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar clientes" });
  }
});

router.post("/clients", async (req, res) => {
  try {
    const body = req.body;
    // Auto-compute status unless admin is explicitly setting it to a specific value
    const status = computeStatus(body, undefined);
    const [client] = await db.insert(clientsTable).values({ ...body, status }).returning();
    res.status(201).json(client);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al crear cliente" });
  }
});

router.get("/clients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const clients = await db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
    if (!clients[0]) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
    res.json(clients[0]);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener cliente" });
  }
});

router.get("/clients/:id/overview", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
    if (!client) { res.status(404).json({ error: "Cliente no encontrado" }); return; }

    const [quotes, orders, contacts, activities, tasks] = await Promise.all([
      db.execute(sql`
        SELECT q.*, s.name AS salesperson_name
        FROM quotes q
        LEFT JOIN salespeople s ON s.id = q.salesperson_id
        WHERE q.client_id = ${id}
        ORDER BY q.date DESC
        LIMIT 100
      `),
      db.execute(sql`
        SELECT o.*, s.name AS salesperson_name
        FROM orders o
        LEFT JOIN salespeople s ON s.id = o.salesperson_id
        WHERE o.client_id = ${id}
        ORDER BY o.date DESC
        LIMIT 100
      `),
      db.select().from(contactsTable).where(eq(contactsTable.clientId, id)).orderBy(desc(contactsTable.isPrimary)),
      db.select().from(activitiesTable).where(eq(activitiesTable.clientId, id)).orderBy(desc(activitiesTable.createdAt)).limit(50),
      db.execute(sql`
        SELECT t.*, u.full_name AS assignee_name
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assigned_to
        WHERE t.client_id = ${id}
        ORDER BY t.created_at DESC
        LIMIT 50
      `),
    ]);

    const quotesData = quotes.rows as any[];
    const ordersData = orders.rows as any[];
    const totalQuoted = quotesData.reduce((s: number, q: any) => s + Number(q.net_amount || q.total || 0), 0);
    const totalOrdered = ordersData.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
    const wonQuotes = quotesData.filter((q: any) => q.status === "approved").length;
    const conversionRate = quotesData.length ? (wonQuotes / quotesData.length) * 100 : 0;

    res.json({
      client,
      quotes: quotesData,
      orders: ordersData,
      contacts: contacts,
      activities: activities,
      tasks: tasks.rows as any[],
      stats: { totalQuoted, totalOrdered, quotesCount: quotesData.length, ordersCount: ordersData.length, wonQuotes, conversionRate },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener resumen del cliente" });
  }
});

router.patch("/clients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;

    // Load existing to preserve final status
    const [existing] = await db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Cliente no encontrado" }); return; }

    const merged = { ...existing, ...body };

    // Only auto-compute status if caller didn't explicitly pass one
    let newStatus: string;
    if (body.status && body.status !== existing.status) {
      // Explicit override (admin)
      newStatus = body.status;
    } else {
      newStatus = computeStatus(merged, existing.status);
    }

    const [updated] = await db.update(clientsTable)
      .set({ ...body, status: newStatus })
      .where(eq(clientsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
});

router.delete("/clients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(clientsTable).where(eq(clientsTable.id, id));
    res.json({ message: "Cliente eliminado" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al eliminar cliente" });
  }
});

export default router;
