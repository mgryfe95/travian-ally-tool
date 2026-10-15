import type { PrismaClient } from "@prisma/client";
import { env } from "../env";
import { ForbiddenError, hasPermission, type Permission } from "../permissions";
import { publish } from "../realtime";
import { audit, loadMatrix, userLocale, type Actor } from "./context";
import { ChatError } from "./chat";
import { DEFAULT_LOCALE, INTL_TAG, translate, type Locale, type MessageKey } from "../i18n";

export const CALL_KINDS = ["ATTACK", "DEFF", "ATTACK_DAY", "OTHER"] as const;
export type CallKind = (typeof CALL_KINDS)[number];
export const KIND_KEY: Record<CallKind, MessageKey> = { ATTACK: "err.call.kind.ATTACK", DEFF: "err.call.kind.DEFF", ATTACK_DAY: "err.call.kind.ATTACK_DAY", OTHER: "err.call.kind.OTHER" };

export const PLACEHOLDERS = ["{art}", "{titel}", "{spieler}", "{dorf}", "{koordinaten}", "{zeit}", "{link}", "{notiz}"] as const;

export const DEFAULT_TEMPLATES: { kind: CallKind; name: string; body: string }[] = [
  { kind: "ATTACK", name: "Angriff", body: "⚔️ **Angriff** auf **{spieler}** – {dorf} {koordinaten}\nZeit: {zeit}\n{link}\n{notiz}" },
  { kind: "DEFF", name: "Deff-Unterstützung", body: "🛡️ **Deff-Call** für **{spieler}** – {dorf} {koordinaten}\nBis: {zeit}\nBitte Truppen schicken: {link}\n{notiz}" },
  { kind: "ATTACK_DAY", name: "Angriffstag", body: "⚔️ **Angriffstag** {zeit}\n{titel}\n{notiz}" },
];

async function requirePerm(db: PrismaClient, actor: Actor, perm: Permission) {
  if (!hasPermission(actor.role, perm, await loadMatrix(db))) throw new ForbiddenError("err.perm.missing", { perm });
}

export async function seedSchedule(db: PrismaClient) {
  if ((await db.callTemplate.count()) > 0) return;
  const ch = await db.channel.findFirst({ where: { tree: "ALLY", archivedAt: null }, orderBy: { sortOrder: "asc" } });
  const byName = async (n: string) => (await db.channel.findFirst({ where: { tree: "ALLY", name: n, archivedAt: null } }))?.id ?? ch?.id ?? null;
  await db.callTemplate.createMany({
    data: await Promise.all(DEFAULT_TEMPLATES.map(async (t, i) => ({ ...t, sortOrder: i, channelId: await byName(t.kind === "DEFF" ? "Deff-Call" : t.kind === "ATTACK" ? "Off-Call" : "Off-Call") }))),
  });
}

/** "(12|-34)", "12|-34", "12 -34", "12,-34" → [12, -34] */
export function parseCoord(raw: string): [number, number] | null {
  const m = raw.trim().replace(/[()−–]/g, (c) => (c === "(" || c === ")" ? "" : "-")).match(/^(-?\d{1,3})\s*[|,; ]\s*(-?\d{1,3})$/);
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  return Math.abs(x) <= 200 && Math.abs(y) <= 200 ? [x, y] : null;
}

/** "2026-10-15T18:30" (Eingabe in Europe/Berlin) → UTC-Date. */
export function berlinToDate(local: string): Date | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/);
  if (!m) return null;
  const asUtc = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  const offset = (t: number) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(t));
    const g = (k: string) => Number(parts.find((p) => p.type === k)!.value);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - Math.floor(t / 60000) * 60000;
  };
  let t = asUtc - offset(asUtc);
  t = asUtc - offset(t);
  return new Date(t);
}

const fmtTime = (d: Date | null, locale: Locale) =>
  d ? translate(locale, "err.call.time", { time: new Intl.DateTimeFormat(INTL_TAG[locale], { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(d) }) : "";

type CallLike = { kind: string; title: string; x: number | null; y: number | null; playerId: number | null; playerName: string | null; villageName: string | null; at: Date | null; template: string; note: string };

/** Setzt Platzhalter ein; leere Zeilen (nicht belegte Platzhalter) werden entfernt. Link führt zur Spielerseite im Tool. */
export function renderCall(c: CallLike, appUrl = env().APP_URL, locale: Locale = DEFAULT_LOCALE): string {
  const vars: Record<string, string> = {
    art: c.kind in KIND_KEY ? translate(locale, KIND_KEY[c.kind as CallKind]) : c.kind, titel: c.title, spieler: c.playerName ?? "", dorf: c.villageName ?? "",
    koordinaten: c.x !== null && c.y !== null ? `(${c.x}|${c.y})` : "", zeit: fmtTime(c.at, locale), link: c.playerId ? `${appUrl.replace(/\/+$/, "")}/players/${c.playerId}` : "", notiz: c.note,
  };
  // Englische Aliase für dieselben Platzhalter ({type}, {title}, {player}, {village}, {coords}, {time}, {note})
  Object.assign(vars, { type: vars.art, title: vars.titel, player: vars.spieler, village: vars.dorf, coords: vars.koordinaten, time: vars.zeit, note: vars.notiz });
  return c.template
    .replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "")
    .split("\n").map((l) => l.replace(/[ \t]+/g, " ").trimEnd()).filter((l, i, a) => l.trim() !== "" || (i > 0 && a[i - 1]!.trim() !== "" && i < a.length - 1))
    .join("\n").trim();
}

export async function resolveTarget(db: PrismaClient, x: number, y: number) {
  const v = await db.village.findFirst({ where: { x, y } });
  if (!v) return null;
  const p = await db.player.findUnique({ where: { id: v.playerId } });
  return { villageId: v.id, villageName: v.name, playerId: v.playerId, playerName: p?.name ?? null };
}

export type CallInput = { kind: string; title?: string; coord?: string; at?: Date | null; channelId?: number; templateId?: number; note?: string; sendNow?: boolean };

export async function createCall(db: PrismaClient, actor: Actor, input: CallInput, now = new Date()) {
  await requirePerm(db, actor, "schedule.manage");
  if (!(CALL_KINDS as readonly string[]).includes(input.kind)) throw new ChatError("err.call.invalidKind");
  const kind = input.kind as CallKind;
  let xy: [number, number] | null = null;
  if (input.coord?.trim()) {
    xy = parseCoord(input.coord);
    if (!xy) throw new ChatError("err.call.coordFormat");
  }
  if ((kind === "ATTACK" || kind === "DEFF") && !xy) throw new ChatError("err.call.coordsRequired");
  const target = xy ? await resolveTarget(db, xy[0], xy[1]) : null;
  if (xy && !target) throw new ChatError("err.call.noVillage", { x: xy[0], y: xy[1] });
  const tpl = input.templateId ? await db.callTemplate.findUnique({ where: { id: input.templateId } }) : await db.callTemplate.findFirst({ where: { kind }, orderBy: { sortOrder: "asc" } });
  if (!tpl) throw new ChatError("err.call.noTemplate");
  const channelId = input.channelId ?? tpl.channelId ?? (await db.channel.findFirst({ where: { tree: "ALLY", archivedAt: null }, orderBy: { sortOrder: "asc" } }))?.id;
  const ch = channelId ? await db.channel.findUnique({ where: { id: channelId } }) : null;
  if (!ch || ch.tree !== "ALLY" || ch.archivedAt) throw new ChatError("err.call.channelInvalid");
  const at = input.at ?? null;
  const note = (input.note ?? "").trim().slice(0, 500);
  const call = await db.allianceCall.create({
    data: {
      kind, title: (input.title ?? "").trim().slice(0, 80), x: xy?.[0] ?? null, y: xy?.[1] ?? null, villageId: target?.villageId, villageName: target?.villageName, playerId: target?.playerId,
      playerName: target?.playerName, at, channelId: ch.id, template: tpl.body, note, status: at ? "scheduled" : "draft", createdBy: actor.id,
    },
  });
  await audit(db, actor.id, "call.create", `call:${call.id}`, undefined, { kind, at, coord: xy });
  if (input.sendNow) return sendCall(db, actor, call.id, now);
  return call;
}

/** Postet den Call in den Zielkanal (Autor = Ersteller). Nur aus scheduled/draft. */
async function dispatch(db: PrismaClient, id: number, now: Date, actorId?: string) {
  const claimed = await db.allianceCall.updateMany({ where: { id, status: { in: ["scheduled", "draft"] } }, data: { status: "sending" } });
  if (claimed.count === 0) return null;
  const call = await db.allianceCall.findUniqueOrThrow({ where: { id } });
  try {
    const body = renderCall(call, undefined, await userLocale(db, actorId ?? call.createdBy));
    const m = await db.message.create({ data: { channelId: call.channelId, authorId: call.createdBy, body }, include: { tags: { include: { tag: true } }, attachments: true, channel: { select: { name: true } } } });
    const author = await db.user.findUnique({ where: { id: call.createdBy }, select: { name: true, role: true } });
    publish(call.channelId, "message:new", {
      id: m.id, channelId: m.channelId, channelName: m.channel.name, author: { id: call.createdBy, name: author?.name ?? translate(DEFAULT_LOCALE, "err.deletedUser"), role: author?.role ?? "MEMBER" },
      body: m.body, createdAt: m.createdAt.toISOString(), editedAt: null, tags: [], attachments: [],
    });
    return await db.allianceCall.update({ where: { id }, data: { status: "sent", sentAt: now, messageId: m.id } });
  } catch (e) {
    await db.allianceCall.update({ where: { id }, data: { status: call.at ? "scheduled" : "draft" } });
    throw e;
  }
}

export async function sendCall(db: PrismaClient, actor: Actor, id: number, now = new Date()) {
  await requirePerm(db, actor, "schedule.manage");
  const sent = await dispatch(db, id, now, actor.id);
  if (!sent) throw new ChatError("err.call.alreadySent");
  await audit(db, actor.id, "call.send", `call:${id}`);
  return sent;
}

/** Vom Server regelmäßig aufgerufen: sendet alle fälligen geplanten Calls. */
export async function dispatchDueCalls(db: PrismaClient, now = new Date()): Promise<number> {
  const due = await db.allianceCall.findMany({ where: { status: "scheduled", at: { lte: now } }, orderBy: { at: "asc" }, select: { id: true } });
  let n = 0;
  for (const c of due) {
    try {
      if (await dispatch(db, c.id, now)) n++;
    } catch (e) {
      console.error("[schedule] Call konnte nicht gesendet werden", c.id, e);
    }
  }
  return n;
}

export async function cancelCall(db: PrismaClient, actor: Actor, id: number) {
  await requirePerm(db, actor, "schedule.manage");
  const r = await db.allianceCall.updateMany({ where: { id, status: { in: ["scheduled", "draft"] } }, data: { status: "cancelled" } });
  if (r.count === 0) throw new ChatError("err.call.cannotCancel");
  await audit(db, actor.id, "call.cancel", `call:${id}`);
}

export async function deleteCall(db: PrismaClient, actor: Actor, id: number) {
  await requirePerm(db, actor, "schedule.manage");
  await db.allianceCall.deleteMany({ where: { id, status: { in: ["cancelled", "sent"] } } });
}

export async function saveTemplate(db: PrismaClient, actor: Actor, input: { id?: number; kind: string; name: string; body: string; channelId?: number | null }) {
  await requirePerm(db, actor, "schedule.manage");
  const name = input.name.trim();
  const body = input.body.trim();
  if (!(CALL_KINDS as readonly string[]).includes(input.kind)) throw new ChatError("err.call.invalidKind");
  if (name.length < 2 || name.length > 40) throw new ChatError("err.chat.nameLength", { min: 2, max: 40 });
  if (body.length < 3 || body.length > 2000) throw new ChatError("err.call.textLength", { min: 3, max: 2000 });
  if (input.channelId && !(await db.channel.findFirst({ where: { id: input.channelId, tree: "ALLY" } }))) throw new ChatError("err.chat.channelInvalid");
  try {
    const data = { kind: input.kind, name, body, channelId: input.channelId ?? null };
    return input.id ? await db.callTemplate.update({ where: { id: input.id }, data }) : await db.callTemplate.create({ data });
  } catch {
    throw new ChatError("err.call.templateExists");
  }
}

export async function deleteTemplate(db: PrismaClient, actor: Actor, id: number) {
  await requirePerm(db, actor, "schedule.manage");
  await db.callTemplate.deleteMany({ where: { id } });
}
