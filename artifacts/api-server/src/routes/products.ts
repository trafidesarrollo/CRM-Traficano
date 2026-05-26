import { Router, type IRouter } from "express";
import { db, productsTable, productsMedidasTable, productsAccesoriosTable } from "@workspace/db";
import { eq, ilike, sql, and, isNotNull } from "drizzle-orm";

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

// GET /api/products/catalog — unified catalog: accesorios + medidas, paginated + filtered
router.get("/products/catalog", async (req, res) => {
  try {
    const esc = (v: string) => v.replace(/'/g, "''");
    const search = (req.query.search as string || "").trim();
    const type = req.query.type as string | undefined; // "accesorios" | "medidas"
    const accessoryType = req.query.accessoryType as string | undefined;
    const standard = req.query.standard as string | undefined;
    const category = req.query.category as string | undefined;
    const seamType = req.query.seamType as string | undefined;
    const shape = req.query.shape as string | undefined;
    const hasPrice = req.query.hasPrice === "true";
    const noPrice = req.query.noPrice === "true";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;

    // Build accesorios query conditions
    const accConds: string[] = [];
    if (search) accConds.push(`(pa.name ILIKE '%${esc(search)}%' OR pa.code ILIKE '%${esc(search)}%')`);
    if (accessoryType) accConds.push(`pa.accessory_type = '${esc(accessoryType)}'`);
    if (standard) accConds.push(`pa.standard = '${esc(standard)}'`);
    if (hasPrice) accConds.push(`pa.sale_price IS NOT NULL AND pa.sale_price > 0`);
    if (noPrice) accConds.push(`(pa.sale_price IS NULL OR pa.sale_price = 0)`);
    const accWhere = accConds.length ? `WHERE ${accConds.join(" AND ")}` : "";

    // Build medidas query conditions
    const medConds: string[] = [];
    if (search) medConds.push(`(pm.name ILIKE '%${esc(search)}%' OR pm.code ILIKE '%${esc(search)}%')`);
    if (category) medConds.push(`pm.category = '${esc(category)}'`);
    if (seamType) medConds.push(`pm.seam_type = '${esc(seamType)}'`);
    if (shape) medConds.push(`pm.shape = '${esc(shape)}'`);
    if (hasPrice) medConds.push(`pm.sale_price IS NOT NULL AND pm.sale_price > 0`);
    if (noPrice) medConds.push(`(pm.sale_price IS NULL OR pm.sale_price = 0)`);
    const medWhere = medConds.length ? `WHERE ${medConds.join(" AND ")}` : "";

    const accSelect = `
      SELECT pa.id, pa.code, pa.name, pa.standard, pa.sale_price::text AS sale_price,
             pa.accessory_type AS sub_type, pa.subtype AS sub_type2,
             pa.weight::text AS weight, NULL::text AS category,
             NULL::text AS outer_diameter, NULL::text AS nominal_thickness,
             NULL::text AS seam_type, 'accesorios' AS source
      FROM products_accesorios pa ${accWhere}
    `;

    const medSelect = `
      SELECT pm.id, pm.code, pm.name, pm.standard, pm.sale_price::text AS sale_price,
             pm.category AS sub_type, NULL::text AS sub_type2,
             NULL::text AS weight, pm.category,
             pm.outer_diameter::text AS outer_diameter, pm.nominal_thickness::text AS nominal_thickness,
             pm.seam_type, 'medidas' AS source
      FROM products_medidas pm ${medWhere}
    `;

    let dataQuery: string;
    let countQuery: string;

    if (type === "accesorios") {
      dataQuery = `${accSelect} ORDER BY name LIMIT ${limit} OFFSET ${offset}`;
      countQuery = `SELECT COUNT(*) FROM products_accesorios pa ${accWhere}`;
    } else if (type === "medidas") {
      dataQuery = `${medSelect} ORDER BY name LIMIT ${limit} OFFSET ${offset}`;
      countQuery = `SELECT COUNT(*) FROM products_medidas pm ${medWhere}`;
    } else {
      dataQuery = `SELECT * FROM (${accSelect} UNION ALL ${medSelect}) combined ORDER BY name LIMIT ${limit} OFFSET ${offset}`;
      countQuery = `SELECT COUNT(*) FROM (${accSelect} UNION ALL ${medSelect}) combined`;
    }

    const [dataResult, countResult] = await Promise.all([
      db.execute(sql.raw(dataQuery)),
      db.execute(sql.raw(countQuery)),
    ]);

    const total = parseInt((countResult.rows[0] as any)?.count || "0");

    res.json({
      data: dataResult.rows,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: err.message || "Error al listar catálogo" });
  }
});

// GET /api/products/catalog/filters — distinct filter values
router.get("/products/catalog/filters", async (req, res) => {
  try {
    const [accTypes, accStandards, medCats, medSeams, medShapes] = await Promise.all([
      db.execute(sql`SELECT DISTINCT accessory_type FROM products_accesorios WHERE accessory_type IS NOT NULL ORDER BY accessory_type`),
      db.execute(sql`SELECT DISTINCT standard FROM products_accesorios WHERE standard IS NOT NULL ORDER BY standard`),
      db.execute(sql`SELECT DISTINCT category FROM products_medidas WHERE category IS NOT NULL ORDER BY category`),
      db.execute(sql`SELECT DISTINCT seam_type FROM products_medidas WHERE seam_type IS NOT NULL ORDER BY seam_type`),
      db.execute(sql`SELECT DISTINCT shape FROM products_medidas WHERE shape IS NOT NULL ORDER BY shape`),
    ]);
    res.json({
      accessoryTypes: (accTypes.rows as any[]).map(r => r.accessory_type),
      accStandards: (accStandards.rows as any[]).map(r => r.standard),
      categories: (medCats.rows as any[]).map(r => r.category),
      seamTypes: (medSeams.rows as any[]).map(r => r.seam_type),
      shapes: (medShapes.rows as any[]).map(r => r.shape),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/products/medidas/:id — update medidas fields (price etc.)
router.patch("/products/medidas/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const allowed: any = {};
    if (req.body.salePrice !== undefined) allowed.salePrice = req.body.salePrice ? String(req.body.salePrice) : null;
    if (req.body.isActive !== undefined) allowed.isActive = req.body.isActive;
    const [updated] = await db.update(productsMedidasTable).set({ ...allowed, updatedAt: new Date() }).where(eq(productsMedidasTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Producto no encontrado" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al actualizar producto" });
  }
});

// PATCH /api/products/accesorios/:id — update accesorios fields (price etc.)
router.patch("/products/accesorios/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const allowed: any = {};
    if (req.body.salePrice !== undefined) allowed.salePrice = req.body.salePrice ? String(req.body.salePrice) : null;
    if (req.body.isActive !== undefined) allowed.isActive = req.body.isActive;
    const [updated] = await db.update(productsAccesoriosTable).set({ ...allowed, updatedAt: new Date() }).where(eq(productsAccesoriosTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Producto no encontrado" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al actualizar producto" });
  }
});

// GET /api/products/medidas — list/search medidas
router.get("/products/medidas", async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const data = search
      ? await db.select().from(productsMedidasTable)
          .where(ilike(productsMedidasTable.name, `%${search}%`))
          .limit(40)
      : await db.select().from(productsMedidasTable).limit(40);
    res.json(data);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar medidas" });
  }
});

// GET /api/products/accesorios — list/search accesorios
router.get("/products/accesorios", async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const data = search
      ? await db.select().from(productsAccesoriosTable)
          .where(ilike(productsAccesoriosTable.name, `%${search}%`))
          .limit(40)
      : await db.select().from(productsAccesoriosTable).limit(40);
    res.json(data);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar accesorios" });
  }
});

// POST /api/products/accesorios/import — bulk upsert accesorios from CSV
router.post("/products/accesorios/import", async (req, res) => {
  try {
    const rows: any[] = req.body.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "Se requiere un array 'rows' con al menos un elemento" });
      return;
    }
    const CHUNK = 100;
    let processed = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK).map((r: any) => ({
        code: r.code || null,
        name: r.name,
        accessoryType: r.accessoryType || null,
        subtype: r.subtype || null,
        unit: r.unit || null,
        value1: r.value1 != null && r.value1 !== "" ? String(r.value1) : null,
        value2: r.value2 != null && r.value2 !== "" ? String(r.value2) : null,
        value3: r.value3 != null && r.value3 !== "" ? String(r.value3) : null,
        value4: r.value4 != null && r.value4 !== "" ? String(r.value4) : null,
        value5: r.value5 || null,
        weight: r.weight != null && r.weight !== "" ? String(r.weight) : null,
        standard: r.standard || null,
        isActive: true,
      }));
      const result = await db
        .insert(productsAccesoriosTable)
        .values(chunk)
        .onConflictDoUpdate({
          target: productsAccesoriosTable.code,
          set: {
            name: sql`excluded.name`,
            accessoryType: sql`excluded.accessory_type`,
            subtype: sql`excluded.subtype`,
            unit: sql`excluded.unit`,
            value1: sql`excluded.value1`,
            value2: sql`excluded.value2`,
            value3: sql`excluded.value3`,
            value4: sql`excluded.value4`,
            value5: sql`excluded.value5`,
            weight: sql`excluded.weight`,
            standard: sql`excluded.standard`,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: productsAccesoriosTable.id });
      processed += result.length;
    }
    res.json({ ok: true, total: rows.length, processed });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al importar accesorios" });
  }
});

// POST /api/products/prices/import
// Body: { rows: Array<{ listName, product, uom, supplier, price }> }
// Matches products by exact name (case-insensitive, trimmed) across both tables
// Updates sale_price for matched products; returns matched/unmatched counts
router.post("/products/prices/import", async (req, res) => {
  try {
    const rows: any[] = req.body.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "Se requiere un array 'rows' con al menos un elemento" });
      return;
    }

    // Build name→price map (case-insensitive, trimmed)
    const priceMap = new Map<string, string>();
    for (const r of rows) {
      const name = (r.product || "").trim().toLowerCase();
      const price = r.price != null && r.price !== "" ? String(r.price).replace(",", ".") : null;
      if (name && price) priceMap.set(name, price);
    }

    // Fetch all product names from both tables
    const [medidas, accesorios] = await Promise.all([
      db.execute(sql`SELECT id, name FROM products_medidas WHERE is_active = true`),
      db.execute(sql`SELECT id, name FROM products_accesorios WHERE is_active = true`),
    ]);

    let matchedMedidas = 0;
    let matchedAccesorios = 0;
    const unmatched: string[] = [];

    // Match and update medidas
    const medidasUpdates: { id: number; price: string }[] = [];
    for (const row of medidas.rows as any[]) {
      const key = (row.name || "").trim().toLowerCase();
      if (priceMap.has(key)) {
        medidasUpdates.push({ id: row.id, price: priceMap.get(key)! });
      }
    }

    // Match and update accesorios
    const accesoriosUpdates: { id: number; price: string }[] = [];
    for (const row of accesorios.rows as any[]) {
      const key = (row.name || "").trim().toLowerCase();
      if (priceMap.has(key)) {
        accesoriosUpdates.push({ id: row.id, price: priceMap.get(key)! });
      }
    }

    // Determine unmatched names
    const allProductKeys = new Set([
      ...(medidas.rows as any[]).map((r: any) => (r.name || "").trim().toLowerCase()),
      ...(accesorios.rows as any[]).map((r: any) => (r.name || "").trim().toLowerCase()),
    ]);
    for (const [key] of priceMap) {
      if (!allProductKeys.has(key)) unmatched.push(key);
    }

    // Bulk update in chunks
    const CHUNK = 50;
    for (let i = 0; i < medidasUpdates.length; i += CHUNK) {
      const chunk = medidasUpdates.slice(i, i + CHUNK);
      for (const u of chunk) {
        await db.update(productsMedidasTable).set({ salePrice: u.price, updatedAt: new Date() }).where(eq(productsMedidasTable.id, u.id));
      }
      matchedMedidas += chunk.length;
    }
    for (let i = 0; i < accesoriosUpdates.length; i += CHUNK) {
      const chunk = accesoriosUpdates.slice(i, i + CHUNK);
      for (const u of chunk) {
        await db.update(productsAccesoriosTable).set({ salePrice: u.price, updatedAt: new Date() }).where(eq(productsAccesoriosTable.id, u.id));
      }
      matchedAccesorios += chunk.length;
    }

    res.json({
      ok: true,
      total: rows.length,
      matched: matchedMedidas + matchedAccesorios,
      matchedMedidas,
      matchedAccesorios,
      unmatched: unmatched.length,
      unmatchedSample: unmatched.slice(0, 10),
    });
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: err.message || "Error al importar precios" });
  }
});

export default router;
