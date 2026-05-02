import { Router, type IRouter } from "express";
import { db, clientsTable, contactsTable } from "@workspace/db";
import { sql, or, ilike, eq, ne, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/duplicates/clients", async (req, res) => {
  try {
    const taxId = String(req.query.taxId || "").trim();
    const companyName = String(req.query.companyName || "").trim();
    const excludeId = req.query.excludeId ? parseInt(String(req.query.excludeId)) : 0;
    const conds: any[] = [];
    if (taxId) conds.push(eq(clientsTable.taxId, taxId));
    if (companyName.length >= 3) conds.push(ilike(clientsTable.companyName, `%${companyName}%`));
    if (!conds.length) { res.json({ matches: [] }); return; }
    let where: any = or(...conds);
    if (excludeId) where = and(where, ne(clientsTable.id, excludeId));
    const matches = await db
      .select({ id: clientsTable.id, companyName: clientsTable.companyName, taxId: clientsTable.taxId, status: clientsTable.status })
      .from(clientsTable)
      .where(where)
      .limit(5);
    res.json({ matches });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/duplicates/contacts", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    const phone = String(req.query.phone || "").trim();
    const excludeId = req.query.excludeId ? parseInt(String(req.query.excludeId)) : 0;
    const conds: any[] = [];
    if (email) conds.push(sql`lower(${contactsTable.email}) = ${email}`);
    if (phone.length >= 6) conds.push(eq(contactsTable.phone, phone));
    if (!conds.length) { res.json({ matches: [] }); return; }
    let where: any = or(...conds);
    if (excludeId) where = and(where, ne(contactsTable.id, excludeId));
    const matches = await db
      .select({ id: contactsTable.id, firstName: contactsTable.firstName, lastName: contactsTable.lastName, email: contactsTable.email, phone: contactsTable.phone, clientId: contactsTable.clientId })
      .from(contactsTable)
      .where(where)
      .limit(5);
    res.json({ matches });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
