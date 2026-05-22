import { Router, type IRouter } from "express";
import { db, tasksTable, notificationsTable, salespeopleTable, clientsTable, usersTable, quotesTable } from "@workspace/db";
import { eq, desc, sql, and, or, lt, gt, gte, lte, isNull, inArray } from "drizzle-orm";

const router: IRouter = Router();

router.get("/tasks", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const assignedTo = req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined;
    const view = req.query.view as string | undefined;

    const priority = req.query.priority as string | undefined;
    const conds: any[] = [];
    if (status) conds.push(eq(tasksTable.status, status as any));
    if (assignedTo) conds.push(eq(tasksTable.assignedTo, assignedTo));
    if (priority && priority !== "all") conds.push(eq(tasksTable.priority, priority as any));
    if (view === "today") {
      const start = new Date(); start.setHours(0,0,0,0);
      const end = new Date(); end.setHours(23,59,59,999);
      conds.push(and(gt(tasksTable.dueDate, start), lt(tasksTable.dueDate, end)));
    }
    if (view === "overdue") {
      conds.push(and(lt(tasksTable.dueDate, new Date()), sql`${tasksTable.status} != 'completed'`));
    }
    if (req.query.from) {
      const f = new Date(req.query.from as string);
      if (!Number.isNaN(f.getTime())) conds.push(gte(tasksTable.dueDate, f));
    }
    if (req.query.to) {
      const t = new Date(req.query.to as string);
      if (!Number.isNaN(t.getTime())) conds.push(lte(tasksTable.dueDate, t));
    }
    const where = conds.length ? and(...conds) : undefined;

    const data = await db.select({
      t: tasksTable,
      assigneeName: usersTable.fullName,
      clientName: clientsTable.companyName,
    }).from(tasksTable)
      .leftJoin(usersTable, eq(tasksTable.assignedTo, usersTable.id))
      .leftJoin(clientsTable, eq(tasksTable.clientId, clientsTable.id))
      .where(where as any)
      .orderBy(sql`case when ${tasksTable.status}='completed' then 1 else 0 end, ${tasksTable.dueDate} asc nulls last`)
      .limit(500);

    res.json(data.map(r => ({ ...r.t, assigneeName: r.assigneeName, clientName: r.clientName })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db
      .select({
        t: tasksTable,
        assigneeName: sql<string>`coalesce(${usersTable.fullName}, '')`,
        clientName: sql<string>`coalesce(${clientsTable.companyName}, '')`,
      })
      .from(tasksTable)
      .leftJoin(usersTable, eq(tasksTable.assignedTo, usersTable.id))
      .leftJoin(clientsTable, eq(tasksTable.clientId, clientsTable.id))
      .where(eq(tasksTable.id, id));
    if (!row) { res.status(404).json({ error: "Tarea no encontrada" }); return; }
    res.json({ ...row.t, assigneeName: row.assigneeName, clientName: row.clientName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    const data: any = { ...req.body, createdBy: userId };
    for (const k of ["dueDate", "reminderAt", "completedAt"]) {
      if (data[k] && typeof data[k] === "string") data[k] = new Date(data[k]);
    }
    const [row] = await db.insert(tasksTable).values(data).returning();

    if (row.assignedTo && row.assignedTo !== userId) {
      await db.insert(notificationsTable).values({
        userId: row.assignedTo,
        type: "task_assigned",
        title: "Nueva tarea asignada",
        body: row.title,
        link: `/tasks?id=${row.id}`,
        entityType: "task",
        entityId: row.id,
      });
    }
    // Push to Google Calendar if enabled (best-effort, async)
    (async () => {
      try {
        if (!row.dueDate || !row.assignedTo) return;
        const { getUserConnection, getValidAccessToken, pushTaskToGCal } = await import("./gcal.js");
        const conn = await getUserConnection(row.assignedTo);
        if (!conn?.calendarSyncEnabled) return;
        const token = await getValidAccessToken(conn);
        const r = await pushTaskToGCal(token, row);
        if (r) await db.update(tasksTable).set({ googleEventId: r.id, googleSyncedAt: new Date() }).where(eq(tasksTable.id, row.id));
      } catch {}
    })();

    res.status(201).json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).session?.userId;
    const data: any = { ...req.body };
    for (const k of ["dueDate", "reminderAt", "completedAt"]) {
      if (data[k] && typeof data[k] === "string") data[k] = new Date(data[k]);
    }
    if (data.status === "completed" && !data.completedAt) {
      data.completedAt = new Date();
    }
    const [prev] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    if (!prev) { res.status(404).json({ error: "No encontrada" }); return; }
    const [row] = await db.update(tasksTable).set(data).where(eq(tasksTable.id, id)).returning();
    if (data.assignedTo && data.assignedTo !== prev.assignedTo && data.assignedTo !== userId) {
      await db.insert(notificationsTable).values({
        userId: data.assignedTo,
        type: "task_assigned",
        title: "Tarea reasignada a vos",
        body: row.title,
        link: `/tasks?id=${row.id}`,
        entityType: "task",
        entityId: row.id,
      });
    }
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(tasksTable).where(eq(tasksTable.id, id));
    res.json({ message: "Eliminada" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Weekly view for manager: tasks grouped by day for a given week, filterable by assignee
router.get("/tasks/weekly", async (req, res) => {
  try {
    const weekStart = req.query.weekStart ? new Date(req.query.weekStart as string) : (() => {
      const d = new Date(); d.setHours(0,0,0,0);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
      return d;
    })();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 5); // Saturday 00:00
    weekEnd.setHours(0,0,0,0);

    const assignedTo = req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined;
    const conds: any[] = [gte(tasksTable.dueDate, weekStart), lt(tasksTable.dueDate, weekEnd)];
    if (assignedTo) conds.push(eq(tasksTable.assignedTo, assignedTo));

    const data = await db.select({
      t: tasksTable,
      assigneeName: usersTable.fullName,
      clientName: clientsTable.companyName,
    }).from(tasksTable)
      .leftJoin(usersTable, eq(tasksTable.assignedTo, usersTable.id))
      .leftJoin(clientsTable, eq(tasksTable.clientId, clientsTable.id))
      .where(and(...conds))
      .orderBy(
        sql`case when ${tasksTable.priority}='urgent' then 0 when ${tasksTable.priority}='high' then 1 when ${tasksTable.priority}='medium' then 2 else 3 end`,
        tasksTable.dueDate
      )
      .limit(500);

    res.json(data.map(r => ({ ...r.t, assigneeName: r.assigneeName, clientName: r.clientName })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Defer all overdue pending tasks to next business day (run at end of day or manually)
router.post("/tasks/defer-overdue", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    const now = new Date();
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);

    // Find all pending/in_progress tasks with dueDate before today
    const overdue = await db.select().from(tasksTable).where(
      and(
        lt(tasksTable.dueDate, todayStart),
        sql`${tasksTable.status} IN ('pending', 'in_progress')`
      )
    );

    if (overdue.length === 0) { res.json({ deferred: 0 }); return; }

    // Next business day
    const nextDay = new Date(todayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    if (nextDay.getDay() === 6) nextDay.setDate(nextDay.getDate() + 2); // skip Saturday
    if (nextDay.getDay() === 0) nextDay.setDate(nextDay.getDate() + 1); // skip Sunday
    nextDay.setHours(8, 0, 0, 0);

    const DEFER_ALERT_THRESHOLD = 2; // alert after 2 deferments
    const alertTargets = new Set<number>();

    for (const task of overdue) {
      const newDeferCount = (task.deferCount ?? 0) + 1;
      await db.update(tasksTable).set({
        dueDate: nextDay,
        priority: "urgent",
        deferCount: newDeferCount,
        deferredAt: now,
        originalDueDate: task.originalDueDate ?? task.dueDate,
      }).where(eq(tasksTable.id, task.id));

      if (newDeferCount >= DEFER_ALERT_THRESHOLD && task.assignedTo) {
        alertTargets.add(task.assignedTo);
      }
    }

    // Notify managers about employees with repeatedly deferred tasks
    if (alertTargets.size > 0) {
      const managers = await db.select().from(usersTable).where(
        sql`${usersTable.role} IN ('admin', 'gerente')`
      );
      const assigneeNames = await db.select({ id: usersTable.id, name: usersTable.fullName })
        .from(usersTable).where(inArray(usersTable.id, [...alertTargets]));
      const nameMap = Object.fromEntries(assigneeNames.map(a => [a.id, a.name]));

      for (const mgr of managers) {
        for (const assigneeId of alertTargets) {
          const pendingCount = overdue.filter(t => t.assignedTo === assigneeId).length;
          await db.insert(notificationsTable).values({
            userId: mgr.id,
            type: "task_assigned",
            title: "⚠️ Tareas diferidas repetidamente",
            body: `${nameMap[assigneeId] ?? "Un vendedor"} tiene ${pendingCount} tarea(s) pendiente(s) diferida(s) más de ${DEFER_ALERT_THRESHOLD} veces.`,
            link: `/tasks?assignedTo=${assigneeId}`,
            entityType: "task",
            entityId: null,
          });
        }
      }
    }

    res.json({ deferred: overdue.length, alertsSent: alertTargets.size });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk create tasks from CSV data (array of task objects)
router.post("/tasks/bulk", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    const rows: any[] = req.body.tasks || [];
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "Se requiere un array 'tasks'" }); return;
    }
    const parsed = rows.map((r: any) => {
      const t: any = { ...r, createdBy: userId };
      for (const k of ["dueDate", "reminderAt"]) {
        if (t[k] && typeof t[k] === "string") {
          const d = new Date(t[k]);
          t[k] = isNaN(d.getTime()) ? null : d;
        }
      }
      if (!t.title) return null;
      return t;
    }).filter(Boolean);

    const inserted = await db.insert(tasksTable).values(parsed).returning();

    // Send notifications for assignments
    for (const row of inserted) {
      if (row.assignedTo && row.assignedTo !== userId) {
        await db.insert(notificationsTable).values({
          userId: row.assignedTo,
          type: "task_assigned",
          title: "Nueva tarea asignada",
          body: row.title,
          link: `/tasks?id=${row.id}`,
          entityType: "task",
          entityId: row.id,
        });
      }
    }

    res.status(201).json({ created: inserted.length, tasks: inserted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/tasks/stats/summary", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    const userRole = (req as any).session?.userRole;
    const isManager = ["admin", "gerente", "gerente_comercial"].includes(userRole);
    const now = new Date();
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

    // Managers see team-wide stats; vendedores see only their own
    const userFilter = isManager ? undefined : eq(tasksTable.assignedTo, userId);

    const [pending, overdue, today, completed] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(tasksTable)
        .where(and(userFilter, eq(tasksTable.status, "pending")) as any),
      db.select({ count: sql<number>`count(*)` }).from(tasksTable)
        .where(and(userFilter, lt(tasksTable.dueDate, now), sql`${tasksTable.status} != 'completed'`) as any),
      db.select({ count: sql<number>`count(*)` }).from(tasksTable)
        .where(and(userFilter, gt(tasksTable.dueDate, todayStart), lt(tasksTable.dueDate, todayEnd)) as any),
      db.select({ count: sql<number>`count(*)` }).from(tasksTable)
        .where(and(userFilter, eq(tasksTable.status, "completed")) as any),
    ]);

    res.json({
      pending: Number(pending[0].count),
      overdue: Number(overdue[0].count),
      today: Number(today[0].count),
      completed: Number(completed[0].count),
      isTeamView: isManager,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
