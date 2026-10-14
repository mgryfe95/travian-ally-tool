import type { PrismaClient } from "@prisma/client";
import { buildMemberRows, type LinkInfo } from "@/lib/admin-members";
import { loadGroupPlayers, loadRelations } from "@/lib/alliance-group";

/** Zeilen des Mitglieder-Tabs: Gruppenspieler + Konten/Claims/Einladungen. */
export async function loadMemberRows(db: PrismaClient) {
  const relations = await loadRelations(db);
  const players = await loadGroupPlayers(db, relations);
  const ids = players.map((p) => p.id);
  const links = await db.playerLink.findMany({ where: { travianPlayerId: { in: ids } }, include: { user: { select: { name: true, email: true } } }, orderBy: { id: "asc" } });
  const invites = await db.invite.findMany({ where: { travianPlayerId: { in: ids }, usedAt: null, revokedAt: null } });
  const infos: LinkInfo[] = links.map((l) => ({
    id: l.id, userId: l.userId, userName: l.user.name, email: l.user.email, playerId: l.travianPlayerId,
    status: l.status as LinkInfo["status"], method: l.method as LinkInfo["method"], claimCode: l.claimCode,
  }));
  return buildMemberRows(players, infos, invites.map((i) => ({ id: i.id, playerId: i.travianPlayerId, expiresAt: i.expiresAt })));
}
