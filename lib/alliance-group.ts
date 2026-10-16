import type { PrismaClient } from "@prisma/client";
import { getAllianceIds } from "./settings";
import { AppError } from "./i18n/errors";

export const RELATIONS = ["OWN", "ALLIED", "CLOSE_ALLY", "NAP", "NEUTRAL", "ENEMY"] as const;
export type Relation = (typeof RELATIONS)[number];

/** Diese Typen bilden zusammen die „eigene Gruppe“: intern wie eine einzige Allianz behandelt (Abgleich, Einladungen, Filter). */
export const OWN_GROUP_RELATIONS: readonly Relation[] = ["OWN", "ALLIED"];

export const RELATION_LABEL: Record<Relation, string> = {
  OWN: "Eigene Allianz", ALLIED: "Allianz", CLOSE_ALLY: "Enge Bündnispartner", NAP: "NAP", NEUTRAL: "Neutral", ENEMY: "Feind",
};

/** Spieler dieser Typen dürfen sich registrieren und müssen sich verifizieren (eigene Gruppe + enge Bündnispartner). */
export const VERIFY_RELATIONS: readonly Relation[] = ["OWN", "ALLIED", "CLOSE_ALLY"];
export const canVerify = (r: Relation | undefined) => r !== undefined && VERIFY_RELATIONS.includes(r);

export const isOwnGroup = (r: Relation | undefined) => r !== undefined && OWN_GROUP_RELATIONS.includes(r);

/** Explizite Einträge schlagen die konfigurierte Haupt-Allianz (ENV/Setting), die sonst implizit OWN ist. */
export function effectiveRelations(rows: { allianceId: number; relation: Relation }[], configuredOwnIds: readonly number[] = []): Map<number, Relation> {
  const map = new Map<number, Relation>();
  for (const id of configuredOwnIds) map.set(id, "OWN");
  for (const r of rows) map.set(r.allianceId, r.relation);
  return map;
}

export const ownGroupIds = (relations: Map<number, Relation>): Set<number> =>
  new Set([...relations].filter(([, r]) => isOwnGroup(r)).map(([id]) => id));

export const verifiableIds = (relations: Map<number, Relation>): Set<number> =>
  new Set([...relations].filter(([, r]) => canVerify(r)).map(([id]) => id));

export type GroupPlayer = { id: number; name: string; allianceId: number; population: number };
export type LinkRow = { userId: string; playerId: number; status: "pending" | "verified" | "rejected" };

export type MemberComparison = {
  /** Spieler der eigenen Gruppe laut map.sql, mit den User-Accounts, die verifiziert auf sie zeigen (Duals möglich). */
  members: (GroupPlayer & { userIds: string[]; pendingUserIds: string[] })[];
  /** In der Gruppe, aber ohne verifizierten Account im System. */
  withoutAccount: GroupPlayer[];
  /** Verifizierte Accounts, deren Spieler (laut letztem Import) nicht mehr zur Gruppe gehört: Markierung im Admin-UI, keine Sperre. */
  orphanLinks: LinkRow[];
  summary: { groupPlayers: number; withAccount: number; withoutAccount: number; orphanLinks: number };
};

/** Abgleich „Mitglieder in unserem System“ vs. „Mitglieder unserer (Gruppen-)Allianz“. */
export function compareMembers(groupPlayers: GroupPlayer[], links: LinkRow[]): MemberComparison {
  const verified = new Map<number, string[]>();
  const pending = new Map<number, string[]>();
  for (const l of links) {
    const target = l.status === "verified" ? verified : l.status === "pending" ? pending : undefined;
    if (target) target.set(l.playerId, [...(target.get(l.playerId) ?? []), l.userId]);
  }
  const members = groupPlayers.map((p) => ({ ...p, userIds: verified.get(p.id) ?? [], pendingUserIds: pending.get(p.id) ?? [] }));
  const groupIds = new Set(groupPlayers.map((p) => p.id));
  const withoutAccount = members.filter((m) => m.userIds.length === 0).map((m) => ({ id: m.id, name: m.name, allianceId: m.allianceId, population: m.population }));
  const orphanLinks = links.filter((l) => l.status === "verified" && !groupIds.has(l.playerId));
  return {
    members, withoutAccount, orphanLinks,
    summary: {
      groupPlayers: members.length, withAccount: members.length - withoutAccount.length,
      withoutAccount: withoutAccount.length, orphanLinks: orphanLinks.length,
    },
  };
}

export async function loadRelations(db: PrismaClient): Promise<Map<number, Relation>> {
  const rows = await db.allianceClassification.findMany();
  return effectiveRelations(rows, await getAllianceIds(db));
}

export async function loadGroupPlayers(db: PrismaClient, relations?: Map<number, Relation>): Promise<GroupPlayer[]> {
  const ids = [...ownGroupIds(relations ?? (await loadRelations(db)))];
  if (ids.length === 0) return [];
  return db.player.findMany({
    where: { allianceId: { in: ids } }, select: { id: true, name: true, allianceId: true, population: true }, orderBy: { name: "asc" },
  });
}

/** Schreibt die Klassifizierung. Berechtigungsprüfung (alliances.classify) macht der Aufrufer (M3). */
export async function setRelation(db: PrismaClient, allianceId: number, relation: Relation, opts: { note?: string; updatedBy?: string } = {}) {
  if (!Number.isInteger(allianceId) || allianceId <= 0) throw new AppError("err.alliance.invalidId");
  if (!RELATIONS.includes(relation)) throw new AppError("err.alliance.invalidRelation");
  return db.allianceClassification.upsert({
    where: { allianceId },
    create: { allianceId, relation, note: opts.note, updatedBy: opts.updatedBy },
    update: { relation, note: opts.note, updatedBy: opts.updatedBy },
  });
}

export async function clearRelation(db: PrismaClient, allianceId: number) {
  await db.allianceClassification.deleteMany({ where: { allianceId } });
}
