import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  clientsTable,
  contactsTable,
  productsTable,
  opportunitiesTable,
  salespeopleTable,
  tasksTable,
  pipelinesTable,
  pipelineStagesTable,
  quotesTable,
  ordersTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

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
