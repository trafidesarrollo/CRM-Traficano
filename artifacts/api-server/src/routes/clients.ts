import { Router, type IRouter } from "express";
import { db, clientsTable, quotesTable, ordersTable, contactsTable, activitiesTable, salespeopleTable, tasksTable } from "@workspace/db";
import { eq, ilike, sql, desc, inArray, and } from "drizzle-orm";

const router: IRouter = Router();

// Compute the automatic status based on filled fields + consumptionScale.
// Rules:
//   prospect  → default, any client with incomplete required fields
//   potential → required fields filled AND consumptionScale > 0
//   inactive  → required fields filled AND consumptionScale === 0
//   final     → set automatically when client makes a first OC (convert-to-order)
//               or manually by admin (never auto-downgraded from final)
function computeStatus(data: any, existingStatus?: string): string {
  // final can only be set explicitly
  if (existingStatus === "final") return "final";

  const requiredFilled =
    data.companyName?.trim() &&
    data.taxId?.trim() &&
    data.industry?.trim() &&
    data.city?.trim();

  if (!requiredFilled) return "prospect";

  const scale = parseFloat(data.consumptionScale ?? "");
  if (isNaN(scale)) return "potential"; // scale not set yet → potential with no scale
  if (scale === 0) return "inactive";
  return "potential";
}

router.get("/clients", async (req, res) => {
  try {
    const page    = parseInt(req.query.page as string) || 1;
    const limit   = parseInt(req.query.limit as string) || 200;
    const search  = (req.query.search as string) || "";
    const statusFilter     = (req.query.status as string) || "";
    const importanceFilter = (req.query.importance as string) || "";
    const teamFilter       = (req.query.teamId as string) || "";
    const offset  = (page - 1) * limit;

    // Build dynamic WHERE fragments (Drizzle sql-tagged for safe parameterisation)
    const searchCond = search
      ? sql`AND c.company_name ILIKE ${"%" + search + "%"}`
      : sql``;
    const statusCond = statusFilter
      ? sql`AND c.status = ANY(${statusFilter.split(",").map(s => s.trim()).filter(Boolean)})`
      : sql``;
    const importanceCond = importanceFilter
      ? sql`AND COALESCE(c.importance,'ninguna') = ANY(${importanceFilter.split(",").map(s => s.trim()).filter(Boolean)})`
      : sql``;
    const teamCond = teamFilter === "none"
      ? sql`AND c.assigned_team_id IS NULL`
      : teamFilter && teamFilter !== "all"
        ? sql`AND c.assigned_team_id = ${parseInt(teamFilter)}`
        : sql``;

    const [dataRes, countRes] = await Promise.all([
      db.execute(sql`
        SELECT
          c.*,
          COALESCE(
            (SELECT u.full_name
               FROM commercial_team_members ctm
               JOIN users u ON u.id = ctm.user_id
              WHERE ctm.team_id = c.assigned_team_id AND ctm.role = 'vendedor'
              LIMIT 1),
            (SELECT s.name FROM salespeople s WHERE s.id = c.assigned_salesperson_id LIMIT 1)
          ) AS vendedor_principal,
          COALESCE(
            (SELECT SUM(COALESCE(q.net_amount::numeric, q.total::numeric, 0))
               FROM quotes q
              WHERE q.client_id = c.id
                AND q.status NOT IN ('approved','rejected','FINALIZADA','PERDIDA','expired')),
            0
          ) AS total_cotizado_abierto,
          (SELECT t.title
             FROM tasks t
            WHERE t.client_id = c.id
              AND t.status NOT IN ('done','completed','cancelled')
              AND t.due_date IS NOT NULL
            ORDER BY t.due_date ASC LIMIT 1) AS ultima_tarea,
          (SELECT t.due_date
             FROM tasks t
            WHERE t.client_id = c.id
              AND t.status NOT IN ('done','completed','cancelled')
              AND t.due_date IS NOT NULL
            ORDER BY t.due_date ASC LIMIT 1) AS ultima_tarea_fecha,
          (SELECT a.created_at
             FROM activities a
            WHERE a.client_id = c.id
            ORDER BY a.created_at DESC LIMIT 1) AS ultimo_contacto
        FROM clients c
        WHERE 1=1
          ${searchCond}
          ${statusCond}
          ${importanceCond}
          ${teamCond}
        ORDER BY c.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      db.execute(sql`
        SELECT COUNT(*) AS cnt
        FROM clients c
        WHERE 1=1
          ${searchCond}
          ${statusCond}
          ${importanceCond}
          ${teamCond}
      `),
    ]);

    const data = dataRes.rows.map((r: any) => ({
      ...r,
      // camelCase aliases for frontend consistency
      companyName: r.company_name,
      taxId: r.tax_id,
      assignedSalespersonId: r.assigned_salesperson_id,
      assignedUserId: r.assigned_user_id,
      assignedTeamId: r.assigned_team_id,
      clientEmails: r.client_emails ?? [],
      consumptionScale: r.consumption_scale,
      externalId: r.external_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      vendedorPrincipal: r.vendedor_principal ?? null,
      totalCotizadoAbierto: Number(r.total_cotizado_abierto ?? 0),
      ultimaTarea: r.ultima_tarea ?? null,
      ultimaTareaFecha: r.ultima_tarea_fecha ?? null,
      ultimoContacto: r.ultimo_contacto ?? null,
    }));

    res.json({ data, total: Number((countRes.rows[0] as any).cnt), page, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar clientes" });
  }
});

router.post("/clients", async (req, res) => {
  try {
    const body = { ...req.body };
    const callerRole = (req as any).session?.role;
    const isAdminOrManager = callerRole === "admin" || callerRole === "gerente" || callerRole === "gerente_comercial";

    // Only admin/gerente can assign a team at creation time
    if (!isAdminOrManager && "assignedTeamId" in body) {
      delete body.assignedTeamId;
    }

    const status = computeStatus(body, undefined);
    const [client] = await db.insert(clientsTable).values({ ...body, status }).returning();
    res.status(201).json(client);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al crear cliente" });
  }
});

router.get("/clients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const clients = await db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
    if (!clients[0]) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
    const client = clients[0];
    // Enrich with salesperson + support user
    let salespersonInfo: any = null;
    if (client.assignedSalespersonId) {
      const rows = await db.execute(sql`
        SELECT s.id, s.name, s.email, s.phone, s.functional_role, s.support_user_id,
               u.full_name AS support_user_name, u.username AS support_user_username
        FROM salespeople s
        LEFT JOIN users u ON u.id = s.support_user_id
        WHERE s.id = ${client.assignedSalespersonId}
        LIMIT 1
      `);
      if (rows.rows[0]) salespersonInfo = rows.rows[0];
    }
    res.json({ ...client, salespersonInfo });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener cliente" });
  }
});

router.get("/clients/:id/overview", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
    if (!client) { res.status(404).json({ error: "Cliente no encontrado" }); return; }

    const [quotes, orders, contacts, activities, tasks] = await Promise.all([
      db.execute(sql`
        SELECT q.*, s.name AS salesperson_name
        FROM quotes q
        LEFT JOIN salespeople s ON s.id = q.salesperson_id
        WHERE q.client_id = ${id}
        ORDER BY q.date DESC
        LIMIT 100
      `),
      db.execute(sql`
        SELECT o.*, s.name AS salesperson_name
        FROM orders o
        LEFT JOIN salespeople s ON s.id = o.salesperson_id
        WHERE o.client_id = ${id}
        ORDER BY o.date DESC
        LIMIT 100
      `),
      db.select().from(contactsTable).where(eq(contactsTable.clientId, id)).orderBy(desc(contactsTable.isPrimary)),
      db.select().from(activitiesTable).where(eq(activitiesTable.clientId, id)).orderBy(desc(activitiesTable.createdAt)).limit(50),
      db.execute(sql`
        SELECT t.*, u.full_name AS assignee_name
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assigned_to
        WHERE t.client_id = ${id}
        ORDER BY t.created_at DESC
        LIMIT 50
      `),
    ]);

    const quotesData = quotes.rows as any[];
    const ordersData = orders.rows as any[];
    const totalQuoted = quotesData.reduce((s: number, q: any) => s + Number(q.net_amount || q.total || 0), 0);
    const totalOrdered = ordersData.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
    // Won = approved + no close_reason (handles both old rows with quote_status='EN PROCESO' and new ones with 'FINALIZADA')
    const approvedQuotes = quotesData.filter((q: any) => q.status === "approved" && !q.close_reason);
    const wonQuotes = approvedQuotes.length;
    const totalApproved = approvedQuotes.reduce((s: number, q: any) => s + Number(q.net_amount || q.total || 0), 0);
    const conversionRate = quotesData.length ? (wonQuotes / quotesData.length) * 100 : 0;

    // Enrich with team info
    let teamInfo: any = null;
    if (client.assignedTeamId) {
      const teamRes = await db.execute(sql`
        SELECT ct.id, ct.name, ct.description,
          COALESCE(
            json_agg(json_build_object('id', ctm.id, 'userId', ctm.user_id, 'role', ctm.role, 'fullName', u.full_name))
            FILTER (WHERE ctm.id IS NOT NULL),
            '[]'
          ) AS members
        FROM commercial_teams ct
        LEFT JOIN commercial_team_members ctm ON ctm.team_id = ct.id
        LEFT JOIN users u ON u.id = ctm.user_id
        WHERE ct.id = ${client.assignedTeamId}
        GROUP BY ct.id
      `);
      teamInfo = teamRes.rows[0] || null;
    }

    res.json({
      client,
      teamInfo,
      quotes: quotesData,
      orders: ordersData,
      contacts: contacts,
      activities: activities,
      tasks: tasks.rows as any[],
      stats: { totalQuoted, totalOrdered, totalApproved, quotesCount: quotesData.length, ordersCount: ordersData.length, wonQuotes, conversionRate },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener resumen del cliente" });
  }
});

router.patch("/clients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;
    const session = (req as any).session;
    const callerRole = session?.role;
    const callerUserId = session?.userId;

    // Load existing to preserve final status
    const [existing] = await db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Cliente no encontrado" }); return; }

    // Team assignment — only admin/gerente can set or change assignedTeamId
    if ("assignedTeamId" in body) {
      const isAdminOrManager = callerRole === "admin" || callerRole === "gerente" || callerRole === "gerente_comercial";
      if (!isAdminOrManager) {
        res.status(403).json({ error: "Solo el administrador o gerente puede asignar equipos a un cliente" });
        return;
      }
    }

    // Salesperson assignment permission check
    if ("assignedSalespersonId" in body) {
      const isAdminOrManager = callerRole === "admin" || callerRole === "gerente" || callerRole === "gerente_comercial";
      if (!isAdminOrManager) {
        // A vendedor can only self-assign (their own salesperson record)
        const [mySp] = await db.select().from(salespeopleTable).where(eq(salespeopleTable.userId, callerUserId)).limit(1);
        const targetSpId = body.assignedSalespersonId ? Number(body.assignedSalespersonId) : null;
        const isSelfAssign = mySp && targetSpId === mySp.id;
        const isUnassign = targetSpId === null && existing.assignedSalespersonId === (mySp?.id ?? null);
        if (!isSelfAssign && !isUnassign) {
          res.status(403).json({ error: "Solo podés asignarte a vos mismo como vendedor de un cliente" });
          return;
        }
      }
    }

    // Status logic for PATCH:
    // 1. "status" in body AND different from existing → intentional override, honor it
    // 2. "consumptionScale" in body → drive status by scale (even if status also sent but unchanged)
    // 3. Neither → keep existing status unchanged
    // "final" is never auto-demoted in any case.
    const statusIntentionallyChanged =
      "status" in body && body.status && body.status !== existing.status;

    let newStatus: string;
    if (statusIntentionallyChanged) {
      newStatus = existing.status === "final" ? "final" : body.status;
    } else if (existing.status !== "final") {
      // Merge body with existing to evaluate full record
      const merged = { ...existing, ...body };
      newStatus = computeStatus(merged, existing.status);
      // Never auto-downgrade an already-promoted client (potential/active) back to prospect
      if (newStatus === "prospect" && (existing.status === "potential" || existing.status === "active")) {
        newStatus = existing.status;
      }
    } else {
      newStatus = existing.status;
    }

    const [updated] = await db.update(clientsTable)
      .set({ ...body, status: newStatus })
      .where(eq(clientsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
});

router.delete("/clients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(clientsTable).where(eq(clientsTable.id, id));
    res.json({ message: "Cliente eliminado" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al eliminar cliente" });
  }
});

export default router;
