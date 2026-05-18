import { Router, type IRouter } from "express";
import { db, clientsTable, quotesTable, ordersTable, contactsTable, activitiesTable, salespeopleTable, tasksTable } from "@workspace/db";
import { eq, ilike, sql, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/clients", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    let query = db.select().from(clientsTable);
    if (search) {
      query = query.where(ilike(clientsTable.companyName, `%${search}%`)) as any;
    }

    const [data, countResult] = await Promise.all([
      query.limit(limit).offset(offset),
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
    const [client] = await db.insert(clientsTable).values(req.body).returning();
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
    const [updated] = await db.update(clientsTable).set(req.body).where(eq(clientsTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
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
