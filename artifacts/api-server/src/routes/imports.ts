import { Router, type IRouter } from "express";
import { db, clientsTable, productsTable, contactsTable, salespeopleTable, importLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import multer from "multer";
import { requireRole } from "../middleware/auth.js";
import { auditAction } from "../lib/audit.js";
import { parseCSV, applyColumnMapping } from "../lib/csv-parser.js";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const importAuth = requireRole("admin", "gerente", "operador");

const ENTITY_FIELDS: Record<string, { required: string[]; optional: string[]; aliases: Record<string, string> }> = {
  clients: {
    required: ["companyName"],
    optional: ["taxId", "industry", "phone", "address", "city", "country", "website", "status", "notes"],
    aliases: {
      company_name: "companyName", empresa: "companyName", razon_social: "companyName",
      tax_id: "taxId", cuit: "taxId", rut: "taxId",
      industria: "industry", rubro: "industry",
      telefono: "phone", tel: "phone",
      direccion: "address",
      ciudad: "city", localidad: "city",
      pais: "country",
      sitio_web: "website", web: "website",
      estado: "status",
      observaciones: "notes", notas: "notes",
    },
  },
  contacts: {
    required: ["firstName", "clientId"],
    optional: ["lastName", "email", "phone", "position", "isPrimary", "notes"],
    aliases: {
      first_name: "firstName", nombre: "firstName",
      last_name: "lastName", apellido: "lastName",
      client_id: "clientId", id_cliente: "clientId",
      telefono: "phone", tel: "phone",
      cargo: "position", puesto: "position",
      is_primary: "isPrimary", principal: "isPrimary",
      observaciones: "notes", notas: "notes",
    },
  },
  products: {
    required: ["name"],
    optional: ["code", "description", "unit", "category", "dimensions", "standard", "price", "currency"],
    aliases: {
      nombre: "name", producto: "name",
      codigo: "code", cod: "code",
      descripcion: "description",
      unidad: "unit",
      categoria: "category", familia: "category",
      dimensiones: "dimensions", medidas: "dimensions", medida: "dimensions",
      norma: "standard",
      precio: "price",
      moneda: "currency",
    },
  },
  salespeople: {
    required: ["name", "email"],
    optional: ["phone", "territory", "userId"],
    aliases: {
      nombre: "name", vendedor: "name",
      telefono: "phone", tel: "phone",
      zona: "territory", territorio: "territory",
      user_id: "userId", id_usuario: "userId",
    },
  },
};

function autoMapColumns(csvHeaders: string[], entityType: string): Record<string, string> {
  const config = ENTITY_FIELDS[entityType];
  if (!config) return {};

  const mapping: Record<string, string> = {};
  const allFields = [...config.required, ...config.optional];

  for (const header of csvHeaders) {
    const normalized = header.toLowerCase().trim();

    if (allFields.includes(header)) {
      mapping[header] = header;
      continue;
    }

    if (config.aliases[normalized]) {
      mapping[header] = config.aliases[normalized];
      continue;
    }

    const camelCase = normalized.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    if (allFields.includes(camelCase)) {
      mapping[header] = camelCase;
    }
  }

  return mapping;
}

router.post("/imports/upload", importAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No se proporcionó archivo" });
      return;
    }

    const entityType = req.body.entityType;
    if (!ENTITY_FIELDS[entityType]) {
      res.status(400).json({ error: `Tipo de entidad inválido: ${entityType}. Válidos: ${Object.keys(ENTITY_FIELDS).join(", ")}` });
      return;
    }

    const content = req.file.buffer.toString("utf-8");
    const parsed = parseCSV(content);

    if (parsed.rows.length === 0) {
      res.status(400).json({ error: "El archivo está vacío o no tiene datos" });
      return;
    }

    const suggestedMapping = autoMapColumns(parsed.headers, entityType);
    const config = ENTITY_FIELDS[entityType];
    const unmappedRequired = config.required.filter(
      (f) => !Object.values(suggestedMapping).includes(f),
    );

    const previewRows = parsed.rows.slice(0, 10);

    res.json({
      fileName: req.file.originalname,
      entityType,
      delimiter: parsed.delimiter,
      totalRows: parsed.totalRows,
      headers: parsed.headers,
      suggestedMapping,
      unmappedRequired,
      availableFields: [...config.required, ...config.optional],
      requiredFields: config.required,
      preview: previewRows,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al procesar archivo CSV" });
  }
});

router.post("/imports/execute", importAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No se proporcionó archivo" });
      return;
    }

    const entityType = req.body.entityType;
    const mode = (req.body.mode || "insert") as "insert" | "update" | "upsert";
    let columnMapping: Record<string, string>;

    try {
      columnMapping = JSON.parse(req.body.columnMapping || "{}");
    } catch {
      res.status(400).json({ error: "columnMapping inválido" });
      return;
    }

    if (!ENTITY_FIELDS[entityType]) {
      res.status(400).json({ error: `Tipo de entidad inválido: ${entityType}` });
      return;
    }

    const config = ENTITY_FIELDS[entityType];
    const mappedFields = Object.values(columnMapping);
    const missingRequired = config.required.filter((f) => !mappedFields.includes(f));
    if (missingRequired.length > 0) {
      res.status(400).json({ error: `Campos obligatorios sin mapear: ${missingRequired.join(", ")}` });
      return;
    }

    const content = req.file.buffer.toString("utf-8");
    const parsed = parseCSV(content);
    const mappedRows = applyColumnMapping(parsed.rows, columnMapping);

    const userId = (req as any).userId;

    const [importLog] = await db.insert(importLogsTable).values({
      userId,
      entityType,
      fileName: req.file.originalname,
      totalRows: parsed.totalRows,
      mode,
      status: "processing",
      columnMapping,
    }).returning();

    let inserted = 0;
    let updated = 0;
    let errors = 0;
    let skipped = 0;
    const errorDetails: { row: number; data: any; error: string }[] = [];

    for (let i = 0; i < mappedRows.length; i++) {
      const row = mappedRows[i];
      try {
        let result: "inserted" | "updated" | "skipped";
        switch (entityType) {
          case "clients":
            result = await importClient(row, mode);
            break;
          case "contacts":
            result = await importContact(row, mode);
            break;
          case "products":
            result = await importProduct(row, mode);
            break;
          case "salespeople":
            result = await importSalesperson(row, mode);
            break;
          default:
            result = "skipped";
        }

        if (result === "inserted") inserted++;
        else if (result === "updated") updated++;
        else skipped++;
      } catch (rowErr: any) {
        errors++;
        errorDetails.push({ row: i + 2, data: row, error: rowErr.message });
      }
    }

    await db.update(importLogsTable).set({
      insertedRows: inserted,
      updatedRows: updated,
      errorRows: errors,
      skippedRows: skipped,
      status: "completed",
      errorDetails: errorDetails.length > 0 ? errorDetails : null,
      summary: `Insertados: ${inserted}, Actualizados: ${updated}, Errores: ${errors}`,
      completedAt: new Date(),
    }).where(eq(importLogsTable.id, importLog.id));

    await auditAction(req, `importar_${entityType}`, "import", importLog.id, {
      fileName: req.file.originalname, total: parsed.totalRows, inserted, updated, errors,
    });

    res.json({
      importId: importLog.id,
      total: parsed.totalRows,
      inserted,
      updated,
      errors,
      skipped,
      errorDetails,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al ejecutar importación" });
  }
});

router.get("/imports/logs", importAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const data = await db.select().from(importLogsTable)
      .orderBy(desc(importLogsTable.createdAt))
      .limit(limit).offset(offset);

    res.json(data);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar importaciones" });
  }
});

router.get("/imports/logs/:id", importAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = await db.select().from(importLogsTable).where(eq(importLogsTable.id, id)).limit(1);
    if (!data[0]) {
      res.status(404).json({ error: "Importación no encontrada" });
      return;
    }
    res.json(data[0]);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener importación" });
  }
});

router.get("/imports/logs/:id/errors", importAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = await db.select().from(importLogsTable).where(eq(importLogsTable.id, id)).limit(1);
    if (!data[0]) {
      res.status(404).json({ error: "Importación no encontrada" });
      return;
    }

    const errorDetails = (data[0].errorDetails as any[]) || [];
    if (errorDetails.length === 0) {
      res.set("Content-Type", "text/csv");
      res.set("Content-Disposition", `attachment; filename="errores_import_${id}.csv"`);
      res.send("Sin errores");
      return;
    }

    const headers = ["fila", "error", ...Object.keys(errorDetails[0].data || {})];
    const csvLines = [headers.join(",")];

    for (const err of errorDetails) {
      const values = [
        String(err.row),
        `"${(err.error || "").replace(/"/g, '""')}"`,
        ...Object.values(err.data || {}).map((v: any) => `"${String(v || "").replace(/"/g, '""')}"`),
      ];
      csvLines.push(values.join(","));
    }

    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="errores_import_${id}.csv"`);
    res.send("\uFEFF" + csvLines.join("\n"));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al exportar errores" });
  }
});

router.get("/imports/template/:entityType", importAuth, (req, res) => {
  const entityType = req.params.entityType;
  const config = ENTITY_FIELDS[entityType];
  if (!config) {
    res.status(400).json({ error: `Tipo de entidad inválido: ${entityType}` });
    return;
  }

  const headers = [...config.required, ...config.optional];
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="plantilla_${entityType}.csv"`);
  res.send("\uFEFF" + headers.join(",") + "\n");
});

async function importClient(row: Record<string, string>, mode: string): Promise<"inserted" | "updated" | "skipped"> {
  if (!row.companyName) throw new Error("companyName es requerido");

  const data = {
    companyName: row.companyName,
    taxId: row.taxId || undefined,
    industry: row.industry || undefined,
    phone: row.phone || undefined,
    address: row.address || undefined,
    city: row.city || undefined,
    country: row.country || "Argentina",
    website: row.website || undefined,
    status: (row.status || "prospect") as any,
    notes: row.notes || undefined,
  };

  if (mode === "upsert" && data.taxId) {
    const existing = await db.select({ id: clientsTable.id }).from(clientsTable).where(eq(clientsTable.taxId, data.taxId)).limit(1);
    if (existing.length > 0) {
      await db.update(clientsTable).set({ ...data, updatedAt: new Date() }).where(eq(clientsTable.id, existing[0].id));
      return "updated";
    }
    await db.insert(clientsTable).values(data);
    return "inserted";
  } else if (mode === "update") {
    if (!data.taxId) throw new Error("taxId requerido para modo update");
    const [updated] = await db.update(clientsTable).set({ ...data, updatedAt: new Date() }).where(eq(clientsTable.taxId, data.taxId)).returning({ id: clientsTable.id });
    if (!updated) return "skipped";
    return "updated";
  } else {
    await db.insert(clientsTable).values(data);
    return "inserted";
  }
}

async function importContact(row: Record<string, string>, mode: string): Promise<"inserted" | "updated" | "skipped"> {
  if (!row.firstName) throw new Error("firstName es requerido");
  if (!row.clientId) throw new Error("clientId es requerido");

  const data = {
    clientId: parseInt(row.clientId),
    firstName: row.firstName,
    lastName: row.lastName || "",
    email: row.email || undefined,
    phone: row.phone || undefined,
    position: row.position || undefined,
    isPrimary: row.isPrimary === "true" || row.isPrimary === "1" || row.isPrimary === "si",
    notes: row.notes || undefined,
  };

  if ((mode === "upsert" || mode === "update") && data.email) {
    const existing = await db.select({ id: contactsTable.id }).from(contactsTable).where(eq(contactsTable.email, data.email)).limit(1);
    if (existing.length > 0) {
      await db.update(contactsTable).set(data).where(eq(contactsTable.id, existing[0].id));
      return "updated";
    } else if (mode === "update") {
      return "skipped";
    }
  }

  await db.insert(contactsTable).values(data);
  return "inserted";
}

async function importProduct(row: Record<string, string>, mode: string): Promise<"inserted" | "updated" | "skipped"> {
  if (!row.name) throw new Error("name es requerido");

  const data = {
    name: row.name,
    code: row.code || undefined,
    description: row.description || undefined,
    unit: row.unit || undefined,
    category: row.category || undefined,
    dimensions: row.dimensions || undefined,
    standard: row.standard || undefined,
    price: row.price ? parseFloat(row.price) : undefined,
    currency: row.currency || "ARS",
    isActive: true,
  } as any;

  if ((mode === "upsert" || mode === "update") && data.code) {
    const existing = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.code, data.code)).limit(1);
    if (existing.length > 0) {
      await db.update(productsTable).set({ ...data, updatedAt: new Date() }).where(eq(productsTable.id, existing[0].id));
      return "updated";
    } else if (mode === "update") {
      return "skipped";
    }
  }

  await db.insert(productsTable).values(data);
  return "inserted";
}

async function importSalesperson(row: Record<string, string>, mode: string): Promise<"inserted" | "updated" | "skipped"> {
  if (!row.name) throw new Error("name es requerido");
  if (!row.email) throw new Error("email es requerido");

  const data = {
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    territory: row.territory || undefined,
    userId: row.userId ? parseInt(row.userId) : undefined,
    isActive: true,
  };

  if ((mode === "upsert" || mode === "update") && data.email) {
    const existing = await db.select({ id: salespeopleTable.id }).from(salespeopleTable).where(eq(salespeopleTable.email, data.email)).limit(1);
    if (existing.length > 0) {
      await db.update(salespeopleTable).set(data).where(eq(salespeopleTable.id, existing[0].id));
      return "updated";
    } else if (mode === "update") {
      return "skipped";
    }
  }

  await db.insert(salespeopleTable).values(data);
  return "inserted";
}

export default router;
