/**
 * Importador masivo CSV ERP-aware para la migración Traficaño → CRM
 * y futuras re-importaciones desde el ERP.
 *
 * Endpoints:
 *  - GET  /api/import-erp/ui              → HTML standalone con formulario de upload
 *  - POST /api/import-erp/:entity         → recibe CSV (multipart), inserta con ON CONFLICT
 *
 * Entities soportadas:
 *   - clients, products_accesorios, products_medidas, price_list_items,
 *     quotes, orders, tasks
 *
 * Mapea automáticamente los headers del ERP en español (Razón social, Número de
 * cliente, etc.) y resuelve FKs por external_id / nombre.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { sql } from "drizzle-orm";
import {
  db,
  clientsTable,
  usersTable,
  salespeopleTable,
  priceListsTable,
  priceListItemsTable,
  quotesTable,
  ordersTable,
  tasksTable,
  // tablas nuevas (asegurate que están exportadas desde @workspace/db)
  productsAccesoriosTable,
  productsMedidasTable,
} from "@workspace/db";
import { requireRole } from "../middleware/auth.js";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB por archivo
});
const importAuth = requireRole("admin", "gerente");

// ============================================================================
// CSV parser (UTF-8 BOM, comillas, comma)
// ============================================================================
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
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
    headers.forEach((h, i) => { r[h] = (l[i] ?? "").trim(); });
    return r;
  });
  return { headers, rows };
}

// ============================================================================
// Helpers de parseo
// ============================================================================
function parseDateDMY(s: string): Date | null {
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dt = new Date(`${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00Z`);
  return isNaN(dt.getTime()) ? null : dt;
}
function parseDateISO(s: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const dt = new Date(`${s}T00:00:00Z`);
  return isNaN(dt.getTime()) ? null : dt;
}
function parseAnyDate(s: string): Date | null {
  return parseDateISO(s) || parseDateDMY(s);
}
function parseNum(s: string): number | null {
  if (s === "" || s == null) return null;
  const n = Number(String(s).replace(",", "."));
  return isNaN(n) ? null : n;
}
function nullIfEmpty(s: string): string | null {
  return s && s !== "[]" ? s : null;
}

// ============================================================================
// Importadores por entidad
// ============================================================================
type Result = { inserted: number; updated: number; skipped: number; errors: { line: number; error: string }[] };

async function importClients(rows: Record<string, string>[]): Promise<Result> {
  const r: Result = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const ext = (row["Número de cliente"] || row["external_id"] || "").trim();
      const company = (row["Razón social"] || row["company_name"] || "").trim();
      if (!company) { r.skipped++; r.errors.push({ line: i + 2, error: "Sin Razón social" }); continue; }

      const correo = nullIfEmpty(row["Correo"] || "");
      const tel = nullIfEmpty(row["Telefono"] || row["Teléfono"] || "");
      const noteParts: string[] = [];
      const importancia = nullIfEmpty(row["Importancia"] || "");
      const zona = nullIfEmpty(row["Zona"] || "");
      const partido = nullIfEmpty(row["Partido"] || "");
      const r1 = nullIfEmpty(row["Responsable 1"] || "");
      const r2 = nullIfEmpty(row["Responsable 2"] || "");
      if (importancia) noteParts.push(`Importancia: ${importancia}`);
      if (zona) noteParts.push(`Zona: ${zona}`);
      if (partido) noteParts.push(`Partido: ${partido}`);
      if (r2) noteParts.push(`Responsable 2: ${r2}`);
      if (r1) noteParts.push(`Responsable 1: ${r1}`);

      const data = {
        companyName: company,
        taxId: nullIfEmpty(row["Número de documento"] || row["tax_id"] || ""),
        industry: nullIfEmpty(row["Rubro"] || ""),
        phone: tel,
        city: nullIfEmpty(row["Localidad"] || ""),
        country: nullIfEmpty(row["Provincia"] || ""),
        status: "prospect" as const,
        clientEmails: correo ? [correo] : [],
        notes: noteParts.length ? noteParts.join(" | ") : null,
        externalId: ext || null,
      };

      // Dedup por external_id si existe
      if (ext) {
        const existing = await db
          .select({ id: clientsTable.id })
          .from(clientsTable)
          .where(sql`external_id = ${ext}`)
          .limit(1);
        if (existing.length) { r.skipped++; continue; }
      }
      await db.insert(clientsTable).values(data);
      r.inserted++;
    } catch (e: any) {
      r.errors.push({ line: i + 2, error: e.message });
      r.skipped++;
    }
  }

  // Resolver assigned_salesperson_id matcheando "Responsable 1" con salespeople
  try {
    await db.execute(sql`
      UPDATE clients c SET assigned_salesperson_id = s.id
      FROM users u JOIN salespeople s ON s.user_id = u.id
      WHERE c.external_id IS NOT NULL
        AND c.assigned_salesperson_id IS NULL
        AND c.notes LIKE '%Responsable 1: ' || u.full_name || '%'
    `);
  } catch (e: any) {
    r.errors.push({ line: 0, error: "UPDATE assigned_salesperson_id: " + e.message });
  }

  return r;
}

async function importProductsAccesorios(rows: Record<string, string>[]): Promise<Result> {
  const r: Result = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const code = (row["Código"] || row["code"] || "").trim();
      const name = (row["Nombre"] || row["name"] || "").trim();
      if (!code) { r.skipped++; r.errors.push({ line: i + 2, error: "Sin Código" }); continue; }
      if (!name) { r.skipped++; r.errors.push({ line: i + 2, error: "Sin Nombre" }); continue; }
      const data = {
        code, name,
        accessoryType: nullIfEmpty(row["Tipo de accesorio"] || ""),
        subtype: nullIfEmpty(row["Subtipo"] || ""),
        unit: nullIfEmpty(row["Unidad de medida"] || ""),
        value1: parseNum(row["Valor 1"] || "")?.toString() ?? null,
        value2: parseNum(row["Valor 2"] || "")?.toString() ?? null,
        value3: parseNum(row["Valor 3"] || "")?.toString() ?? null,
        value4: parseNum(row["Valor 4"] || "")?.toString() ?? null,
        value5: nullIfEmpty(row["Valor 5"] || ""),
        weight: parseNum(row["Peso"] || "")?.toString() ?? null,
        standard: nullIfEmpty(row["Norma"] || ""),
        isActive: true,
      };
      try {
        await db.insert(productsAccesoriosTable).values(data as any);
        r.inserted++;
      } catch (e: any) {
        // unique constraint en code → ya existe
        if (e.message?.includes("duplicate") || e.message?.includes("unique")) {
          r.skipped++;
        } else throw e;
      }
    } catch (e: any) {
      r.errors.push({ line: i + 2, error: e.message });
      r.skipped++;
    }
  }
  return r;
}

async function importProductsMedidas(rows: Record<string, string>[]): Promise<Result> {
  const r: Result = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const code = (row["Código"] || row["code"] || "").trim();
      const name = (row["Nombre"] || row["name"] || "").trim();
      if (!code || !name) { r.skipped++; r.errors.push({ line: i + 2, error: "Sin Código o Nombre" }); continue; }
      const data = {
        code, name,
        outerDiameter: parseNum(row["Díametro Exterior"] || row["Diámetro Exterior"] || "")?.toString() ?? null,
        nominalThickness: parseNum(row["Espesor Nominal"] || "")?.toString() ?? null,
        minLength: parseNum(row["Largo Mínimo"] || "")?.toString() ?? null,
        maxLength: parseNum(row["Largo Máximo"] || "")?.toString() ?? null,
        seamType: nullIfEmpty(row["Tipo Costura"] || ""),
        steelType: nullIfEmpty(row["Tipo de Acero"] || ""),
        heatTreatment: nullIfEmpty(row["Tratamiento Térmico"] || ""),
        standard: nullIfEmpty(row["Norma"] || ""),
        shape: nullIfEmpty(row["Forma"] || ""),
        category: nullIfEmpty(row["Rubro"] || ""),
        rawMaterial: nullIfEmpty(row["Materia prima"] || ""),
        isActive: true,
      };
      try {
        await db.insert(productsMedidasTable).values(data as any);
        r.inserted++;
      } catch (e: any) {
        if (e.message?.includes("duplicate") || e.message?.includes("unique")) r.skipped++;
        else throw e;
      }
    } catch (e: any) {
      r.errors.push({ line: i + 2, error: e.message });
      r.skipped++;
    }
  }
  return r;
}

async function importPriceListItems(rows: Record<string, string>[]): Promise<Result> {
  const r: Result = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  // Cache de listas y productos
  const pls = await db.select().from(priceListsTable);
  const plMap = new Map(pls.map(p => [p.name, p.id]));
  const accs = await db.select({ id: productsAccesoriosTable.id, name: productsAccesoriosTable.name }).from(productsAccesoriosTable);
  const meds = await db.select({ id: productsMedidasTable.id, name: productsMedidasTable.name }).from(productsMedidasTable);
  const productMap = new Map<string, number>();
  for (const m of meds) productMap.set(m.name, m.id);
  for (const a of accs) productMap.set(a.name, a.id); // si hay choque, ganan accesorios

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const listName = (row["Lista de precios"] || row["lista"] || "").trim();
      const prodName = (row["Producto"] || row["producto"] || "").trim();
      const precio = parseNum(row["Precio"] || row["precio"] || "0") || 0;
      if (!listName || !prodName) { r.skipped++; r.errors.push({ line: i + 2, error: "Sin lista o producto" }); continue; }
      if (precio <= 0) { r.skipped++; continue; } // ignorar precios en 0
      const plId = plMap.get(listName);
      const prodId = productMap.get(prodName);
      if (!plId || !prodId) { r.skipped++; r.errors.push({ line: i + 2, error: `lista=${!!plId} prod=${!!prodId}` }); continue; }
      await db.insert(priceListItemsTable).values({
        priceListId: plId,
        productId: prodId,
        price: precio.toString(),
        currency: "USD",
      } as any);
      r.inserted++;
    } catch (e: any) {
      r.errors.push({ line: i + 2, error: e.message });
      r.skipped++;
    }
  }
  return r;
}

async function importQuotes(rows: Record<string, string>[]): Promise<Result> {
  const r: Result = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  // Cache de clientes por nombre
  const clis = await db.select({ id: clientsTable.id, name: clientsTable.companyName, taxId: clientsTable.taxId, ext: clientsTable.externalId }).from(clientsTable).where(sql`external_id IS NOT NULL`);
  const cliMap = new Map(clis.map(c => [c.name.toUpperCase(), c]));
  // Cache de salespeople por user.full_name (case-insensitive)
  const sp = await db
    .select({ id: salespeopleTable.id, name: usersTable.fullName, userId: usersTable.id })
    .from(salespeopleTable)
    .innerJoin(usersTable, sql`${usersTable.id} = ${salespeopleTable.userId}`);
  const spMap = new Map<string, number>();
  for (const s of sp) {
    spMap.set(s.name.toLowerCase(), s.id);
    const parts = s.name.split(" ");
    if (parts.length >= 2) spMap.set([parts[1], parts[0]].join(" ").toLowerCase(), s.id);
  }
  const STATUS_MAP: Record<string, string> = {
    COTIZADA: "sent", "EN PROCESO": "draft", CONFIRMADA: "approved",
    "CONFIRMADA PARCIAL": "partial", PERDIDA: "rejected",
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const number = (row["Número"] || row["number"] || "").trim();
      const cliName = (row["Cliente"] || "").trim().toUpperCase();
      if (!cliName) { r.skipped++; r.errors.push({ line: i + 2, error: "Sin Cliente" }); continue; }
      const cli = cliMap.get(cliName);
      if (!cli) { r.skipped++; r.errors.push({ line: i + 2, error: `Cliente "${cliName}" no existe` }); continue; }

      const userName = (row["Usuario"] || "").trim().toLowerCase();
      const spId = spMap.get(userName) ?? null;
      const estCot = (row["Estado cotización"] || "").trim();
      const estado = STATUS_MAP[estCot] || "draft";
      const prio = (row["Importancia"] || "NINGUNA").trim();

      const data = {
        number, clientId: cli.id, salespersonId: spId, cuit: cli.taxId,
        date: parseAnyDate(row["Fecha"] || "") || new Date(),
        deliveryDate: parseAnyDate(row["Fecha de entrega"] || ""),
        dueDate: parseAnyDate(row["Fecha de vencimiento"] || ""),
        followupDate: parseAnyDate(row["Fecha seguimiento"] || ""),
        currency: "USD",
        netAmount: (parseNum(row["Monto neto"] || "0") || 0).toString(),
        totalKg: (parseNum(row["Total kg"] || "0") || 0).toString(),
        quoteStatus: estCot,
        status: estado as any,
        priority: (prio || "NINGUNA") as any,
        orderType: nullIfEmpty(row["Tipo de orden"] || "") || "REVENTA",
        reference: nullIfEmpty(row["Referencia"] || ""),
      };
      await db.insert(quotesTable).values(data as any);
      r.inserted++;
    } catch (e: any) {
      r.errors.push({ line: i + 2, error: e.message });
      r.skipped++;
    }
  }
  return r;
}

async function importOrders(rows: Record<string, string>[]): Promise<Result> {
  const r: Result = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  const clis = await db.select({ id: clientsTable.id, name: clientsTable.companyName, taxId: clientsTable.taxId }).from(clientsTable).where(sql`external_id IS NOT NULL`);
  const cliMap = new Map(clis.map(c => [c.name.toUpperCase(), c]));
  const STATUS_MAP: Record<string, string> = {
    AUTORIZADO: "confirmed", PENDIENTE: "draft", ENTREGADO: "delivered",
  };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const number = (row["Número"] || "").trim();
      const cliName = (row["Cliente"] || "").trim().toUpperCase();
      if ((row["Estado"] || "").trim() === "Anulado") { r.skipped++; continue; }
      const cli = cliMap.get(cliName);
      if (!cli) { r.skipped++; r.errors.push({ line: i + 2, error: `Cliente "${cliName}" no existe` }); continue; }
      const estPed = (row["Estado de pedido"] || "").trim();
      const data = {
        number, clientId: cli.id, cuit: cli.taxId,
        date: parseAnyDate(row["Fecha"] || "") || new Date(),
        deliveryDate: parseAnyDate(row["Fecha de entrega"] || ""),
        currency: "USD",
        netAmount: (parseNum(row["Monto neto"] || "0") || 0).toString(),
        totalKg: (parseNum(row["Total kg"] || "0") || 0).toString(),
        orderStatus: estPed,
        status: (STATUS_MAP[estPed] || "draft") as any,
        orderType: nullIfEmpty(row["Tipo de orden"] || "") || "REVENTA",
        isAuthorized: estPed === "AUTORIZADO",
      };
      await db.insert(ordersTable).values(data as any);
      r.inserted++;
    } catch (e: any) {
      r.errors.push({ line: i + 2, error: e.message });
      r.skipped++;
    }
  }
  return r;
}

async function importTasks(rows: Record<string, string>[], kind: "eventos" | "seguimientos" | "carga_masiva"): Promise<Result> {
  const r: Result = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  const PRIO: Record<string, string> = { NINGUNA: "low", BAJA: "low", MEDIA: "medium", ALTA: "high", "-": "low" };
  const STATUS: Record<string, string> = { ABIERTO: "pending", CERRADO: "completed" };
  const TYPE_FROM_EVENT: Record<string, string> = { TAREA: "task", SEGUIMIENTO: "followup" };

  const clis = await db.select({ id: clientsTable.id, name: clientsTable.companyName }).from(clientsTable).where(sql`external_id IS NOT NULL`);
  const cliMap = new Map(clis.map(c => [c.name.toUpperCase(), c.id]));
  const users = await db.select({ id: usersTable.id, name: usersTable.fullName }).from(usersTable);
  const userMap = new Map(users.map(u => [u.name.toLowerCase(), u.id]));
  const quotes = await db.select({ id: quotesTable.id, number: quotesTable.number }).from(quotesTable);
  const quoteMap = new Map(quotes.map(q => [q.number || "", q.id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      let title: string, descripcion: string, type: string, prioridad: string, estado: string,
          userName: string, clienteName: string, fecha: string, fechaSeg: string, quoteNum = "";
      if (kind === "eventos") {
        title = (row["Título"] || row["Descripción"] || "Sin título").trim();
        descripcion = (row["Descripción"] || "").trim();
        type = TYPE_FROM_EVENT[(row["Tipo de evento"] || "").trim()] || "task";
        prioridad = (row["Prioridad"] || "NINGUNA").trim();
        estado = (row["Estado"] || "ABIERTO").trim();
        userName = (row["Usuario"] || "").trim();
        clienteName = (row["Cliente"] || "").trim();
        fecha = row["Fecha"] || "";
        fechaSeg = row["Fecha de seguimiento"] || "";
      } else if (kind === "seguimientos") {
        descripcion = (row["Descripción"] || "").trim();
        const m = /N[º°o]\s*:?\s*(\d+)/.exec(descripcion);
        quoteNum = m ? m[1] : "";
        title = `Seguimiento cotización ${quoteNum} - ${row["Cliente"] || ""}`;
        type = "followup";
        prioridad = (row["Prioridad"] || "NINGUNA").trim();
        estado = (row["Estado"] || "ABIERTO").trim();
        userName = (row["Usuario"] || "").trim();
        clienteName = (row["Cliente"] || "").trim();
        fecha = row["Fecha"] || "";
        fechaSeg = row["Fecha de seguimiento"] || "";
      } else {
        title = (row["Título"] || `Carga masiva ${row["Nro."] || ""}`).trim();
        descripcion = (row["Novedad / Acción"] || "").trim();
        const m = /N[º°o]\s*:?\s*(\d+)/.exec(descripcion);
        quoteNum = m ? m[1] : (row["Nro."] || "").trim();
        type = "followup";
        prioridad = (row["Urgencia"] || "NINGUNA").trim();
        estado = (row["Estado"] || "ABIERTO").trim();
        userName = (row["Responsable"] || "").trim();
        clienteName = (row["Cliente"] || "").trim();
        fecha = row["Fecha"] || "";
        fechaSeg = row["Fecha de seguimiento"] || "";
      }

      const data = {
        title, description: descripcion,
        type: type as any,
        priority: (PRIO[prioridad] || "low") as any,
        status: (STATUS[estado] || "pending") as any,
        assignedTo: userMap.get(userName.toLowerCase()) ?? null,
        clientId: cliMap.get(clienteName.toUpperCase()) ?? null,
        quoteId: quoteNum ? (quoteMap.get(quoteNum) ?? null) : null,
        dueDate: parseAnyDate(fechaSeg),
        completedAt: estado === "CERRADO" ? parseAnyDate(fecha) : null,
      };
      await db.insert(tasksTable).values(data as any);
      r.inserted++;
    } catch (e: any) {
      r.errors.push({ line: i + 2, error: e.message });
      r.skipped++;
    }
  }
  return r;
}

// ============================================================================
// Dispatcher
// ============================================================================
async function importByEntity(entity: string, rows: Record<string, string>[]): Promise<Result> {
  switch (entity) {
    case "clients": return importClients(rows);
    case "products_accesorios": return importProductsAccesorios(rows);
    case "products_medidas": return importProductsMedidas(rows);
    case "price_list_items": return importPriceListItems(rows);
    case "quotes": return importQuotes(rows);
    case "orders": return importOrders(rows);
    case "tasks_eventos": return importTasks(rows, "eventos");
    case "tasks_seguimientos": return importTasks(rows, "seguimientos");
    case "tasks_carga_masiva": return importTasks(rows, "carga_masiva");
    default: throw new Error(`Entidad no soportada: ${entity}`);
  }
}

// ============================================================================
// Endpoints
// ============================================================================
router.post("/import-erp/:entity", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: "Falta archivo (campo file)" }); return; }
    const entity = req.params.entity;
    const text = req.file.buffer.toString("utf-8");
    const { headers, rows } = parseCsv(text);
    if (!rows.length) { res.status(400).json({ error: "CSV vacío" }); return; }
    const result = await importByEntity(entity, rows);
    res.json({
      ok: true,
      entity,
      total: rows.length,
      headers,
      ...result,
      errors: result.errors.slice(0, 100),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/import-erp/ui", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Import ERP — CRM Traficaño</title>
<style>
body{font-family:system-ui,sans-serif;max-width:780px;margin:2rem auto;padding:1rem;background:#fafafa}
h1{font-size:1.4rem;margin-bottom:.3rem}
.muted{color:#666;font-size:.9rem;margin-bottom:1.5rem}
form{background:#fff;padding:1.5rem;border:1px solid #ddd;border-radius:8px;margin-bottom:1rem}
label{display:block;margin-top:.8rem;font-weight:600}
select,input[type=file]{width:100%;padding:.5rem;border:1px solid #ccc;border-radius:4px;margin-top:.2rem}
button{background:#2563eb;color:#fff;border:none;padding:.6rem 1.2rem;border-radius:4px;margin-top:1rem;cursor:pointer;font-weight:600}
button:disabled{opacity:.5;cursor:not-allowed}
pre{background:#0f172a;color:#e2e8f0;padding:1rem;border-radius:6px;overflow:auto;font-size:.85rem;max-height:400px}
.ok{color:#16a34a}.err{color:#dc2626}
</style></head><body>
<h1>Importador ERP → CRM Traficaño</h1>
<p class="muted">Subí el CSV exportado del ERP. Cada entidad usa el formato original (headers en español, fechas DD/MM/YYYY o YYYY-MM-DD).</p>
<form id=f>
  <label for=entity>Entidad</label>
  <select id=entity name=entity required>
    <option value="clients">Clientes (Clientes.csv)</option>
    <option value="products_accesorios">Productos — Accesorios (Accesorios.csv)</option>
    <option value="products_medidas">Productos — Medidas (Medidas.csv)</option>
    <option value="price_list_items">Precios de productos (Precio de productos.csv) — requiere productos cargados</option>
    <option value="quotes">Cotizaciones (Cotizaciones de venta.csv) — requiere clientes cargados</option>
    <option value="orders">Pedidos (Pedidos de cliente.csv) — requiere clientes cargados</option>
    <option value="tasks_eventos">Tasks: Eventos (Eventos.csv)</option>
    <option value="tasks_seguimientos">Tasks: Seguimientos cotizaciones (Seguimiento de cotizaciones.csv)</option>
    <option value="tasks_carga_masiva">Tasks: Carga masiva CRM (Carga masiva CRM.csv)</option>
  </select>
  <label for=file>Archivo CSV</label>
  <input type=file id=file name=file accept=".csv" required>
  <button id=btn type=submit>Subir e importar</button>
</form>
<pre id=out>Resultados aparecerán acá.</pre>
<script>
const f=document.getElementById('f'),btn=document.getElementById('btn'),out=document.getElementById('out');
f.onsubmit=async e=>{
  e.preventDefault();
  const ent=document.getElementById('entity').value;
  const file=document.getElementById('file').files[0];
  if(!file){alert('Falta archivo');return;}
  btn.disabled=true;btn.textContent='Subiendo...';out.textContent='Procesando...';
  const fd=new FormData();fd.append('file',file);
  try{
    const r=await fetch('/api/import-erp/'+ent,{method:'POST',body:fd,credentials:'include'});
    const data=await r.json();
    out.textContent=JSON.stringify(data,null,2);
    out.className=data.ok?'ok':'err';
  }catch(err){out.textContent='Error: '+err.message;out.className='err';}
  btn.disabled=false;btn.textContent='Subir e importar';
};
</script>
</body></html>`);
});

export default router;
