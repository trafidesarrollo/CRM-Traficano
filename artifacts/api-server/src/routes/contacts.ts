import { Router, type IRouter } from "express";
import { db, contactsTable } from "@workspace/db";
import { eq, ilike, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/contacts", async (req, res) => {
  try {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
    const search = req.query.search as string;

    let conditions: any[] = [];
    if (clientId) conditions.push(eq(contactsTable.clientId, clientId));
    if (search) {
      conditions.push(ilike(contactsTable.firstName, `%${search}%`));
    }

    const data = conditions.length > 0
      ? await db.select().from(contactsTable).where(and(...conditions))
      : await db.select().from(contactsTable);

    res.json(data);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar contactos" });
  }
});

router.post("/contacts", async (req, res) => {
  try {
    const [contact] = await db.insert(contactsTable).values(req.body).returning();
    res.status(201).json(contact);
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
    res.json(contacts[0]);
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
    res.json(updated);
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
