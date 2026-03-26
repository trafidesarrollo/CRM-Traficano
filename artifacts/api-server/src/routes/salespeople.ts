import { Router, type IRouter } from "express";
import { db, salespeopleTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/salespeople", async (req, res) => {
  try {
    const data = await db.select().from(salespeopleTable);
    res.json(data);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar vendedores" });
  }
});

router.post("/salespeople", async (req, res) => {
  try {
    const [salesperson] = await db.insert(salespeopleTable).values(req.body).returning();
    res.status(201).json(salesperson);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al crear vendedor" });
  }
});

router.get("/salespeople/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = await db.select().from(salespeopleTable).where(eq(salespeopleTable.id, id)).limit(1);
    if (!data[0]) {
      res.status(404).json({ error: "Vendedor no encontrado" });
      return;
    }
    res.json(data[0]);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener vendedor" });
  }
});

router.patch("/salespeople/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(salespeopleTable).set(req.body).where(eq(salespeopleTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Vendedor no encontrado" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al actualizar vendedor" });
  }
});

router.delete("/salespeople/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(salespeopleTable).where(eq(salespeopleTable.id, id));
    res.json({ message: "Vendedor eliminado" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al eliminar vendedor" });
  }
});

export default router;
