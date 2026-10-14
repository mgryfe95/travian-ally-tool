import type { PrismaClient } from "@prisma/client";
import { loadGroupPlayers } from "../alliance-group";
import { ForbiddenError, hasPermission } from "../permissions";
import { ageInDays } from "../reminders";
import { readTroops, sumTroops, type TroopEntry, type UnitTotal } from "../troops";
import { audit, loadMatrix, type Actor } from "./context";
import { getOwnVillage } from "./villages";

/** Manuelle Eingabe der eigenen Truppen (bis die Screenshot-Erkennung aktiv ist). Setzt nur den Bereich „Truppen“ und dessen Zeitstempel. */
export async function saveTroops(db: PrismaClient, userId: string, villageId: number, entries: TroopEntry[], now = new Date()) {
  if (!(await getOwnVillage(db, userId, villageId))) throw new ForbiddenError("Dieses Dorf gehört nicht zu deinem Konto");
  const data = entries as unknown as object;
  await db.villageState.upsert({
    where: { villageId },
    create: { villageId, userId, troops: data, troopsAt: now, capturedAt: now },
    update: { troops: data, troopsAt: now, capturedAt: now, userId },
  });
}

export type VillageTroops = { villageId: number; name: string; x: number; y: number; troops: TroopEntry[]; troopsAt: Date | null; ageDays: number | null };
export type MemberTroops = { playerId: number; playerName: string; accounts: string[]; villages: VillageTroops[]; totals: UnitTotal[]; oldestAgeDays: number | null };
export type TroopsOverview = { members: MemberTroops[]; totals: UnitTotal[]; membersWithoutAccount: number; membersWithoutData: number };

/**
 * Truppen aller Mitglieder der eigenen Allianz-Gruppe für Planung und Koordination.
 * Nur mit Recht `troops.view` (Moderator/Admin/Systemadmin); jede Einsicht wird im Audit-Log vermerkt.
 */
export async function troopsOverview(db: PrismaClient, actor: Actor, now = new Date()): Promise<TroopsOverview> {
  if (!hasPermission(actor.role, "troops.view", await loadMatrix(db))) throw new ForbiddenError("Fehlendes Recht troops.view");
  const players = await loadGroupPlayers(db);
  const links = await db.playerLink.findMany({ where: { status: "verified", travianPlayerId: { in: players.map((p) => p.id) } }, include: { user: { select: { name: true, banned: true } } } });
  const withAccount = new Set(links.map((l) => l.travianPlayerId));
  const villages = await db.village.findMany({ where: { playerId: { in: [...withAccount] } }, orderBy: [{ population: "desc" }, { id: "asc" }] });
  const states = new Map((await db.villageState.findMany({ where: { villageId: { in: villages.map((v) => v.id) } } })).map((s) => [s.villageId, s]));

  const members: MemberTroops[] = players
    .filter((p) => withAccount.has(p.id))
    .map((p) => {
      const vs: VillageTroops[] = villages.filter((v) => v.playerId === p.id).map((v) => {
        const s = states.get(v.id);
        return { villageId: v.id, name: v.name, x: v.x, y: v.y, troops: readTroops(s?.troops), troopsAt: s?.troopsAt ?? null, ageDays: ageInDays(s?.troopsAt ?? null, now) };
      });
      const ages = vs.map((v) => v.ageDays).filter((a): a is number => a !== null);
      return {
        playerId: p.id, playerName: p.name, accounts: links.filter((l) => l.travianPlayerId === p.id).map((l) => l.user.name), villages: vs,
        totals: sumTroops(vs.map((v) => v.troops)), oldestAgeDays: ages.length ? Math.max(...ages) : null,
      };
    });
  await audit(db, actor.id, "troops.view", "troops:overview");
  return {
    members, totals: sumTroops(members.flatMap((m) => m.villages.map((v) => v.troops))),
    membersWithoutAccount: players.length - withAccount.size, membersWithoutData: members.filter((m) => m.villages.every((v) => v.troopsAt === null)).length,
  };
}
