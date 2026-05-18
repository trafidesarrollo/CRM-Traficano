import { Router, type IRouter } from "express";
import { db, productsTable, productsMedidasTable } from "@workspace/db";
import { eq, ilike, sql } from "drizzle-orm";

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

// POST /api/products/medidas/import
// Bulk upsert for products_medidas (CSV import from products page)
// Body: { rows: Array<{ code, name, outerDiameter, nominalThickness, minLength, maxLength, seamType, steelType, heatTreatment, standard, shape, category, rawMaterial }> }
router.post("/products/medidas/import", async (req, res) => {
  try {
    const rows: any[] = req.body.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "Se requiere un array 'rows' con al menos un elemento" });
      return;
    }

    const CHUNK = 100;
    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK).map((r: any) => ({
        code: r.code || null,
        name: r.name,
        outerDiameter: r.outerDiameter != null && r.outerDiameter !== "" ? String(r.outerDiameter) : null,
        nominalThickness: r.nominalThickness != null && r.nominalThickness !== "" ? String(r.nominalThickness) : null,
        minLength: r.minLength != null && r.minLength !== "" ? String(r.minLength) : null,
        maxLength: r.maxLength != null && r.maxLength !== "" ? String(r.maxLength) : null,
        seamType: r.seamType || null,
        steelType: r.steelType || null,
        heatTreatment: r.heatTreatment || null,
        standard: r.standard || null,
        shape: r.shape || null,
        category: r.category || null,
        rawMaterial: r.rawMaterial || null,
        isActive: true,
      }));

      const result = await db
        .insert(productsMedidasTable)
        .values(chunk)
        .onConflictDoUpdate({
          target: productsMedidasTable.code,
          set: {
            name: sql`excluded.name`,
            outerDiameter: sql`excluded.outer_diameter`,
            nominalThickness: sql`excluded.nominal_thickness`,
            minLength: sql`excluded.min_length`,
            maxLength: sql`excluded.max_length`,
            seamType: sql`excluded.seam_type`,
            steelType: sql`excluded.steel_type`,
            heatTreatment: sql`excluded.heat_treatment`,
            standard: sql`excluded.standard`,
            shape: sql`excluded.shape`,
            category: sql`excluded.category`,
            rawMaterial: sql`excluded.raw_material`,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: productsMedidasTable.id });

      inserted += result.length;
    }

    res.json({ ok: true, total: rows.length, processed: inserted });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al importar productos" });
  }
});

// GET /api/products/medidas — list all medidas
router.get("/products/medidas", async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const data = search
      ? await db.select().from(productsMedidasTable)
          .where(ilike(productsMedidasTable.name, `%${search}%`))
      : await db.select().from(productsMedidasTable);
    res.json(data);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar medidas" });
  }
});

export default router;
