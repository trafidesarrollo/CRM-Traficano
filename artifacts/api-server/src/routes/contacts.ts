import { Router, type IRouter } from "express";
import { db, contactsTable, clientsTable } from "@workspace/db";
import { eq, ilike, and, or } from "drizzle-orm";

const router: IRouter = Router();

function contactName(row: any) {
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.fullName || row.name || "";
}

router.get("/contacts", async (req, res) => {
  try {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
    const search = req.query.search as string;

    let conditions: any[] = [];
    if (clientId) conditions.push(eq(contactsTable.clientId, clientId));
    if (search) {
      conditions.push(or(
        ilike(contactsTable.firstName, `%${search}%`),
        ilike(contactsTable.lastName, `%${search}%`),
        ilike(contactsTable.email, `%${search}%`),
      ));
    }

    const query = db.select({
      contact: contactsTable,
      companyName: clientsTable.companyName,
    })
      .from(contactsTable)
      .leftJoin(clientsTable, eq(contactsTable.clientId, clientsTable.id));

    const data = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    res.json(data.map(({ contact, companyName }) => ({
      ...contact,
      fullName: contactName(contact),
      companyName: companyName || null,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar contactos" });
  }
});

router.post("/contacts", async (req, res) => {
  try {
    const payload = {
      ...req.body,
      clientId: req.body.clientId ? parseInt(String(req.body.clientId)) : null,
      firstName: req.body.firstName || req.body.name || "",
      lastName: req.body.lastName || "",
      email: req.body.email || null,
      phone: req.body.phone || null,
      position: req.body.position || req.body.role || null,
      address: req.body.address || null,
      city: req.body.city || null,
    };
    if (!payload.clientId) {
      res.status(400).json({ error: "Empresa/cliente requerido" });
      return;
    }
    if (!payload.firstName.trim()) {
      res.status(400).json({ error: "El nombre del contacto es obligatorio" });
      return;
    }
    const [contact] = await db.insert(contactsTable).values(payload).returning();
    res.status(201).json({ ...contact, fullName: contactName(contact) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al crear contacto" });
  }
});

router.get("/contacts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const contacts = await db.select().from(contactsTable).where(eq(contactsTable.id, id)).limit(1);
    if (!contacts[0]) {
      res.status(404).json({ error: "Contacto no encontrado" });
      return;
    }
    res.json({ ...contacts[0], fullName: contactName(contacts[0]) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener contacto" });
  }
});

router.patch("/contacts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(contactsTable).set(req.body).where(eq(contactsTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Contacto no encontrado" });
      return;
    }
    res.json({ ...updated, fullName: contactName(updated) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al actualizar contacto" });
  }
});

router.delete("/contacts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(contactsTable).where(eq(contactsTable.id, id));
    res.json({ message: "Contacto eliminado" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al eliminar contacto" });
  }
});

export default router;
