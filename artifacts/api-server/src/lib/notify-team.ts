import { db, clientsTable, commercialTeamMembersTable, usersTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface TeamNotifyOptions {
  clientId: number;
  excludeUserId?: number;
  type: string;
  title: string;
  body?: string;
  link?: string;
  entityType?: string;
  entityId?: number;
}

/**
 * Creates a notification for every member of the commercial team assigned to a client.
 * If the client has no assigned team, does nothing.
 * Best-effort: errors are swallowed so they never block the main response.
 */
export async function notifyTeam(opts: TeamNotifyOptions): Promise<void> {
  try {
    const { clientId, excludeUserId, ...notifPayload } = opts;

    const [client] = await db
      .select({ assignedTeamId: clientsTable.assignedTeamId })
      .from(clientsTable)
      .where(eq(clientsTable.id, clientId))
      .limit(1);

    if (!client?.assignedTeamId) return;

    const members = await db
      .select({ userId: usersTable.id })
      .from(commercialTeamMembersTable)
      .innerJoin(usersTable, eq(commercialTeamMembersTable.userId, usersTable.id))
      .where(eq(commercialTeamMembersTable.teamId, client.assignedTeamId));

    const targets = members
      .map((m) => m.userId)
      .filter((uid) => uid != null && uid !== excludeUserId);

    if (targets.length === 0) return;

    await db.insert(notificationsTable).values(
      targets.map((userId) => ({
        userId: userId!,
        type: notifPayload.type,
        title: notifPayload.title,
        body: notifPayload.body,
        link: notifPayload.link,
        entityType: notifPayload.entityType,
        entityId: notifPayload.entityId,
      }))
    );
  } catch {
  }
}
