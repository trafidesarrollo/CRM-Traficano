import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Usuario y contraseña requeridos" });
      return;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    const user = users[0];

    if (!user || !user.isActive) {
      res.status(401).json({ error: "Credenciales inválidas" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Credenciales inválidas" });
      return;
    }

    (req.session as any).userId = user.id;
    (req.session as any).userRole = user.role;

    const { passwordHash: _, ...safeUser } = user;
    res.json({ user: safeUser, message: "Login exitoso" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Sesión cerrada" });
  });
});

router.get("/auth/me", async (req, res) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = users[0];
    if (!user) {
      res.status(401).json({ error: "Usuario no encontrado" });
      return;
    }
    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
