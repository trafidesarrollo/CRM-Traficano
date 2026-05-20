import { Router, type IRouter } from "express";
import { db, tasksTable, activitiesTable, clientsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

const router: IRouter = Router();

function parseCSV(text: string, separator: string = ";"): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
    return obj;
  });
}

function urgenciaToPriority(urgencia: string | null): string {
  const u = (urgencia || "").toLowerCase();
  if (u === "alta" || u === "high" || u === "urgente") return "high";
  if (u === "baja" || u === "low") return "low";
  return "medium";
}

async function createFollowupTask(
  clientId: number,
  clientName: string,
  titulo: string | null,
  novedad: string,
  fechaSeguimiento: string,
  urgencia: string | null,
  assignedTo: number
) {
  const due = new Date(fechaSeguimiento);
  if (isNaN(due.getTime())) return null;
  due.setHours(9, 0, 0, 0);
  const [task] = await db.insert(tasksTable).values({
    title: titulo ? `Seguimiento: ${titulo}` : `Seguimiento - ${clientName}`,
    description: novedad,
    clientId,
    assignedTo,
    status: "pending",
    priority: urgenciaToPriority(urgencia) as any,
    dueDate: due,
  } as any).returning();
  return task;
}

router.post("/bulk-activities/process", async (req, res) => {
  try {
    const { csv, separator = ";" } = req.body;
    if (!csv || typeof csv !== "string") {
      res.status(400).json({ error: "Se requiere el campo 'csv'" });
      return;
    }

    const userId: number = (req as any).userId;

    const rows = parseCSV(csv, separator);
    if (rows.length === 0) {
      res.status(400).json({ error: "El CSV está vacío o mal formateado" });
      return;
    }

    const clientIds = [...new Set(rows.map(r => parseInt(r.nro_cliente)).filter(n => !isNaN(n)))];

    const [clients, pendingTasks] = await Promise.all([
      db.select({ id: clientsTable.id, companyName: clientsTable.companyName })
        .from(clientsTable)
        .where(inArray(clientsTable.id, clientIds)),
      db.select()
        .from(tasksTable)
        .where(
          and(
            inArray(tasksTable.clientId, clientIds),
            inArray(tasksTable.status, ["pending", "in_progress"])
          )
        ),
    ]);

    const clientMap = new Map(clients.map(c => [c.id, c.companyName]));
    const pendingByClient = new Map<number, any[]>();
    for (const t of pendingTasks) {
      if (!t.clientId) continue;
      if (!pendingByClient.has(t.clientId)) pendingByClient.set(t.clientId, []);
      pendingByClient.get(t.clientId)!.push(t);
    }

    const directRows: any[] = [];
    const conflictRows: any[] = [];
    const errors: { line: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const clientId = parseInt(row.nro_cliente);
      if (isNaN(clientId)) {
        errors.push({ line: i + 2, error: `nro_cliente inválido: "${row.nro_cliente}"` });
        continue;
      }
      if (!clientMap.has(clientId)) {
        errors.push({ line: i + 2, error: `Cliente ${clientId} no encontrado` });
        continue;
      }
      if (!row.novedad?.trim()) {
        errors.push({ line: i + 2, error: `Fila sin novedad para cliente ${clientId}` });
        continue;
      }

      const pending = pendingByClient.get(clientId) || [];
      const rowData = {
        clientId,
        clientName: clientMap.get(clientId),
        fecha: row.fecha || new Date().toISOString().slice(0, 10),
        fechaSeguimiento: row.fecha_seguimiento?.trim() || null,
        urgencia: row.urgencia?.trim() || null,
        titulo: row.titulo?.trim() || null,
        novedad: row.novedad,
        accion: row.accion?.trim() || null,
      };

      if (pending.length > 0) {
        conflictRows.push({ ...rowData, tareasPendientes: pending });
      } else {
        directRows.push(rowData);
      }
    }

    let savedDirect = 0;
    let createdTasks = 0;

    for (const row of directRows) {
      await db.insert(activitiesTable).values({
        type: "note",
        title: row.titulo || `Novedad - ${row.clientName}`,
        clientId: row.clientId,
        description: row.novedad + (row.accion ? `\nAcción: ${row.accion}` : ""),
        outcome: row.accion || undefined,
        completedAt: row.fecha ? new Date(row.fecha) : new Date(),
      }).returning();
      savedDirect++;

      if (row.fechaSeguimiento) {
        const t = await createFollowupTask(
          row.clientId, row.clientName, row.titulo,
          row.novedad, row.fechaSeguimiento, row.urgencia, userId
        );
        if (t) createdTasks++;
      }
    }

    res.json({
      savedDirect,
      createdTasks,
      conflicts: conflictRows,
      errors,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/bulk-activities/resolve", async (req, res) => {
  try {
    const { rows } = req.body as {
      rows: Array<{
        clientId: number;
        clientName: string;
        fecha: string;
        fechaSeguimiento?: string | null;
        urgencia?: string | null;
        titulo?: string;
        novedad: string;
        accion?: string;
        tareaId: number;
        accion_vendedor: "asociar_y_cerrar" | "solo_bitacora";
      }>;
    };

    const userId: number = (req as any).userId;

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "Se requiere un array 'rows'" });
      return;
    }

    let saved = 0;
    let createdTasks = 0;

    for (const row of rows) {
      const shouldClose = row.accion_vendedor === "asociar_y_cerrar";
      const taskInfo = shouldClose
        ? await db.select({ title: tasksTable.title }).from(tasksTable).where(eq(tasksTable.id, row.tareaId)).limit(1)
        : [];

      const description = shouldClose && taskInfo[0]
        ? `[Tarea cerrada: ${taskInfo[0].title}] ${row.novedad}` + (row.accion ? `\nAcción: ${row.accion}` : "")
        : row.novedad + (row.accion ? `\nAcción: ${row.accion}` : "");

      if (shouldClose) {
        await db.update(tasksTable)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(tasksTable.id, row.tareaId));
      }

      await db.insert(activitiesTable).values({
        type: "note",
        title: row.titulo || `Novedad - ${row.clientName}`,
        clientId: row.clientId,
        description,
        outcome: row.accion || undefined,
        completedAt: row.fecha ? new Date(row.fecha) : new Date(),
      }).returning();
      saved++;

      if (row.fechaSeguimiento) {
        const t = await createFollowupTask(
          row.clientId, row.clientName, row.titulo || null,
          row.novedad, row.fechaSeguimiento, row.urgencia || null, userId
        );
        if (t) createdTasks++;
      }
    }

    res.json({ saved, createdTasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
