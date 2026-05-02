import { Router, type IRouter } from "express";
import { db, priceListsTable, priceListItemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/price-lists", async (_req, res) => {
  try {
    const data = await db.select().from(priceListsTable).orderBy(priceListsTable.name);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/price-lists", async (req, res) => {
  try {
    if (req.body.isDefault) {
      await db.update(priceListsTable).set({ isDefault: false });
    }
    const [row] = await db.insert(priceListsTable).values(req.body).returning();
    res.status(201).json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/price-lists/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (req.body.isDefault) {
      await db.update(priceListsTable).set({ isDefault: false });
    }
    const [row] = await db.update(priceListsTable).set(req.body).where(eq(priceListsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "No encontrado" }); return; }
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/price-lists/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(priceListItemsTable).where(eq(priceListItemsTable.priceListId, id));
    await db.delete(priceListsTable).where(eq(priceListsTable.id, id));
    res.json({ message: "Eliminada" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/price-lists/:id/items", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const items = await db.select().from(priceListItemsTable).where(eq(priceListItemsTable.priceListId, id));
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/price-lists/:id/items", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.insert(priceListItemsTable).values({ ...req.body, priceListId: id }).returning();
    res.status(201).json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/price-list-items/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.update(priceListItemsTable).set(req.body).where(eq(priceListItemsTable.id, id)).returning();
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/price-list-items/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(priceListItemsTable).where(eq(priceListItemsTable.id, id));
    res.json({ message: "Eliminado" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
