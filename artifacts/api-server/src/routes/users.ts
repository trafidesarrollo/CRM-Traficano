import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

router.get("/users", async (req, res) => {
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

router.post("/users", async (req, res) => {
  try {
    const { username, email, password, fullName, role } = req.body;
    if (!username || !email || !password || !fullName || !role) {
      res.status(400).json({ error: "Todos los campos son requeridos" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({ username, email, passwordHash, fullName, role }).returning();
    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

router.get("/users/:id", async (req, res) => {
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

router.patch("/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { email, fullName, role, isActive, password } = req.body;
    const updates: any = {};
    if (email !== undefined) updates.email = email;
    if (fullName !== undefined) updates.fullName = fullName;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;
    if (password) updates.passwordHash = await bcrypt.hash(password, 10);

    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    const { passwordHash: _, ...safeUser } = updated;
    res.json(safeUser);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ message: "Usuario eliminado" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

export default router;
