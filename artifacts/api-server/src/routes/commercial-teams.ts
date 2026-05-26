import { Router, type IRouter } from "express";
import { db, commercialTeamsTable, commercialTeamMembersTable, usersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

// GET /commercial-teams — list all teams with their members
router.get("/commercial-teams", async (req, res) => {
  try {
    const teams = await db.select().from(commercialTeamsTable).orderBy(asc(commercialTeamsTable.name));
    const members = await db
      .select({
        id: commercialTeamMembersTable.id,
        teamId: commercialTeamMembersTable.teamId,
        userId: commercialTeamMembersTable.userId,
        role: commercialTeamMembersTable.role,
        fullName: usersTable.fullName,
        username: usersTable.username,
      })
      .from(commercialTeamMembersTable)
      .leftJoin(usersTable, eq(commercialTeamMembersTable.userId, usersTable.id));

    const teamsWithMembers = teams.map(t => ({
      ...t,
      members: members.filter(m => m.teamId === t.id),
    }));
    res.json(teamsWithMembers);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar equipos" });
  }
});

// POST /commercial-teams — create team
router.post("/commercial-teams", async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: "El nombre es requerido" });
      return;
    }
    const [team] = await db.insert(commercialTeamsTable).values({ name: name.trim(), description: description || null }).returning();
    res.status(201).json({ ...team, members: [] });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al crear equipo" });
  }
});

// PUT /commercial-teams/:id — update team
router.put("/commercial-teams/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, isActive } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description || null;
    if (isActive !== undefined) updates.isActive = isActive;
    const [updated] = await db.update(commercialTeamsTable).set(updates).where(eq(commercialTeamsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Equipo no encontrado" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al actualizar equipo" });
  }
});

// DELETE /commercial-teams/:id — delete team
router.delete("/commercial-teams/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(commercialTeamMembersTable).where(eq(commercialTeamMembersTable.teamId, id));
    await db.delete(commercialTeamsTable).where(eq(commercialTeamsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al eliminar equipo" });
  }
});

// POST /commercial-teams/:id/members — add member
router.post("/commercial-teams/:id/members", async (req, res) => {
  try {
    const teamId = parseInt(req.params.id);
    const { userId, role } = req.body;
    if (!userId) { res.status(400).json({ error: "userId requerido" }); return; }
    // Avoid duplicates
    const existing = await db.select().from(commercialTeamMembersTable)
      .where(eq(commercialTeamMembersTable.teamId, teamId));
    if (existing.find(m => m.userId === userId)) {
      res.status(409).json({ error: "El usuario ya está en el equipo" });
      return;
    }
    const [member] = await db.insert(commercialTeamMembersTable).values({
      teamId,
      userId,
      role: role || "vendedor",
    }).returning();
    // Return with user info
    const [user] = await db.select({ fullName: usersTable.fullName, username: usersTable.username })
      .from(usersTable).where(eq(usersTable.id, userId));
    res.status(201).json({ ...member, fullName: user?.fullName, username: user?.username });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al agregar miembro" });
  }
});

// DELETE /commercial-teams/:id/members/:memberId — remove member
router.delete("/commercial-teams/:id/members/:memberId", async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    await db.delete(commercialTeamMembersTable).where(eq(commercialTeamMembersTable.id, memberId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al quitar miembro" });
  }
});

export default router;
