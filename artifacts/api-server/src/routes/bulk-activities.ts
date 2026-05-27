import { Router, type IRouter } from "express";
import { db, tasksTable, activitiesTable, clientsTable, taskAssigneesTable, commercialTeamMembersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

// Look up the team members for a client and insert task_assignees rows.
// Falls back to [fallbackUserId] if client has no team.
async function assignTaskToClientTeam(taskId: number, clientId: number, fallbackUserId: number): Promise<void> {
  const [client] = await db.select({ assignedTeamId: clientsTable.assignedTeamId })
    .from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
  const teamId = client?.assignedTeamId;
  let memberIds: number[] = [];
  if (teamId) {
    const members = await db.select({ userId: commercialTeamMembersTable.userId })
      .from(commercialTeamMembersTable).where(eq(commercialTeamMembersTable.teamId, teamId));
    memberIds = members.map(m => m.userId);
  }
  if (memberIds.length === 0) memberIds = [fallbackUserId];
  const rows = [...new Set(memberIds)].map(uid => ({ taskId, userId: uid }));
  await db.insert(taskAssigneesTable).values(rows).onConflictDoNothing();
}

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

// Supports dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, yyyy/mm/dd
function parseDate(raw: string): Date | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();
  // Try dd/mm/yyyy or dd-mm-yyyy
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0, 0);
    return isNaN(date.getTime()) ? null : date;
  }
  // Try yyyy-mm-dd or yyyy/mm/dd
  const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0, 0);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
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
  const due = parseDate(fechaSeguimiento);
  if (!due) return null;
  const [task] = await db.insert(tasksTable).values({
    title: titulo || clientName,
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
        fecha: row.fecha?.trim() || new Date().toISOString().slice(0, 10),
        // Only use explicit fecha_seguimiento — no fallback to fecha
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
    const sinFechaRows: any[] = [];

    for (const row of directRows) {
      if (row.fechaSeguimiento) {
        // Has date — task IS the bitácora entry, no separate activity note
        const t = await createFollowupTask(
          row.clientId, row.clientName, row.titulo,
          row.novedad, row.fechaSeguimiento, row.urgencia, userId
        );
        if (t) createdTasks++;
      } else {
        // No date — don't save yet, surface to frontend for date assignment before saving
        sinFechaRows.push({
          clientId: row.clientId,
          clientName: row.clientName,
          titulo: row.titulo,
          novedad: row.novedad,
          urgencia: row.urgencia,
          accion: row.accion,
          fecha: row.fecha,
        });
      }
    }

    res.json({
      savedDirect,
      createdTasks,
      conflicts: conflictRows,
      errors,
      sinFecha: sinFechaRows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/bulk-activities/resolve", async (req, res) => {
  try {
    const { rows, sinFechaRows: sinFechaResolved = [] } = req.body as {
      rows: Array<{
        clientId: number;
        clientName: string;
        fecha: string;
        fechaSeguimiento?: string | null;
        urgencia?: string | null;
        titulo?: string;
        novedad: string;
        accion?: string;
        tareasACerrar: number[];
        accion_vendedor: "asociar_y_cerrar" | "solo_bitacora";
        followupTask?: {
          title: string;
          tipo: string;
          dueDate: string;
          priority: string;
          status: string;
          assignedTo: string;
          description: string;
        } | null;
      }>;
      sinFechaRows?: Array<{
        clientId: number;
        clientName: string;
        titulo: string | null;
        novedad: string;
        urgencia: string | null;
        accion: string | null;
        fecha: string;
        followupTask: {
          title: string;
          dueDate: string;
          priority: string;
          assignedTo: string;
          description: string;
        } | null; // null = save as activity note
      }>;
    };

    const userId: number = (req as any).userId;

    if (!Array.isArray(rows)) {
      res.status(400).json({ error: "Se requiere un array 'rows'" });
      return;
    }

    let saved = 0;
    let createdTasks = 0;

    for (const row of rows) {
      const shouldClose = row.accion_vendedor === "asociar_y_cerrar" && row.tareasACerrar.length > 0;

      // Determine closing context label (used in task description if task is created)
      let closedLabel = "";
      if (shouldClose) {
        const taskTitles: string[] = [];
        for (const tareaId of row.tareasACerrar) {
          const [t] = await db.select({ title: tasksTable.title })
            .from(tasksTable).where(eq(tasksTable.id, tareaId)).limit(1);
          if (t) taskTitles.push(t.title);
          await db.update(tasksTable)
            .set({ status: "completed", completedAt: new Date(), closedBy: userId })
            .where(eq(tasksTable.id, tareaId));
        }
        closedLabel = taskTitles.length === 1
          ? `[Tarea cerrada: ${taskTitles[0]}] `
          : `[${taskTitles.length} tareas cerradas: ${taskTitles.join(", ")}] `;
      }

      const baseDescription = closedLabel + row.novedad + (row.accion ? `\nAcción: ${row.accion}` : "");

      // Determine if a follow-up task will be created
      const willCreateTask =
        (row.followupTask && row.followupTask.dueDate) ||
        (row.followupTask === undefined && row.fechaSeguimiento);

      if (willCreateTask) {
        // Task IS the bitácora entry — skip separate activity note to avoid duplicates
        if (row.followupTask && row.followupTask.dueDate) {
          const ft = row.followupTask;
          const due = parseDate(ft.dueDate);
          if (due) {
            const assignedTo = ft.assignedTo ? parseInt(ft.assignedTo) : userId;
            const [inserted] = await db.insert(tasksTable).values({
              title: ft.title || row.clientName,
              description: ft.description || baseDescription,
              clientId: row.clientId,
              assignedTo: isNaN(assignedTo) ? userId : assignedTo,
              status: (ft.status || "pending") as any,
              priority: (ft.priority || "medium") as any,
              dueDate: due,
            } as any).returning({ id: tasksTable.id });
            if (inserted && row.clientId) {
              await assignTaskToClientTeam(inserted.id, row.clientId, isNaN(assignedTo) ? userId : assignedTo);
            }
            createdTasks++;
          }
        } else if (row.followupTask === undefined && row.fechaSeguimiento) {
          // Legacy path
          const t = await createFollowupTask(
            row.clientId, row.clientName, row.titulo || null,
            baseDescription, row.fechaSeguimiento, row.urgencia || null, userId
          );
          if (t) createdTasks++;
        }
      } else {
        // No task being created → activity note is the sole bitácora record
        await db.insert(activitiesTable).values({
          type: "note",
          title: row.titulo || row.clientName,
          clientId: row.clientId,
          description: baseDescription,
          outcome: row.accion || undefined,
          completedAt: (row.fecha ? parseDate(row.fecha) : null) || new Date(),
        }).returning();
      }
      saved++;
    }

    // Process sinFecha rows (saved without date, now assigned or skipped)
    for (const sfRow of sinFechaResolved) {
      const description = sfRow.novedad + (sfRow.accion ? `\nAcción: ${sfRow.accion}` : "");
      if (sfRow.followupTask && sfRow.followupTask.dueDate) {
        const due = parseDate(sfRow.followupTask.dueDate);
        if (due) {
          const assignedTo = sfRow.followupTask.assignedTo ? parseInt(sfRow.followupTask.assignedTo) : userId;
          const [sfInserted] = await db.insert(tasksTable).values({
            title: sfRow.followupTask.title || sfRow.clientName,
            description: sfRow.followupTask.description || description,
            clientId: sfRow.clientId,
            assignedTo: isNaN(assignedTo) ? userId : assignedTo,
            status: "pending" as any,
            priority: (sfRow.followupTask.priority || "medium") as any,
            dueDate: due,
          } as any).returning({ id: tasksTable.id });
          if (sfInserted && sfRow.clientId) {
            await assignTaskToClientTeam(sfInserted.id, sfRow.clientId, isNaN(assignedTo) ? userId : assignedTo);
          }
          createdTasks++;
        }
      } else {
        // User chose to save without a task — create activity note
        await db.insert(activitiesTable).values({
          type: "note",
          title: sfRow.titulo || sfRow.clientName,
          clientId: sfRow.clientId,
          description,
          outcome: sfRow.accion || undefined,
          completedAt: (sfRow.fecha ? parseDate(sfRow.fecha) : null) || new Date(),
        });
        saved++;
      }
    }

    res.json({ saved, createdTasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
