import { Router, type IRouter } from "express";
import { db, productsTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";

const router: IRouter = Router();

router.get("/products", async (req, res) => {
  try {
    const search = req.query.search as string;
    const data = search
      ? await db.select().from(productsTable).where(ilike(productsTable.name, `%${search}%`))
      : await db.select().from(productsTable);
    res.json(data);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar productos" });
  }
});

router.post("/products", async (req, res) => {
  try {
    const [product] = await db.insert(productsTable).values(req.body).returning();
    res.status(201).json(product);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al crear producto" });
  }
});

router.patch("/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(productsTable).set(req.body).where(eq(productsTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al actualizar producto" });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(productsTable).where(eq(productsTable.id, id));
    res.json({ message: "Producto eliminado" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al eliminar producto" });
  }
});

export default router;
