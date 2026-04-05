import { db, auditLogsTable } from "@workspace/db";
import { Request } from "express";

interface AuditEntry {
  userId?: number;
  action: string;
  entityType: string;
  entityId?: number;
  details?: Record<string, any>;
  ipAddress?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      userId: entry.userId || null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId || null,
      details: entry.details || null,
      ipAddress: entry.ipAddress || null,
    });
  } catch (err) {
    console.error("[AUDIT] Error al registrar auditoría:", err);
  }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

export async function auditLogin(userId: number, username: string, req: Request): Promise<void> {
  await logAudit({
    userId,
    action: "login",
    entityType: "session",
    details: { username },
    ipAddress: getClientIp(req),
  });
}

export async function auditLoginFailed(username: string, reason: string, req: Request): Promise<void> {
  await logAudit({
    action: "login_failed",
    entityType: "session",
    details: { username, reason },
    ipAddress: getClientIp(req),
  });
}

export async function auditLogout(userId: number, req: Request): Promise<void> {
  await logAudit({
    userId,
    action: "logout",
    entityType: "session",
    ipAddress: getClientIp(req),
  });
}

export async function auditAction(
  req: Request,
  action: string,
  entityType: string,
  entityId?: number,
  details?: Record<string, any>,
): Promise<void> {
  await logAudit({
    userId: (req as any).userId,
    action,
    entityType,
    entityId,
    details,
    ipAddress: getClientIp(req),
  });
}
