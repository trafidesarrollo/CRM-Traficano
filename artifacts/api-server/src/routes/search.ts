import { Router, type IRouter, type Request, type Response } from "express";
import { db, clientsTable, contactsTable, productsTable, opportunitiesTable, quotesTable, ordersTable } from "@workspace/db";
import { sql, or, ilike } from "drizzle-orm";

const router: IRouter = Router();

router.get("/search", async (req: Request, res: Response) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) { res.json({ results: [] }); return; }
  const like = `%${q}%`;
  try {
    const [clients, contacts, products, opps, quotes, orders] = await Promise.all([
      db.select({ id: clientsTable.id, title: clientsTable.companyName, sub: clientsTable.industry })
        .from(clientsTable)
        .where(or(ilike(clientsTable.companyName, like), ilike(clientsTable.taxId, like), ilike(clientsTable.industry, like)))
        .limit(5),
      db.select({ id: contactsTable.id, first: contactsTable.firstName, last: contactsTable.lastName, email: contactsTable.email })
        .from(contactsTable)
        .where(or(ilike(contactsTable.firstName, like), ilike(contactsTable.lastName, like), ilike(contactsTable.email, like)))
        .limit(5),
      db.select({ id: productsTable.id, title: productsTable.name, sub: productsTable.code })
        .from(productsTable)
        .where(or(ilike(productsTable.name, like), ilike(productsTable.code, like), ilike(productsTable.category, like)))
        .limit(5),
      db.select({ id: opportunitiesTable.id, title: opportunitiesTable.title, sub: opportunitiesTable.status })
        .from(opportunitiesTable)
        .where(ilike(opportunitiesTable.title, like))
        .limit(5),
      db.select({ id: quotesTable.id, num: quotesTable.number })
        .from(quotesTable)
        .where(or(ilike(quotesTable.number, like), sql`${quotesTable.cuit} ilike ${like}`))
        .limit(5),
      db.select({ id: ordersTable.id, num: ordersTable.number })
        .from(ordersTable)
        .where(or(ilike(ordersTable.number, like), sql`${ordersTable.cuit} ilike ${like}`))
        .limit(5),
    ]);
    const results = [
      ...clients.map(c => ({ kind: "client", id: c.id, title: c.title, subtitle: c.sub || "Cliente", url: `/clients` })),
      ...contacts.map(c => ({ kind: "contact", id: c.id, title: `${c.first} ${c.last}`, subtitle: c.email || "Contacto", url: `/contacts/${c.id}` })),
      ...products.map(p => ({ kind: "product", id: p.id, title: p.title, subtitle: p.sub || "Producto", url: `/products` })),
      ...opps.map(o => ({ kind: "opportunity", id: o.id, title: o.title, subtitle: o.sub || "Oportunidad", url: `/opportunities` })),
      ...quotes.map(q => ({ kind: "quote", id: q.id, title: q.num || `Cotización #${q.id}`, subtitle: "Cotización", url: `/quotes/${q.id}` })),
      ...orders.map(o => ({ kind: "order", id: o.id, title: o.num || `Pedido #${o.id}`, subtitle: "Pedido", url: `/orders/${o.id}` })),
    ];
    res.json({ results });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
