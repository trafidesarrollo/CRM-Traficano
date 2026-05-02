import { Router, type IRouter } from "express";
import { db, tasksTable, notificationsTable, salespeopleTable, clientsTable, usersTable } from "@workspace/db";
import { eq, desc, sql, and, or, lt, gt, isNull } from "drizzle-orm";

const router: IRouter = Router();

router.get("/tasks", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const assignedTo = req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined;
    const view = req.query.view as string | undefined;

    const conds: any[] = [];
    if (status) conds.push(eq(tasksTable.status, status as any));
    if (assignedTo) conds.push(eq(tasksTable.assignedTo, assignedTo));
    if (view === "today") {
      const start = new Date(); start.setHours(0,0,0,0);
      const end = new Date(); end.setHours(23,59,59,999);
      conds.push(and(gt(tasksTable.dueDate, start), lt(tasksTable.dueDate, end)));
    }
    if (view === "overdue") {
      conds.push(and(lt(tasksTable.dueDate, new Date()), sql`${tasksTable.status} != 'completed'`));
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

router.get("/tasks/stats/summary", async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    const now = new Date();
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

    const [pending, overdue, today, completed] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(tasksTable).where(and(eq(tasksTable.assignedTo, userId), eq(tasksTable.status, "pending"))),
      db.select({ count: sql<number>`count(*)` }).from(tasksTable).where(and(eq(tasksTable.assignedTo, userId), lt(tasksTable.dueDate, now), sql`${tasksTable.status} != 'completed'`)),
      db.select({ count: sql<number>`count(*)` }).from(tasksTable).where(and(eq(tasksTable.assignedTo, userId), gt(tasksTable.dueDate, todayStart), lt(tasksTable.dueDate, todayEnd))),
      db.select({ count: sql<number>`count(*)` }).from(tasksTable).where(and(eq(tasksTable.assignedTo, userId), eq(tasksTable.status, "completed"))),
    ]);

    res.json({
      pending: Number(pending[0].count),
      overdue: Number(overdue[0].count),
      today: Number(today[0].count),
      completed: Number(completed[0].count),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
