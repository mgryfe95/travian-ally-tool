import type { PrismaClient } from "@prisma/client";
import { env } from "../env";
import { ForbiddenError, hasPermission, type Permission } from "../permissions";
import { publish } from "../realtime";
import { audit, loadMatrix, userLocale, type Actor } from "./context";
import { ChatError } from "./chat";
import { mailEnabled, sendMail } from "../mail";
import { AppError } from "../i18n/errors";
import { DEFAULT_LOCALE, INTL_TAG, translate, type Locale, type MessageKey } from "../i18n";

export const CALL_KINDS = ["ATTACK", "DEFF", "ATTACK_DAY", "OTHER"] as const;
export type CallKind = (typeof CALL_KINDS)[number];
export const KIND_KEY: Record<CallKind, MessageKey> = { ATTACK: "err.call.kind.ATTACK", DEFF: "err.call.kind.DEFF", ATTACK_DAY: "err.call.kind.ATTACK_DAY", OTHER: "err.call.kind.OTHER" };

export const PLACEHOLDERS = ["{art}", "{titel}", "{spieler}", "{dorf}", "{koordinaten}", "{zeit}", "{link}", "{notiz}"] as const;

export const DEFAULT_TEMPLATES: { kind: CallKind; name: string; body: string }[] = [
  { kind: "ATTACK", name: "Angriff", body: "⚔️ **Angriff** auf **{spieler}** – {dorf} {koordinaten}\nZeit: {zeit}\n{link}\n{notiz}" },
  { kind: "DEFF", name: "Deff-Unterstützung", body: "🛡️ **Deff-Call** für **{spieler}** – {dorf} {koordinaten}\nBis: {zeit}\nBitte Truppen schicken: {link}\n{notiz}" },
  { kind: "ATTACK_DAY", name: "Angriffstag", body: "⚔️ **Angriffstag** {zeit}\n{titel}\n{notiz}" },
  { kind: "OTHER", name: "Sonstiges", body: "📣 **{titel}**\n{zeit}\n{dorf} {koordinaten}\n{notiz}" },
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

type CallLike = { kind: string; title: string; x: number | null; y: number | null; playerId: number | null; playerName: string | null; villageName: string | null; at: Date | null; eventAt?: Date | null; template: string; note: string };

/** Setzt Platzhalter ein; leere Zeilen (nicht belegte Platzhalter) werden entfernt. Link führt zur Spielerseite im Tool. */
export function renderCall(c: CallLike, appUrl = env().APP_URL, locale: Locale = DEFAULT_LOCALE): string {
  const vars: Record<string, string> = {
    art: c.kind in KIND_KEY ? translate(locale, KIND_KEY[c.kind as CallKind]) : c.kind, titel: c.title, spieler: c.playerName ?? "", dorf: c.villageName ?? "",
    koordinaten: c.x !== null && c.y !== null ? `(${c.x}|${c.y})` : "", zeit: fmtTime(c.eventAt ?? null, locale), link: c.playerId ? `${appUrl.replace(/\/+$/, "")}/players/${c.playerId}` : "", notiz: c.note,
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

/** Umkehrung zu berlinToDate: Date → "2026-10-15T18:30" (für datetime-local). */
export function dateToBerlinLocal(d: Date | null): string {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const g = (k: string) => parts.find((p) => p.type === k)!.value;
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** `at` = Sendezeitpunkt, `eventAt` = Termin des Angriffs/Ereignisses. */
export type CallInput = { kind: string; title?: string; coord?: string; at?: Date | null; eventAt?: Date | null; channelId?: number; templateId?: number; note?: string; sendNow?: boolean };

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
  const stored = input.templateId ? await db.callTemplate.findUnique({ where: { id: input.templateId } }) : await db.callTemplate.findFirst({ where: { kind }, orderBy: { sortOrder: "asc" } });
  const tpl = stored ?? (input.templateId ? null : { ...DEFAULT_TEMPLATES.find((t) => t.kind === kind)!, channelId: null });
  if (!tpl) throw new ChatError("err.call.noTemplate");
  const channelId = input.channelId ?? tpl.channelId ?? (await db.channel.findFirst({ where: { tree: "ALLY", archivedAt: null }, orderBy: { sortOrder: "asc" } }))?.id;
  const ch = channelId ? await db.channel.findUnique({ where: { id: channelId } }) : null;
  if (!ch || ch.tree !== "ALLY" || ch.archivedAt) throw new ChatError("err.call.channelInvalid");
  const at = input.at ?? null;
  const eventAt = input.eventAt ?? null;
  if (at && eventAt && at > eventAt) throw new ChatError("err.call.sendAfterEvent");
  const note = (input.note ?? "").trim().slice(0, 500);
  const call = await db.allianceCall.create({
    data: {
      kind, title: (input.title ?? "").trim().slice(0, 80), x: xy?.[0] ?? null, y: xy?.[1] ?? null, villageId: target?.villageId, villageName: target?.villageName, playerId: target?.playerId,
      playerName: target?.playerName, at, eventAt, channelId: ch.id, template: tpl.body, note, status: at ? "scheduled" : "draft", createdBy: actor.id,
    },
  });
  await audit(db, actor.id, "call.create", `call:${call.id}`, undefined, { kind, at, eventAt, coord: xy });
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

/** Postet eine Folgemeldung (Änderung/Absage) in den Kanal des Calls; optional zusätzlich als Rundmail an alle Nicht-Gäste. */
async function notifyChange(db: PrismaClient, actor: Actor, call: CallLike & { channelId: number }, key: "err.call.msg.updated" | "err.call.msg.cancelled", mail: boolean) {
  const locale = await userLocale(db, actor.id);
  const text = translate(locale, key, { text: renderCall(call, undefined, locale) });
  const m = await db.message.create({ data: { channelId: call.channelId, authorId: actor.id, body: text }, include: { channel: { select: { name: true } } } });
  const author = await db.user.findUnique({ where: { id: actor.id }, select: { name: true, role: true } });
  publish(call.channelId, "message:new", {
    id: m.id, channelId: m.channelId, channelName: m.channel.name, author: { id: actor.id, name: author?.name ?? translate(DEFAULT_LOCALE, "err.deletedUser"), role: author?.role ?? "MEMBER" },
    body: m.body, createdAt: m.createdAt.toISOString(), editedAt: null, tags: [], attachments: [],
  });
  if (!mail) return;
  const users = await db.user.findMany({ where: { role: { not: "GUEST" }, banned: false }, select: { email: true, locale: true } });
  for (const u of users) {
    const l = u.locale && (u.locale === "de" || u.locale === "en") ? u.locale : DEFAULT_LOCALE;
    try {
      await sendMail({ to: u.email, subject: translate(l, key === "err.call.msg.cancelled" ? "err.call.mail.cancelled" : "err.call.mail.updated"), text: translate(l, key, { text: renderCall(call, undefined, l) }) });
    } catch (e) {
      console.error("[schedule] Rundmail fehlgeschlagen", e);
    }
  }
}

function assertMail(mail: boolean) {
  if (mail && !mailEnabled()) throw new AppError("err.mail.smtp");
}

/** Bricht ab. War der Call schon gesendet, geht automatisch eine Absage in den Kanal (und optional per Mail). */
export async function cancelCall(db: PrismaClient, actor: Actor, id: number, opts: { mail?: boolean } = {}) {
  await requirePerm(db, actor, "schedule.manage");
  assertMail(!!opts.mail);
  const before = await db.allianceCall.findUnique({ where: { id } });
  const r = await db.allianceCall.updateMany({ where: { id, status: { in: ["scheduled", "draft", "sent"] } }, data: { status: "cancelled" } });
  if (r.count === 0 || !before) throw new ChatError("err.call.cannotCancel");
  await audit(db, actor.id, "call.cancel", `call:${id}`);
  if (before.status === "sent") await notifyChange(db, actor, before, "err.call.msg.cancelled", !!opts.mail);
}

export async function deleteCall(db: PrismaClient, actor: Actor, id: number) {
  await requirePerm(db, actor, "schedule.manage");
  await db.allianceCall.deleteMany({ where: { id, status: { in: ["cancelled", "sent"] } } });
}

export type CallEdit = { title?: string; coord?: string; at?: Date | null; eventAt?: Date | null; note?: string; mail?: boolean };

/** Ändert Ziel, Termin, Sendezeit, Titel oder Notiz. Ein bereits gesendeter Call meldet die Änderung automatisch im Kanal (optional zusätzlich per Rundmail). */
export async function updateCall(db: PrismaClient, actor: Actor, id: number, input: CallEdit) {
  await requirePerm(db, actor, "schedule.manage");
  assertMail(!!input.mail);
  const cur = await db.allianceCall.findUnique({ where: { id } });
  if (!cur || cur.status === "cancelled" || cur.status === "sending") throw new ChatError("err.call.cannotEdit");
  const sent = cur.status === "sent";
  let xy: [number, number] | null = cur.x !== null && cur.y !== null ? [cur.x, cur.y] : null;
  if (input.coord !== undefined) {
    xy = input.coord.trim() ? parseCoord(input.coord) : null;
    if (input.coord.trim() && !xy) throw new ChatError("err.call.coordFormat");
  }
  if ((cur.kind === "ATTACK" || cur.kind === "DEFF") && !xy) throw new ChatError("err.call.coordsRequired");
  const target = xy ? await resolveTarget(db, xy[0], xy[1]) : null;
  if (xy && !target) throw new ChatError("err.call.noVillage", { x: xy[0], y: xy[1] });
  const eventAt = input.eventAt !== undefined ? input.eventAt : cur.eventAt;
  const at = sent ? cur.at : input.at !== undefined ? input.at : cur.at;
  if (at && eventAt && at > eventAt) throw new ChatError("err.call.sendAfterEvent");
  const upd = await db.allianceCall.update({
    where: { id },
    data: {
      title: input.title !== undefined ? input.title.trim().slice(0, 80) : undefined, note: input.note !== undefined ? input.note.trim().slice(0, 500) : undefined,
      x: xy?.[0] ?? null, y: xy?.[1] ?? null, villageId: target?.villageId ?? null, villageName: target?.villageName ?? null, playerId: target?.playerId ?? null, playerName: target?.playerName ?? null,
      eventAt, at, status: sent ? "sent" : at ? "scheduled" : "draft",
    },
  });
  await audit(db, actor.id, "call.update", `call:${id}`, undefined, { eventAt, at, coord: xy });
  if (sent) await notifyChange(db, actor, upd, "err.call.msg.updated", !!input.mail);
  return upd;
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
