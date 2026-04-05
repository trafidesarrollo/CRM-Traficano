import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auditAction } from "../lib/audit.js";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const users = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      fullName: usersTable.fullName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    }).from(usersTable);
    res.json(users);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar usuarios" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { username, email, password, fullName, role } = req.body;
    if (!username || !email || !password || !fullName || !role) {
      res.status(400).json({ error: "Todos los campos son requeridos" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({ username, email, passwordHash, fullName, role }).returning();
    const { passwordHash: _, ...safeUser } = user;

    await auditAction(req, "crear_usuario", "user", user.id, { username, role });

    res.status(201).json(safeUser);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const users = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      fullName: usersTable.fullName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!users[0]) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    res.json(users[0]);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener usuario" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { email, fullName, role, isActive, password } = req.body;

    const existing = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    const updates: any = {};
    const changes: Record<string, any> = {};
    if (email !== undefined) { updates.email = email; changes.email = { old: existing[0].email, new: email }; }
    if (fullName !== undefined) { updates.fullName = fullName; changes.fullName = { old: existing[0].fullName, new: fullName }; }
    if (role !== undefined) { updates.role = role; changes.role = { old: existing[0].role, new: role }; }
    if (isActive !== undefined) { updates.isActive = isActive; changes.isActive = { old: existing[0].isActive, new: isActive }; }
    if (password) { updates.passwordHash = await bcrypt.hash(password, 10); changes.password = "cambiada"; }

    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    const { passwordHash: _, ...safeUser } = updated;

    await auditAction(req, "modificar_usuario", "user", id, changes);

    res.json(safeUser);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const currentUserId = (req as any).userId;
    if (id === currentUserId) {
      res.status(400).json({ error: "No puede eliminar su propio usuario" });
      return;
    }
    await db.delete(usersTable).where(eq(usersTable.id, id));
    await auditAction(req, "eliminar_usuario", "user", id);
    res.json({ message: "Usuario eliminado" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

export default router;
