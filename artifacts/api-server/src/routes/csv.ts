import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  clientsTable,
  contactsTable,
  productsTable,
  opportunitiesTable,
  salespeopleTable,
  tasksTable,
  activitiesTable,
  followupRulesTable,
  scheduledFollowupsTable,
  pipelinesTable,
  pipelineStagesTable,
  quotesTable,
  ordersTable,
  usersTable,
} from "@workspace/db";
import { sql, eq } from "drizzle-orm";

const router: IRouter = Router();

const DEFAULT_MASSIVE_HEADERS = new Set([
  "nro_cliente",
  "customer_name",
  "cliente",
  "movementdate",
  "fecha",
  "tracingdate",
  "fecha_seguimiento",
  "urgencia",
  "prioritytype_id",
  "title",
  "titulo",
  "description",
  "novedad",
  "action",
  "accion",
]);

type EntityDef = {
  table: any;
  fields: string[];
  required?: string[];
  jsonFields?: string[];
  numericFields?: string[];
  booleanFields?: string[];
};

const ENTITIES: Record<string, EntityDef> = {
  clients: {
    table: clientsTable,
    fields: ["id", "companyName", "taxId", "industry", "website", "phone", "address", "city", "country", "status", "assignedSalespersonId", "clientEmails", "notes"],
    required: ["companyName"],
    jsonFields: ["clientEmails"],
    numericFields: ["assignedSalespersonId"],
  },
  contacts: {
    table: contactsTable,
    fields: ["id", "clientId", "firstName", "lastName", "email", "phone", "position", "isPrimary", "notes", "linkedinUrl", "photoUrl", "emails", "phones", "tags", "leadScore", "source", "status"],
    required: ["clientId", "firstName", "lastName"],
    jsonFields: ["emails", "phones", "tags"],
    numericFields: ["clientId", "leadScore"],
    booleanFields: ["isPrimary"],
  },
  products: {
    table: productsTable,
    fields: ["id", "code", "name", "description", "unit", "category", "dimensions", "standard", "price", "currency", "isActive"],
    required: ["name"],
    numericFields: ["price"],
    booleanFields: ["isActive"],
  },
  opportunities: {
    table: opportunitiesTable,
    fields: ["id", "title", "clientId", "status", "priority", "estimatedValue", "currency", "description", "hunterId", "farmerId", "pipelineId", "stageId"],
    required: ["title"],
    numericFields: ["clientId", "estimatedValue", "hunterId", "farmerId", "pipelineId", "stageId"],
  },
  salespeople: {
    table: salespeopleTable,
    fields: ["id", "name", "email", "phone", "functionalRole", "isActive"],
    required: ["name", "email"],
    booleanFields: ["isActive"],
  },
  tasks: {
    table: tasksTable,
    fields: ["id", "title", "description", "type", "status", "priority", "assignedTo", "createdBy", "dueDate", "opportunityId", "clientId", "contactId"],
    required: ["title"],
    numericFields: ["assignedTo", "createdBy", "opportunityId", "clientId", "contactId"],
  },
  pipelines: {
    table: pipelinesTable,
    fields: ["id", "name", "description", "isActive", "isDefault", "sortOrder"],
    required: ["name"],
    booleanFields: ["isActive", "isDefault"],
    numericFields: ["sortOrder"],
  },
  pipeline_stages: {
    table: pipelineStagesTable,
    fields: ["id", "pipelineId", "name", "color", "sortOrder", "winProbability", "slaHours", "isWon", "isLost"],
    required: ["pipelineId", "name"],
    numericFields: ["pipelineId", "sortOrder", "winProbability", "slaHours"],
    booleanFields: ["isWon", "isLost"],
  },
  quotes: {
    table: quotesTable,
    fields: ["id", "quoteNumber", "clientId", "opportunityId", "status", "totalAmount", "currency", "validUntil", "notes"],
    numericFields: ["clientId", "opportunityId", "totalAmount"],
  },
  orders: {
    table: ordersTable,
    fields: ["id", "orderNumber", "clientId", "quoteId", "status", "totalAmount", "currency", "notes"],
    numericFields: ["clientId", "quoteId", "totalAmount"],
  },
};

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (v instanceof Date) s = v.toISOString();
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: any[], fields: string[]): string {
  const header = fields.join(",");
  const body = rows.map(r => fields.map(f => csvEscape(r[f])).join(",")).join("\n");
  return header + "\n" + body + "\n";
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); field = "";
        if (cur.length > 1 || cur[0] !== "") lines.push(cur);
        cur = [];
      } else field += c;
    }
  }
  if (field !== "" || cur.length) { cur.push(field); if (cur.length > 1 || cur[0] !== "") lines.push(cur); }
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].map(h => h.trim());
  const rows = lines.slice(1).map(l => {
    const r: Record<string, string> = {};
    headers.forEach((h, i) => { r[h] = l[i] ?? ""; });
    return r;
  });
  return { headers, rows };
}

function coerceValue(def: EntityDef, key: string, raw: string): any {
  if (raw === "" || raw === undefined) return null;
  if (def.jsonFields?.includes(key)) {
    try { return JSON.parse(raw); } catch { return raw.split(";").map(s => s.trim()).filter(Boolean); }
  }
  if (def.numericFields?.includes(key)) { const n = Number(raw); return isNaN(n) ? null : n; }
  if (def.booleanFields?.includes(key)) return /^(true|1|yes|si|sí)$/i.test(raw);
  return raw;
}

function parseFlexibleCsv(text: string, forcedSeparator?: string): { headers: string[]; rows: Record<string, string>[] } {
  const separator = forcedSeparator || (text.includes(";") && !text.includes(",") ? ";" : ",");
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(separator).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(separator);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? "").trim(); });
    return row;
  });
  return { headers, rows };
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

router.get("/csv/entities", (_req, res) => {
  res.json({ entities: Object.keys(ENTITIES).map(k => ({ key: k, fields: ENTITIES[k].fields, required: ENTITIES[k].required || [] })) });
});

router.get("/csv/template/:entity", (req, res) => {
  const def = ENTITIES[req.params.entity];
  if (!def) { res.status(404).json({ error: "Entidad no soportada" }); return; }
  const fields = def.fields.filter(f => f !== "id");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${req.params.entity}-template.csv"`);
  res.send(fields.join(",") + "\n");
});

router.get("/csv/export/:entity", async (req: Request, res: Response) => {
  const def = ENTITIES[req.params.entity];
  if (!def) { res.status(404).json({ error: "Entidad no soportada" }); return; }
  try {
    const rows = await db.select().from(def.table).limit(10000);
    const csv = rowsToCsv(rows, def.fields);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.entity}-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/csv/import/client-followups", async (req: Request, res: Response) => {
  try {
    const { csv, separator } = req.body || {};
    if (typeof csv !== "string" || !csv.trim()) {
      res.status(400).json({ error: "csv requerido" });
      return;
    }

    const { headers, rows } = parseFlexibleCsv(csv, separator);
    if (!headers.length) {
      res.status(400).json({ error: "CSV vacío" });
      return;
    }

    const lowerHeaders = headers.map(h => h.trim().toLowerCase());
    const hasRequired = lowerHeaders.includes("nro_cliente") && (lowerHeaders.includes("description") || lowerHeaders.includes("novedad"));
    if (!hasRequired) {
      res.status(400).json({ error: "El CSV debe incluir nro_cliente y description/novedad" });
      return;
    }

    const createdTasks: any[] = [];
    const createdActivities: any[] = [];
    const createdFollowups: any[] = [];
    const errors: { line: number; error: string }[] = [];

    const headerMap = (name: string) => {
      const idx = lowerHeaders.indexOf(name);
      return idx >= 0 ? headers[idx] : null;
    };

    const hNro = headerMap("nro_cliente");
    const hName = headerMap("customer_name") || headerMap("cliente");
    const hMovement = headerMap("movementdate") || headerMap("fecha");
    const hTracing = headerMap("tracingdate") || headerMap("fecha_seguimiento");
    const hUrgencia = headerMap("urgencia") || headerMap("prioritytype_id");
    const hTitle = headerMap("title") || headerMap("titulo");
    const hDesc = headerMap("description") || headerMap("novedad");
    const hAction = headerMap("action") || headerMap("accion");

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const nro = (row[hNro!] || "").trim();
        const description = (row[hDesc!] || "").trim();
        if (!nro || !description) {
          errors.push({ line: i + 2, error: "Faltan nro_cliente o description/novedad" });
          continue;
        }

        const client = await db.select().from(clientsTable).where(
          sql`${clientsTable.id}::text = ${nro} OR ${clientsTable.companyName} ILIKE ${nro} OR ${clientsTable.taxId} = ${nro} OR ${clientsTable.externalId} = ${nro}`
        ).limit(1);
        if (!client[0]) {
          errors.push({ line: i + 2, error: `Cliente no encontrado: ${nro}` });
          continue;
        }

        const baseDate = row[hMovement!] ? new Date(row[hMovement!]) : new Date();
        const followDate = row[hTracing!] ? new Date(row[hTracing!]) : addDays(new Date(), 3);
        const taskTitle = (row[hTitle!] || `Seguimiento cliente ${client[0].companyName}`).trim();
        const priority = /alta/i.test(row[hUrgencia!] || "") ? "urgent" : /media/i.test(row[hUrgencia!] || "") ? "medium" : "low";
        const taskDescription = row[hAction!] ? `${description}\n\nPróxima acción: ${row[hAction!]}` : description;

        const [task] = await db.insert(tasksTable).values({
          title: taskTitle,
          description: taskDescription,
          type: "followup",
          status: "pending",
          priority,
          clientId: client[0].id,
          dueDate: followDate,
        }).returning();

        const [activity] = await db.insert(activitiesTable).values({
          type: "follow_up",
          title: taskTitle,
          description: row[hAction!] ? `${description}\n\nPróxima acción: ${row[hAction!]}` : description,
          clientId: client[0].id,
          completedAt: baseDate,
        }).returning();

        const [rule] = await db.select().from(followupRulesTable).where(eq(followupRulesTable.isActive, true)).limit(1);
        const [followup] = await db.insert(scheduledFollowupsTable).values({
          ruleId: rule?.id || null,
          opportunityId: null,
          clientId: client[0].id,
          contactId: null,
          scheduledDate: followDate,
          status: "pending",
          attemptNumber: 1,
          generatedSubject: taskTitle,
        }).returning();

        createdTasks.push(task);
        createdActivities.push(activity);
        createdFollowups.push(followup);
      } catch (e: any) {
        errors.push({ line: i + 2, error: e.message });
      }
    }

    res.json({
      ok: true,
      total: rows.length,
      createdTasks: createdTasks.length,
      createdActivities: createdActivities.length,
      createdFollowups: createdFollowups.length,
      errors: errors.slice(0, 100),
      acceptedHeaders: [...DEFAULT_MASSIVE_HEADERS],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/csv/import/clients-bulk", async (req: Request, res: Response) => {
  try {
    const { csv, separator } = req.body || {};
    if (typeof csv !== "string" || !csv.trim()) {
      res.status(400).json({ error: "csv requerido" });
      return;
    }

    const { headers, rows } = parseFlexibleCsv(csv, separator);
    if (!headers.length) {
      res.status(400).json({ error: "CSV vacío" });
      return;
    }

    const lowerHeaders = headers.map(h => h.trim().toLowerCase().replace(/[^a-záéíóúüñ0-9]/gi, ""));

    const colIdx = (candidates: string[]) => {
      for (const c of candidates) {
        const norm = c.toLowerCase().replace(/[^a-záéíóúüñ0-9]/gi, "");
        const i = lowerHeaders.indexOf(norm);
        if (i >= 0) return headers[i];
      }
      return null;
    };

    const hNro       = colIdx(["Número de cliente", "nrocliente", "numerodecliente", "nro", "id"]);
    const hRazon     = colIdx(["Razón social", "razonsocial", "empresa", "companyName", "companyname"]);
    const hDoc       = colIdx(["Número de documento", "numerodedocumento", "cuit", "taxId", "taxid"]);
    const hTel       = colIdx(["Telefono", "teléfono", "telefono", "phone"]);
    const hEmail     = colIdx(["Correo", "email", "correoelectronico", "mail"]);
    const hLocalidad = colIdx(["Localidad", "localidad", "city", "ciudad"]);
    const hProvincia = colIdx(["Provincia", "provincia"]);
    const hPartido   = colIdx(["Partido", "partido"]);
    const hImport    = colIdx(["Importancia", "importancia"]);
    const hRubro     = colIdx(["Rubro", "rubro", "industry"]);
    const hZona      = colIdx(["Zona", "zona"]);
    const hResp1     = colIdx(["Responsable 1", "responsable1", "responsable"]);
    const hResp2     = colIdx(["Responsable 2", "responsable2"]);

    const allSalespeople = await db.select().from(salespeopleTable);

    const findSalesperson = (name: string) => {
      if (!name || !name.trim()) return null;
      const n = name.trim().toLowerCase();
      return allSalespeople.find(s =>
        s.name.toLowerCase().includes(n) || n.includes(s.name.toLowerCase().split(" ")[0])
      ) || null;
    };

    let inserted = 0, updated = 0, skipped = 0;
    const errors: { line: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const companyName = (hRazon ? row[hRazon] : "").trim();
        if (!companyName) {
          errors.push({ line: i + 2, error: "Razón social vacía" });
          skipped++;
          continue;
        }

        const externalId  = hNro       ? row[hNro].trim()       : null;
        const taxId       = hDoc       ? row[hDoc].trim()       : null;
        const phone       = hTel       ? row[hTel].trim()       : null;
        const emailRaw    = hEmail     ? row[hEmail].trim()     : "";
        const city        = hLocalidad ? row[hLocalidad].trim() : null;
        const provincia   = hProvincia ? row[hProvincia].trim() : null;
        const partido     = hPartido   ? row[hPartido].trim()   : null;
        const importancia = hImport    ? row[hImport].trim()    : "";
        const industry    = hRubro     ? row[hRubro].trim()     : null;
        const zona        = hZona      ? row[hZona].trim()      : null;
        const resp1       = hResp1     ? row[hResp1].trim()     : "";
        const resp2       = hResp2     ? row[hResp2].trim()     : "";

        const clientEmails: string[] = emailRaw && emailRaw !== "[]"
          ? emailRaw.split(/[;,]/).map((e: string) => e.trim()).filter((e: string) => e.includes("@"))
          : [];

        const status: "active" | "inactive" | "prospect" =
          /alta/i.test(importancia) ? "active" :
          /baja/i.test(importancia) ? "inactive" : "prospect";

        const sp = findSalesperson(resp1);

        const notesParts: string[] = [];
        if (zona) notesParts.push(`Zona: ${zona}`);
        if (partido) notesParts.push(`Partido: ${partido}`);
        if (resp2) notesParts.push(`Responsable 2: ${resp2}`);
        const notes = notesParts.length ? notesParts.join(" | ") : null;

        const address = partido && city ? `${city}, ${partido}` : (partido || null);
        const country = provincia || "Argentina";

        const data: any = {
          companyName,
          taxId: taxId || null,
          phone: phone || null,
          clientEmails,
          city: city || null,
          address: address || null,
          country,
          industry: industry || null,
          status,
          notes: notes || null,
          assignedSalespersonId: sp?.id || null,
        };
        if (externalId) data.externalId = externalId;

        if (externalId) {
          const existing = await db.select({ id: clientsTable.id })
            .from(clientsTable)
            .where(sql`${clientsTable.externalId} = ${externalId}`)
            .limit(1);
          if (existing[0]) {
            await db.update(clientsTable).set(data).where(sql`id = ${existing[0].id}`);
            updated++;
          } else {
            await db.insert(clientsTable).values(data);
            inserted++;
          }
        } else {
          const existing = await db.select({ id: clientsTable.id })
            .from(clientsTable)
            .where(sql`lower(${clientsTable.companyName}) = lower(${companyName})`)
            .limit(1);
          if (existing[0]) {
            await db.update(clientsTable).set(data).where(sql`id = ${existing[0].id}`);
            updated++;
          } else {
            await db.insert(clientsTable).values(data);
            inserted++;
          }
        }
      } catch (e: any) {
        errors.push({ line: i + 2, error: e.message });
        skipped++;
      }
    }

    res.json({ ok: true, total: rows.length, inserted, updated, skipped, errors: errors.slice(0, 100) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Importador de Prospectos con Tareas Condicionales ────────────────────────
// DEBE ir antes del wildcard /csv/import/:entity
const PROSPECTS_HEADERS = "empresa,cuit,industria,telefono,ciudad,emails,escala_consumo,notas,tarea_nombre,tarea_prioridad,tarea_fecha_limite,tarea_asignar_a";
const PROSPECTS_HEADER_SET = new Set(PROSPECTS_HEADERS.split(","));

router.post("/csv/import/prospects", async (req: Request, res: Response) => {
  try {
    const { csv, separator } = req.body || {};
    if (typeof csv !== "string" || !csv.trim()) {
      res.status(400).json({ error: "csv requerido" }); return;
    }

    // Auto-detectar si la primera fila es encabezado o datos
    const sep = separator || ",";
    const firstLine = csv.trim().split(/\r?\n/)[0] || "";
    const firstLineCols = firstLine.split(sep).map((c: string) => c.trim().replace(/^"|"$/g, "").toLowerCase());
    const hasHeader = firstLineCols.some((c: string) => PROSPECTS_HEADER_SET.has(c));
    const csvToParse = hasHeader ? csv : PROSPECTS_HEADERS + "\n" + csv;

    const { rows } = parseFlexibleCsv(csvToParse, sep);
    if (!rows.length) {
      res.status(400).json({ error: "CSV vacío o sin filas" }); return;
    }

    const allUsers = await db.select({ id: usersTable.id, fullName: usersTable.fullName }).from(usersTable);

    let created = 0, skippedDuplicates = 0, tasksCreated = 0, tasksSkipped = 0;
    const errors: { line: number; error: string }[] = [];
    const duplicates: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2;
      try {
        const empresa = (row.empresa || "").trim();
        const cuit    = (row.cuit    || "").trim();

        if (!empresa || !cuit) {
          errors.push({ line: lineNum, error: "Empresa y CUIT son obligatorios" });
          continue;
        }

        // Duplicado por CUIT
        const existing = await db.select({ id: clientsTable.id })
          .from(clientsTable).where(eq(clientsTable.taxId, cuit)).limit(1);
        if (existing[0]) {
          skippedDuplicates++;
          duplicates.push(`L${lineNum}: ${empresa} (${cuit})`);
          continue;
        }

        // Estado según escala de consumo
        const consumoStr = (row.escala_consumo || "").trim();
        let status: "prospect" | "inactive" | "potential" = "prospect";
        let consumptionScale: number | null = null;
        if (consumoStr !== "") {
          const n = parseFloat(consumoStr);
          if (!isNaN(n)) {
            consumptionScale = n;
            status = n === 0 ? "inactive" : "potential";
          }
        }

        // Emails (separados por coma o punto y coma)
        const emailRaw = (row.emails || "").trim();
        const clientEmails = emailRaw
          ? emailRaw.split(/[;,]/).map((e: string) => e.trim()).filter((e: string) => e.includes("@"))
          : [];

        // Crear cliente
        const [newClient] = await db.insert(clientsTable).values({
          companyName: empresa,
          taxId: cuit,
          industry:   (row.industria || "").trim() || null,
          phone:      (row.telefono  || "").trim() || null,
          city:       (row.ciudad    || "").trim() || null,
          clientEmails,
          notes:      (row.notas     || "").trim() || null,
          status,
          consumptionScale,
        } as any).returning();
        created++;

        // Tarea condicional
        const tareaNombre = (row.tarea_nombre || "").trim();
        if (tareaNombre && newClient?.id) {
          const tareaAsignarA = (row.tarea_asignar_a || "").trim();
          let assignedUserId: number | null = null;

          if (tareaAsignarA) {
            const matched = allUsers.find(u =>
              u.fullName.trim().toLowerCase() === tareaAsignarA.toLowerCase()
            );
            if (matched) assignedUserId = matched.id;
          }

          if (tareaAsignarA && !assignedUserId) {
            tasksSkipped++;
          } else {
            const prioRaw = (row.tarea_prioridad || "").trim().toLowerCase();
            const priority = prioRaw.includes("alta") || prioRaw.includes("urgente") ? "high"
              : prioRaw.includes("baja") ? "low" : "medium";

            const dueDateRaw = (row.tarea_fecha_limite || "").trim();
            const dueDateObj = dueDateRaw ? new Date(dueDateRaw + "T12:00:00") : null;

            await db.insert(tasksTable).values({
              title:      tareaNombre,
              type:       "followup",
              status:     "pending",
              priority,
              clientId:   newClient.id,
              assignedTo: assignedUserId || null,
              dueDate:    dueDateObj && !isNaN(dueDateObj.getTime()) ? dueDateObj : null,
            });
            tasksCreated++;
          }
        }
      } catch (e: any) {
        errors.push({ line: lineNum, error: e.message });
      }
    }

    res.json({ ok: true, total: rows.length, created, skippedDuplicates, duplicates, tasksCreated, tasksSkipped, errors: errors.slice(0, 100) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/csv/import/:entity", async (req: Request, res: Response) => {
  const def = ENTITIES[req.params.entity];
  if (!def) { res.status(404).json({ error: "Entidad no soportada" }); return; }
  try {
    const { csv, mode = "upsert" } = req.body || {};
    if (typeof csv !== "string" || !csv.trim()) { res.status(400).json({ error: "csv requerido" }); return; }
    const { headers, rows } = parseCsv(csv);
    if (!headers.length) { res.status(400).json({ error: "CSV vacío" }); return; }
    const allowed = new Set(def.fields);
    const unknown = headers.filter(h => !allowed.has(h));
    let inserted = 0, updated = 0, skipped = 0;
    const errors: { line: number; error: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const data: any = {};
      for (const h of headers) {
        if (!allowed.has(h)) continue;
        data[h] = coerceValue(def, h, row[h]);
      }
      const missing = (def.required || []).filter(r => data[r] === null || data[r] === undefined || data[r] === "");
      if (missing.length) { errors.push({ line: i + 2, error: `Faltan campos: ${missing.join(", ")}` }); skipped++; continue; }
      try {
        if (data.id && mode === "upsert") {
          const id = Number(data.id); delete data.id;
          const upd = await db.update(def.table).set(data).where(sql`id = ${id}`).returning();
          if (upd.length) updated++;
          else { await db.insert(def.table).values({ ...data, id }); inserted++; }
        } else {
          delete data.id;
          await db.insert(def.table).values(data);
          inserted++;
        }
      } catch (e: any) { errors.push({ line: i + 2, error: e.message }); skipped++; }
    }
    res.json({ ok: true, total: rows.length, inserted, updated, skipped, unknownColumns: unknown, errors: errors.slice(0, 50) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
