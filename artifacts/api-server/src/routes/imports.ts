import { Router, type IRouter } from "express";
import { db, clientsTable, productsTable, contactsTable } from "@workspace/db";
import { requireRole } from "../middleware/auth.js";
import { auditAction } from "../lib/audit.js";

const router: IRouter = Router();

const importAuth = requireRole("admin", "gerente", "operador");

router.post("/imports/clients", importAuth, async (req, res) => {
  try {
    const { data, mode } = req.body;
    if (!Array.isArray(data)) {
      res.status(400).json({ error: "Datos inválidos" });
      return;
    }

    let inserted = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails: any[] = [];

    for (const row of data) {
      try {
        if (!row.companyName && !row.company_name) {
          errorDetails.push({ row, error: "companyName es requerido" });
          errors++;
          continue;
        }
        const clientData = {
          companyName: row.companyName || row.company_name,
          taxId: row.taxId || row.tax_id || row.cuit,
          industry: row.industry || row.industria,
          phone: row.phone || row.telefono,
          city: row.city || row.ciudad,
          country: row.country || row.pais || "Argentina",
          status: (row.status || row.estado || "prospect") as any,
        };

        if (mode === "upsert" && clientData.taxId) {
          await db.insert(clientsTable).values(clientData).onConflictDoUpdate({
            target: clientsTable.taxId,
            set: clientData,
          });
          updated++;
        } else {
          await db.insert(clientsTable).values(clientData);
          inserted++;
        }
      } catch (rowErr: any) {
        errors++;
        errorDetails.push({ row, error: rowErr.message });
      }
    }

    await auditAction(req, "importar_clientes", "import", undefined, {
      total: data.length, inserted, updated, errors,
    });

    res.json({ total: data.length, inserted, updated, errors, errorDetails });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al importar clientes" });
  }
});

router.post("/imports/products", importAuth, async (req, res) => {
  try {
    const { data, mode } = req.body;
    if (!Array.isArray(data)) {
      res.status(400).json({ error: "Datos inválidos" });
      return;
    }

    let inserted = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails: any[] = [];

    for (const row of data) {
      try {
        if (!row.name && !row.nombre) {
          errorDetails.push({ row, error: "name es requerido" });
          errors++;
          continue;
        }
        const productData = {
          name: row.name || row.nombre,
          code: row.code || row.codigo,
          description: row.description || row.descripcion,
          unit: row.unit || row.unidad,
          category: row.category || row.categoria,
          dimensions: row.dimensions || row.dimensiones || row.medidas,
          standard: row.standard || row.norma,
          price: row.price || row.precio ? parseFloat(row.price || row.precio) : undefined,
          currency: row.currency || row.moneda || "ARS",
          isActive: true,
        };

        await db.insert(productsTable).values(productData as any);
        inserted++;
      } catch (rowErr: any) {
        errors++;
        errorDetails.push({ row, error: rowErr.message });
      }
    }

    await auditAction(req, "importar_productos", "import", undefined, {
      total: data.length, inserted, updated, errors,
    });

    res.json({ total: data.length, inserted, updated, errors, errorDetails });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al importar productos" });
  }
});

router.post("/imports/contacts", importAuth, async (req, res) => {
  try {
    const { data, mode } = req.body;
    if (!Array.isArray(data)) {
      res.status(400).json({ error: "Datos inválidos" });
      return;
    }

    let inserted = 0;
    let errors = 0;
    const errorDetails: any[] = [];

    for (const row of data) {
      try {
        if (!row.firstName && !row.first_name && !row.nombre) {
          errorDetails.push({ row, error: "firstName es requerido" });
          errors++;
          continue;
        }
        const contactData = {
          clientId: parseInt(row.clientId || row.client_id || "0"),
          firstName: row.firstName || row.first_name || row.nombre,
          lastName: row.lastName || row.last_name || row.apellido || "",
          email: row.email,
          phone: row.phone || row.telefono,
          position: row.position || row.cargo,
          isPrimary: Boolean(row.isPrimary || row.is_primary),
        };

        await db.insert(contactsTable).values(contactData);
        inserted++;
      } catch (rowErr: any) {
        errors++;
        errorDetails.push({ row, error: rowErr.message });
      }
    }

    await auditAction(req, "importar_contactos", "import", undefined, {
      total: data.length, inserted, updated: 0, errors,
    });

    res.json({ total: data.length, inserted, updated: 0, errors, errorDetails });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al importar contactos" });
  }
});

export default router;
