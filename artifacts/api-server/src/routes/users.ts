import { Router, type IRouter } from "express";
import { db, usersTable, userModulePermissionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auditAction } from "../lib/audit.js";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const users = await db.select({
      id: usersTable.id,
      username: usersTable.username,
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
    const { username, password, fullName, role } = req.body;
    if (!username || !password || !fullName || !role) {
      res.status(400).json({ error: "Usuario, contraseña, nombre y rol son requeridos" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({ username, passwordHash, fullName, role }).returning();
    const { passwordHash: _, ...safeUser } = user;
    await auditAction(req, "crear_usuario", "user", user.id, { username, role });
    res.status(201).json(safeUser);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

router.get("/me/permissions", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const perms = await db.select({ module: userModulePermissionsTable.module })
      .from(userModulePermissionsTable)
      .where(eq(userModulePermissionsTable.userId, userId));
    res.json({ modules: perms.map(p => p.module) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener permisos" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const users = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      fullName: usersTable.fullName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!users[0]) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
    res.json(users[0]);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener usuario" });
  }
});

router.get("/:id/permissions", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const perms = await db.select({ module: userModulePermissionsTable.module })
      .from(userModulePermissionsTable)
      .where(eq(userModulePermissionsTable.userId, id));
    res.json({ modules: perms.map(p => p.module) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener permisos" });
  }
});

router.put("/:id/permissions", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { modules } = req.body as { modules: string[] };
    if (!Array.isArray(modules)) {
      res.status(400).json({ error: "modules debe ser un array" });
      return;
    }
    await db.delete(userModulePermissionsTable).where(eq(userModulePermissionsTable.userId, id));
    if (modules.length > 0) {
      await db.insert(userModulePermissionsTable).values(modules.map(m => ({ userId: id, module: m })));
    }
    await auditAction(req, "modificar_permisos", "user", id, { modules });
    res.json({ modules });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al guardar permisos" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { fullName, role, isActive, password } = req.body;
    const existing = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!existing[0]) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
    const updates: any = {};
    const changes: Record<string, any> = {};
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

    const target = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!target[0]) { res.status(404).json({ error: "Usuario no encontrado" }); return; }

    if (target[0].role === "admin") {
      const { count } = await import("drizzle-orm");
      const result = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.role, "admin"));
      const adminCount = Number(result[0]?.total ?? 0);
      if (adminCount <= 1) {
        res.status(400).json({ error: "No se puede eliminar al único administrador del sistema. Debe existir al menos un admin." });
        return;
      }
    }

    await db.delete(usersTable).where(eq(usersTable.id, id));
    await auditAction(req, "eliminar_usuario", "user", id, { username: target[0].username, role: target[0].role });
    res.json({ message: "Usuario eliminado" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

export default router;
