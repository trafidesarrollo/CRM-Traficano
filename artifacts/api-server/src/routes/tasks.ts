import { Router, type IRouter } from "express";
import { db, tasksTable, taskAssigneesTable, notificationsTable, salespeopleTable, clientsTable, usersTable, quotesTable } from "@workspace/db";
import { eq, desc, sql, and, or, lt, gt, gte, lte, isNull, inArray, ne } from "drizzle-orm";

const router: IRouter = Router();

// Helper: sync task_assignees for a task (replace all)
async function syncAssignees(taskId: number, assigneeIds: number[]) {
  if (!assigneeIds.length) return;
  // Delete existing
  await db.delete(taskAssigneesTable).where(eq(taskAssigneesTable.taskId, taskId));
  // Insert new
  const rows = [...new Set(assigneeIds)].map(uid => ({ taskId, userId: uid }));
  if (rows.length) await db.insert(taskAssigneesTable).values(rows).onConflictDoNothing();
}

// Helper: get all assignee names for a task
async function getAssigneeNames(taskId: number): Promise<{ id: number; name: string }[]> {
  const rows = await db
    .select({ id: usersTable.id, name: usersTable.fullName })
    .from(taskAssigneesTable)
    .innerJoin(usersTable, eq(taskAssigneesTable.userId, usersTable.id))
    .where(eq(taskAssigneesTable.taskId, taskId));
  return rows.map(r => ({ id: r.id, name: r.name ?? "" }));
}

// Helper: notify all co-assignees except the actor
async function notifyAssignees(taskId: number, actorId: number, type: string, title: string, body: string) {
  const assignees = await db
    .select({ userId: taskAssigneesTable.userId })
    .from(taskAssigneesTable)
    .where(and(eq(taskAssigneesTable.taskId, taskId), ne(taskAssigneesTable.userId, actorId)));

  for (const { userId } of assignees) {
    await db.insert(notificationsTable).values({
      userId,
      type,
      title,
      body,
      link: `/tasks?id=${taskId}`,
      entityType: "task",
      entityId: taskId,
    });
  }
}

router.get("/tasks", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const assignedTo = req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined;
    const view = req.query.view as string | undefined;

    const priority = req.query.priority as string | undefined;
    const quoteId = req.query.quoteId ? parseInt(req.query.quoteId as string) : undefined;
    const parentTaskId = req.query.parentTaskId ? parseInt(req.query.parentTaskId as string) : undefined;
    const conds: any[] = [];
    if (status) conds.push(eq(tasksTable.status, status as any));
    if (priority && priority !== "all") conds.push(eq(tasksTable.priority, priority as any));
    if (quoteId) conds.push(eq(tasksTable.quoteId, quoteId));
    if (parentTaskId) conds.push(eq(tasksTable.parentTaskId, parentTaskId));
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

    // For assignee filtering: tasks where assigned_to = X OR they appear in task_assignees
    if (assignedTo) {
      conds.push(
        or(
          eq(tasksTable.assignedTo, assignedTo),
          sql`EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = ${tasksTable.id} AND ta.user_id = ${assignedTo})`
        )
      );
    }

    const where = conds.length ? and(...conds) : undefined;

    const childCounts = db.$with("child_counts").as(
      db.select({
        parentTaskId: tasksTable.parentTaskId,
        cnt: sql<number>`count(*)`.as("cnt"),
      }).from(tasksTable).where(sql`${tasksTable.parentTaskId} is not null`).groupBy(tasksTable.parentTaskId)
    );

    const data = await db.with(childCounts).select({
      t: tasksTable,
      assigneeName: usersTable.fullName,
      clientName: clientsTable.companyName,
      childrenCount: sql<number>`coalesce(${childCounts.cnt}, 0)`,
      assigneeNames: sql<string>`(
        SELECT string_agg(u2.full_name, ', ' ORDER BY u2.full_name)
        FROM task_assignees ta2
        JOIN users u2 ON u2.id = ta2.user_id
        WHERE ta2.task_id = ${tasksTable.id}
      )`,
      assigneeIds: sql<string>`(
        SELECT string_agg(ta2.user_id::text, ',' ORDER BY ta2.user_id)
        FROM task_assignees ta2
        WHERE ta2.task_id = ${tasksTable.id}
      )`,
      closedByName: sql<string | null>`(
        SELECT u3.full_name FROM users u3 WHERE u3.id = ${tasksTable.closedBy}
      )`,
    }).from(tasksTable)
      .leftJoin(usersTable, eq(tasksTable.assignedTo, usersTable.id))
      .leftJoin(clientsTable, eq(tasksTable.clientId, clientsTable.id))
      .leftJoin(childCounts, eq(tasksTable.id, childCounts.parentTaskId))
      .where(where as any)
      .orderBy(sql`case when ${tasksTable.status}='completed' then 1 else 0 end, ${tasksTable.dueDate} asc nulls last`)
      .limit(500);

    res.json(data.map(r => ({
      ...r.t,
      assigneeName: r.assigneeNames ?? r.assigneeName,
      assigneeNames: r.assigneeNames ?? r.assigneeName ?? null,
      assigneeIds: r.assigneeIds ? r.assigneeIds.split(",").map(Number) : (r.t.assignedTo ? [r.t.assignedTo] : []),
      clientName: r.clientName,
      childrenCount: Number(r.childrenCount),
      closedByName: r.closedByName ?? null,
    })));
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
        childrenCount: sql<number>`(select count(*) from tasks c where c.parent_task_id = ${tasksTable.id})`,
        parentTitle: sql<string | null>`(select p.title from tasks p where p.id = ${tasksTable.parentTaskId})`,
        assigneeNames: sql<string>`(
          SELECT string_agg(u2.full_name, ', ' ORDER BY u2.full_name)
          FROM task_assignees ta2
          JOIN users u2 ON u2.id = ta2.user_id
          WHERE ta2.task_id = ${tasksTable.id}
        )`,
        assigneeIds: sql<string>`(
          SELECT string_agg(ta2.user_id::text, ',' ORDER BY ta2.user_id)
          FROM task_assignees ta2
          WHERE ta2.task_id = ${tasksTable.id}
        )`,
        closedByName: sql<string | null>`(
          SELECT u3.full_name FROM users u3 WHERE u3.id = ${tasksTable.closedBy}
        )`,
      })
      .from(tasksTable)
      .leftJoin(usersTable, eq(tasksTable.assignedTo, usersTable.id))
      .leftJoin(clientsTable, eq(tasksTable.clientId, clientsTable.id))
      .where(eq(tasksTable.id, id));
    if (!row) { res.status(404).json({ error: "Tarea no encontrada" }); return; }
    res.json({
      ...row.t,
      assigneeName: row.assigneeNames ?? row.assigneeName,
      assigneeNames: row.assigneeNames ?? row.assigneeName ?? null,
      assigneeIds: row.assigneeIds ? row.assigneeIds.split(",").map(Number) : (row.t.assignedTo ? [row.t.assignedTo] : []),
      clientName: row.clientName,
      childrenCount: Number(row.childrenCount),
      parentTitle: row.parentTitle ?? null,
      closedByName: row.closedByName ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    const { assigneeIds: rawAssigneeIds, ...rest } = req.body;
    const assigneeIds: number[] = Array.isArray(rawAssigneeIds) && rawAssigneeIds.length > 0
      ? rawAssigneeIds.map(Number).filter(Boolean)
      : rest.assignedTo ? [parseInt(rest.assignedTo)] : [];

    const data: any = { ...rest, createdBy: userId };
    // Primary assignee = first in list
    if (assigneeIds.length > 0) data.assignedTo = assigneeIds[0];

    for (const k of ["dueDate", "reminderAt", "completedAt"]) {
      if (data[k] && typeof data[k] === "string") data[k] = new Date(data[k]);
    }
    const [row] = await db.insert(tasksTable).values(data).returning();

    // Sync assignees junction table
    if (assigneeIds.length > 0) {
      await syncAssignees(row.id, assigneeIds);
    } else if (row.assignedTo) {
      await syncAssignees(row.id, [row.assignedTo]);
    }

    // Notify all assignees except creator
    for (const uid of assigneeIds) {
      if (uid !== userId) {
        await db.insert(notificationsTable).values({
          userId: uid,
          type: "task_assigned",
          title: "Nueva tarea asignada",
          body: row.title,
          link: `/tasks?id=${row.id}`,
          entityType: "task",
          entityId: row.id,
        });
      }
    }

    // Push to Google Calendar for all assignees (best-effort)
    (async () => {
      try {
        if (!row.dueDate) return;
        const { getUserConnection, getValidAccessToken, pushTaskToGCal } = await import("./gcal.js");
        const targets = assigneeIds.length ? assigneeIds : (row.assignedTo ? [row.assignedTo] : []);
        for (const uid of targets) {
          const conn = await getUserConnection(uid);
          if (!conn?.calendarSyncEnabled) continue;
          const token = await getValidAccessToken(conn);
          const r = await pushTaskToGCal(token, row);
          if (r && uid === targets[0]) {
            await db.update(tasksTable).set({ googleEventId: r.id, googleSyncedAt: new Date() }).where(eq(tasksTable.id, row.id));
          }
        }
      } catch {}
    })();

    res.status(201).json({ ...row, assigneeIds });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).session?.userId;
    const { assigneeIds: rawAssigneeIds, ...rest } = req.body;
    const data: any = { ...rest };

    for (const k of ["dueDate", "reminderAt", "completedAt"]) {
      if (data[k] && typeof data[k] === "string") data[k] = new Date(data[k]);
    }
    if (data.status === "completed" && !data.completedAt) {
      data.completedAt = new Date();
      if (userId) data.closedBy = userId;
    }

    const [prev] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    if (!prev) { res.status(404).json({ error: "No encontrada" }); return; }

    // Update assignees if provided
    if (Array.isArray(rawAssigneeIds) && rawAssigneeIds.length > 0) {
      const ids = rawAssigneeIds.map(Number).filter(Boolean);
      data.assignedTo = ids[0];
      await syncAssignees(id, ids);

      // Notify new assignees
      for (const uid of ids) {
        if (uid !== userId && uid !== prev.assignedTo) {
          await db.insert(notificationsTable).values({
            userId: uid,
            type: "task_assigned",
            title: "Tarea asignada a vos",
            body: prev.title,
            link: `/tasks?id=${id}`,
            entityType: "task",
            entityId: id,
          });
        }
      }
    }

    const [row] = await db.update(tasksTable).set(data).where(eq(tasksTable.id, id)).returning();

    // If completing or deferring, notify co-assignees
    if (data.status === "completed") {
      await notifyAssignees(id, userId, "task_assigned", "Tarea completada por un compañero", `"${row.title}" fue marcada como completada.`);
    } else if (data.dueDate && data.dueDate !== prev.dueDate) {
      await notifyAssignees(id, userId, "task_assigned", "Tarea reagendada", `"${row.title}" fue reagendada por un compañero.`);
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

// Weekly view for manager
router.get("/tasks/weekly", async (req, res) => {
  try {
    const weekStart = req.query.weekStart ? new Date(req.query.weekStart as string) : (() => {
      const d = new Date(); d.setHours(0,0,0,0);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return d;
    })();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 5);
    weekEnd.setHours(0,0,0,0);

    const assignedTo = req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined;
    const conds: any[] = [gte(tasksTable.dueDate, weekStart), lt(tasksTable.dueDate, weekEnd)];
    if (assignedTo) {
      conds.push(
        or(
          eq(tasksTable.assignedTo, assignedTo),
          sql`EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = ${tasksTable.id} AND ta.user_id = ${assignedTo})`
        )
      );
    }

    const data = await db.select({
      t: tasksTable,
      assigneeName: usersTable.fullName,
      clientName: clientsTable.companyName,
      assigneeNames: sql<string>`(
        SELECT string_agg(u2.full_name, ', ' ORDER BY u2.full_name)
        FROM task_assignees ta2
        JOIN users u2 ON u2.id = ta2.user_id
        WHERE ta2.task_id = ${tasksTable.id}
      )`,
    }).from(tasksTable)
      .leftJoin(usersTable, eq(tasksTable.assignedTo, usersTable.id))
      .leftJoin(clientsTable, eq(tasksTable.clientId, clientsTable.id))
      .where(and(...conds))
      .orderBy(
        sql`case when ${tasksTable.priority}='urgent' then 0 when ${tasksTable.priority}='high' then 1 when ${tasksTable.priority}='medium' then 2 else 3 end`,
        tasksTable.dueDate
      )
      .limit(500);

    res.json(data.map(r => ({
      ...r.t,
      assigneeName: r.assigneeNames ?? r.assigneeName,
      clientName: r.clientName,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id/chain — full ancestor chain for a task (oldest first)
router.get("/tasks/:id/chain", async (req, res) => {
  try {
    const startId = parseInt(req.params.id);
    if (isNaN(startId)) { res.status(400).json({ error: "Invalid task id" }); return; }

    // Recursive CTE to walk up the ancestor chain (max 50 hops)
    const rows = await db.execute(sql`
      WITH RECURSIVE chain AS (
        SELECT t.*, 0 AS depth
        FROM tasks t
        WHERE t.id = ${startId}
        UNION ALL
        SELECT p.*, c.depth + 1
        FROM tasks p
        JOIN chain c ON p.id = c.parent_task_id
        WHERE c.depth < 50
      )
      SELECT
        chain.*,
        (SELECT co.company_name FROM clients co WHERE co.id = chain.client_id) AS client_name,
        (SELECT string_agg(u2.full_name, ', ' ORDER BY u2.full_name)
         FROM task_assignees ta2
         JOIN users u2 ON u2.id = ta2.user_id
         WHERE ta2.task_id = chain.id) AS assignee_names,
        (SELECT string_agg(ta2.user_id::text, ',' ORDER BY ta2.user_id)
         FROM task_assignees ta2
         WHERE ta2.task_id = chain.id) AS assignee_ids,
        (SELECT u3.full_name FROM users u3 WHERE u3.id = chain.closed_by) AS closed_by_name,
        (SELECT u4.full_name FROM users u4 WHERE u4.id = chain.created_by) AS created_by_name
      FROM chain
      ORDER BY chain.depth DESC
    `);

    const chain = (rows.rows ?? rows as any[]).map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      type: r.type,
      priority: r.priority,
      status: r.status,
      dueDate: r.due_date,
      completedAt: r.completed_at,
      parentTaskId: r.parent_task_id,
      clientId: r.client_id,
      createdAt: r.created_at,
      assignedTo: r.assigned_to,
      closedBy: r.closed_by,
      createdBy: r.created_by,
      clientName: r.client_name ?? null,
      assigneeNames: r.assignee_names ? r.assignee_names.split(", ") : [],
      assigneeIds: r.assignee_ids ? r.assignee_ids.split(",").map(Number) : [],
      closedByName: r.closed_by_name ?? null,
      createdByName: r.created_by_name ?? null,
    }));

    res.json(chain);
  } catch (err: any) {
    console.error("[chain endpoint error]", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/tasks/defer-overdue", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    const now = new Date();
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);

    const overdue = await db.select().from(tasksTable).where(
      and(
        lt(tasksTable.dueDate, todayStart),
        sql`${tasksTable.status} IN ('pending', 'in_progress')`
      )
    );

    if (overdue.length === 0) { res.json({ deferred: 0 }); return; }

    const nextDay = new Date(todayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    if (nextDay.getDay() === 6) nextDay.setDate(nextDay.getDate() + 2);
    if (nextDay.getDay() === 0) nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(8, 0, 0, 0);

    const DEFER_ALERT_THRESHOLD = 2;
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

    for (const row of inserted) {
      if (row.assignedTo) {
        await db.insert(taskAssigneesTable).values({ taskId: row.id, userId: row.assignedTo }).onConflictDoNothing();
        if (row.assignedTo !== userId) {
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

    const assignedToParam = req.query.assignedTo ? Number(req.query.assignedTo) : null;

    let userFilter: any;
    const makeAssigneeFilter = (uid: number) => or(
      eq(tasksTable.assignedTo, uid),
      sql`EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = ${tasksTable.id} AND ta.user_id = ${uid})`
    );

    if (!isManager) {
      userFilter = makeAssigneeFilter(userId);
    } else if (assignedToParam) {
      userFilter = makeAssigneeFilter(assignedToParam);
    } else {
      userFilter = undefined;
    }

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
