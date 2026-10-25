import type { PrismaClient } from "@prisma/client";
import { loadRelations, type Relation } from "../alliance-group";
import { readingSchema } from "../ai/reading";
import { distance, roundFields } from "../geo";
import { AppError } from "../i18n/errors";
import { draftFromReading, INCIDENT_KINDS, namedUnits, parseCoordText, threatDays, YES_NO_UNKNOWN, type Answers, type IncidentDraft, type IncidentKind, type UnitCount } from "../incidents";
import { ForbiddenError, hasPermission } from "../permissions";
import { readTroops } from "../troops";
import { chatCtx, postMessage } from "./chat";
import { loadMatrix, type Actor } from "./context";
import { saveTroops } from "./troops";
import { upsertMemory } from "./memory";
import { getOwnVillage, ownVillages } from "./villages";

export class IncidentError extends AppError {}

const HERO = { en: "Hero", de: "Held" };

/** Einheitennamen eines Volkes je Platz (1–10, 11 = Held) in der Sprache des Nutzers. */
async function slotNames(db: PrismaClient, tribe: number | null | undefined, locale: string) {
  const rows = tribe ? await db.unitName.findMany({ where: { tribeVid: tribe } }) : [];
  const by = new Map(rows.map((r) => [r.slot, locale === "de" ? (r.nameDe ?? r.nameEn) : r.nameEn]));
  const all = new Map(rows.flatMap((r) => [[r.nameEn.toLowerCase(), r.slot] as const, ...(r.nameDe ? [[r.nameDe.toLowerCase(), r.slot] as const] : [])]));
  return { nameOf: (slot: number) => (slot === 11 ? (locale === "de" ? HERO.de : HERO.en) : by.get(slot) ?? `#${slot}`), slotOf: (name: string) => all.get(name.trim().toLowerCase()) ?? (/^(hero|held)$/i.test(name.trim()) ? 11 : null) };
}

async function resolveAttacker(db: PrismaClient, name: string, x: number | null, y: number | null) {
  if (x !== null && y !== null) {
    const v = await db.village.findFirst({ where: { x, y }, select: { playerId: true } });
    if (v) return db.player.findUnique({ where: { id: v.playerId } });
  }
  return name ? db.player.findFirst({ where: { name: { equals: name, mode: "insensitive" } } }) : null;
}

/** Entwurf aus eigenem Kampfbericht-Screenshot (sonst null). */
export async function draftFromScreenshot(db: PrismaClient, userId: string, screenshotId: number): Promise<(IncidentDraft & { villageId: number | null }) | null> {
  const shot = await db.screenshot.findFirst({ where: { id: screenshotId, userId } });
  const reading = readingSchema.safeParse((shot?.parsed as { reading?: unknown } | null)?.reading);
  if (!shot || !reading.success) return null;
  const d = draftFromReading(reading.data);
  if (!d) return null;
  const own = await ownVillages(db, userId);
  const v = own.find((o) => o.x === d.defenderX && o.y === d.defenderY) ?? (shot.villageId ? own.find((o) => o.id === shot.villageId) : undefined);
  return { ...d, villageId: v?.id ?? null };
}

export type IncidentInput = {
  villageId: number; kind: string; occurredAt?: Date | null; attacker: string; attackerAlliance?: string;
  answers: Answers; notes?: string; screenshotId?: number | null; correctTroops?: boolean;
  /** Spalten aus dem Kampfbericht (bevorzugt) oder manuell eingegebene Verluste */
  attackerUnits?: number[]; attackerLosses?: number[]; defenderLosses?: number[]; manualLosses?: UnitCount[];
};

export function parseAnswers(f: (k: string) => string): Answers {
  const m = f("moreAttacks");
  return { moreAttacks: (YES_NO_UNKNOWN as readonly string[]).includes(m) ? (m as Answers["moreAttacks"]) : "unknown", ongoing: f("ongoing") === "yes" ? "yes" : "no", needHelp: f("needHelp") === "yes" ? "yes" : "no" };
}

/** Incident anlegen (nur eigenes Ziel-Dorf). Optional eigene Truppen im Dorf um die Verluste verringern. */
export async function createIncident(db: PrismaClient, actor: Actor, input: IncidentInput, locale: string, now = new Date()) {
  if (!hasPermission(actor.role, "incidents.report", await loadMatrix(db))) throw new ForbiddenError("err.perm.missing", { perm: "incidents.report" });
  const village = await getOwnVillage(db, actor.id, input.villageId);
  if (!village) throw new ForbiddenError("err.village.notOwn");
  const kind: IncidentKind = (INCIDENT_KINDS as readonly string[]).includes(input.kind) ? (input.kind as IncidentKind) : "unknown";
  const coords = parseCoordText(input.attacker);
  const attackerName = coords ? "" : input.attacker.trim().slice(0, 60);
  const attacker = await resolveAttacker(db, attackerName, coords?.x ?? null, coords?.y ?? null);
  const own = await db.player.findUnique({ where: { id: village.playerId }, select: { tribe: true } });
  const mine = await slotNames(db, own?.tribe, locale);
  const theirs = await slotNames(db, attacker?.tribe, locale);
  const defenderLosses = input.defenderLosses?.length ? namedUnits(input.defenderLosses, mine.nameOf) : input.manualLosses ?? [];
  const alliance = attacker && attacker.allianceId ? (await db.alliance.findUnique({ where: { id: attacker.allianceId }, select: { name: true } }))?.name ?? "" : "";

  const incident = await db.incident.create({
    data: {
      userId: actor.id, villageId: village.id, kind, occurredAt: input.occurredAt ?? null,
      attackerName: attacker?.name ?? attackerName, attackerPlayerId: attacker?.id ?? null, attackerAlliance: alliance || (input.attackerAlliance ?? "").slice(0, 40),
      attackerX: coords?.x ?? null, attackerY: coords?.y ?? null,
      attackerUnits: input.attackerUnits?.length ? (namedUnits(input.attackerUnits, theirs.nameOf) as object) : undefined,
      attackerLosses: input.attackerLosses?.length ? (namedUnits(input.attackerLosses, theirs.nameOf) as object) : undefined,
      defenderLosses: defenderLosses.length ? (defenderLosses as object) : undefined,
      answers: input.answers as object, notes: (input.notes ?? "").trim().slice(0, 2000), screenshotId: input.screenshotId ?? null,
      threatUntil: new Date(now.getTime() + threatDays(input.answers) * 86_400_000),
    },
  });
  await indexIncident(db, incident.id);
  if (input.correctTroops && defenderLosses.length) {
    const state = await db.villageState.findUnique({ where: { villageId: village.id } });
    const troops = readTroops(state?.troops);
    if (troops.length) {
      const loss = new Map<number | string, number>();
      for (const l of defenderLosses) loss.set(mine.slotOf(l.unit) ?? l.unit.toLowerCase(), l.count);
      const next = troops.map((t) => { const key = mine.slotOf(t.unit) ?? t.unit.toLowerCase(); const l = loss.get(key); return l ? { ...t, inVillage: Math.max(0, t.inVillage - l) } : t; });
      await saveTroops(db, actor.id, village.id, next, now);
      await db.incident.update({ where: { id: incident.id }, data: { troopsCorrected: true } });
    }
  }
  return incident;
}

/** Eigene Incidents; mit `incidents.view` alle (Admin-Lagekarte). */
export async function listIncidents(db: PrismaClient, actor: Actor, opts: { all?: boolean; openOnly?: boolean } = {}) {
  const canAll = opts.all && hasPermission(actor.role, "incidents.view", await loadMatrix(db));
  return db.incident.findMany({ where: { ...(canAll ? {} : { userId: actor.id }), ...(opts.openOnly ? { status: "open" } : {}) }, orderBy: { createdAt: "desc" }, take: 200 });
}

/** Einzelner Incident: Besitzer oder `incidents.view`; sonst „nicht gefunden“ (kein Hinweis auf Existenz). */
export async function getIncident(db: PrismaClient, actor: Actor, id: number) {
  const i = await db.incident.findUnique({ where: { id } });
  if (!i) return null;
  if (i.userId === actor.id || hasPermission(actor.role, "incidents.view", await loadMatrix(db))) return i;
  return null;
}

export type IncidentContext = { village: { name: string; x: number; y: number } | null; attacker: { name: string; population: number; villages: number; alliance: string; relation: Relation | null; nearest: number | null } | null };

/** Angreifer-Umfeld aus der map.sql: Einwohner, Dörfer, Allianz-Typ, Entfernung des nächsten Dorfes zum Ziel. */
export async function incidentContext(db: PrismaClient, i: { villageId: number; attackerPlayerId: number | null }): Promise<IncidentContext> {
  const v = await db.village.findUnique({ where: { id: i.villageId }, select: { name: true, x: true, y: true } });
  if (!i.attackerPlayerId) return { village: v, attacker: null };
  const p = await db.player.findUnique({ where: { id: i.attackerPlayerId } });
  if (!p) return { village: v, attacker: null };
  const [villages, alliance, relations] = await Promise.all([db.village.findMany({ where: { playerId: p.id }, select: { x: true, y: true } }), p.allianceId ? db.alliance.findUnique({ where: { id: p.allianceId } }) : null, loadRelations(db)]);
  const nearest = v && villages.length ? Math.min(...villages.map((w) => distance(w, v))) : null;
  return { village: v, attacker: { name: p.name, population: p.population, villages: p.villageCount, alliance: alliance?.name ?? "", relation: p.allianceId ? relations.get(p.allianceId) ?? null : null, nearest: nearest === null ? null : roundFields(nearest) } };
}

export async function resolveIncident(db: PrismaClient, actor: Actor, id: number) {
  const r = await db.incident.updateMany({ where: { id, userId: actor.id }, data: { status: "resolved", threatUntil: new Date() } });
  if (r.count === 0) throw new IncidentError("err.notFound");
  await indexIncident(db, id);
}

/** Incident ins Gedächtnis des Besitzers schreiben (durchsuchbar für Lagebild und Verlaufssuche). */
async function indexIncident(db: PrismaClient, id: number) {
  const i = await db.incident.findUnique({ where: { id } });
  if (!i) return;
  const v = await db.village.findUnique({ where: { id: i.villageId }, select: { name: true, x: true, y: true } });
  const list = (x: unknown) => (Array.isArray(x) ? (x as UnitCount[]).map((u) => `${u.count} ${u.unit}`).join(", ") : "");
  const a = i.answers as Answers;
  await upsertMemory(db, i.userId, {
    sourceType: "incident", sourceId: i.id,
    title: `${i.kind} on ${v?.name ?? "?"} by ${i.attackerName || (i.attackerX !== null ? `(${i.attackerX}|${i.attackerY})` : "unknown")}${i.attackerAlliance ? ` [${i.attackerAlliance}]` : ""}`,
    body: [`date ${(i.occurredAt ?? i.createdAt).toISOString().slice(0, 10)}`, `status ${i.status}`, v ? `village ${v.x}|${v.y}` : "", i.defenderLosses ? `own losses ${list(i.defenderLosses)}` : "", i.attackerLosses ? `attacker losses ${list(i.attackerLosses)}` : "", `more attacks expected ${a.moreAttacks}`, i.notes].filter(Boolean).join("; "),
  });
}

/** Hilfe im Deff-Call anfragen (einmal je Incident, englisch für die internationale Allianz). */
export async function requestHelp(db: PrismaClient, actor: Actor, id: number) {
  const i = await db.incident.findFirst({ where: { id, userId: actor.id } });
  if (!i) throw new IncidentError("err.notFound");
  if (i.helpRequestedAt) throw new IncidentError("err.incident.helpAlready");
  const ch = await db.channel.findFirst({ where: { tree: "ALLY", slug: "deff-call", archivedAt: null } });
  if (!ch) throw new IncidentError("err.incident.noDeffChannel");
  const ctx = await incidentContext(db, i);
  const a = i.answers as Answers;
  const who = i.attackerName || (i.attackerX !== null ? `(${i.attackerX}|${i.attackerY})` : "unknown attacker");
  const lines = [
    `🛡️ **Defence needed** – ${i.kind} on **${ctx.village?.name ?? "?"}** (${ctx.village ? `${ctx.village.x}|${ctx.village.y}` : "?"})`,
    `Attacker: ${who}${i.attackerAlliance ? ` [${i.attackerAlliance}]` : ""}${ctx.attacker?.nearest != null ? ` · nearest village ${ctx.attacker.nearest} fields away` : ""}`,
    `More attacks expected: ${a.moreAttacks}${a.ongoing === "yes" ? " · attacks incoming right now" : ""}`,
  ];
  await postMessage(db, await chatCtx(db, actor), { channelId: ch.id, body: lines.join("\n") });
  await db.incident.update({ where: { id }, data: { helpRequestedAt: new Date() } });
}

/** Aktive Incidents eines Nutzers fürs Lagebild (offen und im Bedrohungszeitraum). */
export async function activeIncidents(db: PrismaClient, userId: string, now = new Date()) {
  return db.incident.findMany({ where: { userId, status: "open", threatUntil: { gt: now } }, orderBy: { createdAt: "desc" }, take: 5 });
}
