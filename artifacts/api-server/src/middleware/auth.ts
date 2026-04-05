import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthenticatedRequest extends Request {
  userId: number;
  userRole: string;
  userFullName: string;
}

const ROLE_HIERARCHY: Record<string, number> = {
  admin: 100,
  gerente: 75,
  vendedor: 50,
  operador: 25,
};

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = (req.session as any)?.userId;
  const userRole = (req.session as any)?.userRole;

  if (!userId || !userRole) {
    res.status(401).json({ error: "No autenticado. Inicie sesión." });
    return;
  }

  (req as any).userId = userId;
  (req as any).userRole = userRole;
  (req as any).userFullName = (req.session as any)?.userFullName || "";

  next();
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = (req as any).userRole;

    if (!userRole) {
      res.status(401).json({ error: "No autenticado." });
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        error: `Acceso denegado. Se requiere rol: ${allowedRoles.join(" o ")}. Su rol: ${userRole}`,
      });
      return;
    }

    next();
  };
}

export function requireMinRole(minRole: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = (req as any).userRole;

    if (!userRole) {
      res.status(401).json({ error: "No autenticado." });
      return;
    }

    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < requiredLevel) {
      res.status(403).json({
        error: `Acceso denegado. Se requiere nivel mínimo: ${minRole}. Su rol: ${userRole}`,
      });
      return;
    }

    next();
  };
}
