import type { PrismaClient } from "@prisma/client";
import { canReadChannel } from "../chat/access";
import { env } from "../env";
import { DEFAULT_LOCALE, isLocale, translate, type Locale } from "../i18n";
import { effectiveRole } from "../permissions";
import { channelKey, effective, GENERAL_KEYS, isNotifyKey, preview, type GeneralKey } from "../notify/prefs";
import { pushEnabled, pushToUsers } from "../notify/push";
import { chatCtx } from "./chat";

const loc = (l: string | null | undefined): Locale => (isLocale(l) ? l : DEFAULT_LOCALE);

async function savedPrefs(db: PrismaClient, userIds: string[]): Promise<Map<string, Map<string, boolean>>> {
  const rows = await db.notifyPref.findMany({ where: { userId: { in: userIds } } });
  const out = new Map<string, Map<string, boolean>>();
  for (const r of rows) {
    if (!out.has(r.userId)) out.set(r.userId, new Map());
    out.get(r.userId)!.set(r.key, r.on);
  }
  return out;
}

/** Nur Nutzer mit mindestens einem Gerät, nicht gesperrt. */
async function subscribedUsers(db: PrismaClient, onlyIds?: string[]) {
  const subs = await db.pushSubscription.findMany({ where: onlyIds ? { userId: { in: onlyIds } } : {}, select: { userId: true }, distinct: ["userId"] });
  if (!subs.length) return [];
  return db.user.findMany({ where: { id: { in: subs.map((s) => s.userId) }, banned: false }, select: { id: true, email: true, role: true, locale: true } });
}

/**
 * Neue Kanalnachricht → Push an alle, die den Kanal lesen dürfen und ihn eingeschaltet haben,
 * an Erwähnte (Schlüssel `mention`) und bei System-Calls „Angriff melden“ an alle mit `alert`.
 */
export async function notifyChannelMessage(db: PrismaClient, input: { channelId: number; messageId: number; authorId: string; body: string; alert?: boolean }): Promise<number> {
  if (!pushEnabled()) return 0;
  const ch = await db.channel.findUnique({ where: { id: input.channelId }, include: { taskforce: { select: { name: true } } } });
  if (!ch) return 0;
  const users = (await subscribedUsers(db)).filter((u) => u.id !== input.authorId);
  if (!users.length) return 0;
  const [prefs, mentioned, author] = await Promise.all([
    savedPrefs(db, users.map((u) => u.id)),
    db.mention.findMany({ where: { messageId: input.messageId }, select: { userId: true } }).then((r) => new Set(r.map((m) => m.userId))),
    db.user.findUnique({ where: { id: input.authorId }, select: { name: true } }),
  ]);
  const name = author?.name ?? "?";
  const channel = ch.tree === "TASKFORCE" && ch.taskforce ? ch.taskforce.name : ch.name;
  const targets = new Map<string, { title: string }>();
  for (const u of users) {
    const ctx = await chatCtx(db, { id: u.id, role: effectiveRole(u, env().SYSTEMADMIN_EMAILS) });
    if (!canReadChannel(ch, ctx)) continue;
    const saved = prefs.get(u.id) ?? new Map<string, boolean>();
    const l = loc(u.locale);
    if (input.alert && effective(saved, "alert")) targets.set(u.id, { title: translate(l, "push.alert.title") });
    else if (mentioned.has(u.id) && effective(saved, "mention")) targets.set(u.id, { title: translate(l, "push.mention.title", { name, channel }) });
    else if (effective(saved, channelKey(ch.id), ch.tree)) targets.set(u.id, { title: translate(l, "push.channel.title", { name, channel }) });
  }
  const body = preview(input.body);
  return pushToUsers(db, [...targets.keys()], (uid) => ({ title: targets.get(uid)!.title, body, url: `/chat?c=${ch.id}&m=${input.messageId}`, tag: `ch-${ch.id}` }));
}

/** Persönliche Benachrichtigung (Direktnachricht, Rundnachricht) unter Beachtung des Schlüssels. */
export async function notifyUsers(db: PrismaClient, userIds: string[], key: GeneralKey, make: (locale: Locale) => { title: string; body: string; url: string; tag?: string }): Promise<number> {
  if (!pushEnabled() || !userIds.length) return 0;
  const users = await subscribedUsers(db, userIds);
  const prefs = await savedPrefs(db, users.map((u) => u.id));
  const on = users.filter((u) => effective(prefs.get(u.id) ?? new Map(), key));
  const byId = new Map(on.map((u) => [u.id, loc(u.locale)]));
  return pushToUsers(db, on.map((u) => u.id), (uid) => make(byId.get(uid)!));
}

/** Fehler beim Push dürfen den eigentlichen Vorgang nie stören. */
export function fireAndForget(p: Promise<unknown>, what: string) {
  p.catch((e) => console.error(`[push] ${what} fehlgeschlagen`, e));
}

// ───────── Einstellungen ─────────

export type PrefRow = { key: string; label: string; on: boolean };
export type NotifySettings = { general: PrefRow[]; channels: PrefRow[]; taskforces: PrefRow[]; devices: number };

export async function getNotifySettings(db: PrismaClient, actor: { id: string; role: Parameters<typeof chatCtx>[1]["role"] }): Promise<NotifySettings> {
  const saved = (await savedPrefs(db, [actor.id])).get(actor.id) ?? new Map<string, boolean>();
  const ctx = await chatCtx(db, actor);
  const channels = await db.channel.findMany({ where: { archivedAt: null }, orderBy: [{ tree: "asc" }, { sortOrder: "asc" }, { id: "asc" }], include: { taskforce: { select: { name: true } } } });
  const readable = channels.filter((c) => canReadChannel(c, ctx));
  const row = (c: (typeof readable)[number]): PrefRow => ({ key: channelKey(c.id), label: c.tree === "TASKFORCE" && c.taskforce ? c.taskforce.name : c.name, on: effective(saved, channelKey(c.id), c.tree) });
  return {
    general: GENERAL_KEYS.map((k) => ({ key: k, label: k, on: effective(saved, k) })),
    channels: readable.filter((c) => c.tree === "ALLY").map(row),
    taskforces: readable.filter((c) => c.tree === "TASKFORCE" && (c.taskforceId === null || ctx.taskforceIds.has(c.taskforceId))).map(row),
    devices: await db.pushSubscription.count({ where: { userId: actor.id } }),
  };
}

/** Speichert die komplette Auswahl (Schlüssel, die nicht im Set `on` sind, werden ausgeschaltet). Nur bekannte Schlüssel. */
export async function saveNotifySettings(db: PrismaClient, userId: string, keys: string[], on: ReadonlySet<string>) {
  const valid = [...new Set(keys)].filter(isNotifyKey).slice(0, 500);
  await db.$transaction(valid.map((key) => db.notifyPref.upsert({ where: { userId_key: { userId, key } }, create: { userId, key, on: on.has(key) }, update: { on: on.has(key) } })));
}

export async function saveSubscription(db: PrismaClient, userId: string, sub: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) {
  if (!/^https:\/\//.test(sub.endpoint) || sub.endpoint.length > 1000 || !sub.p256dh || !sub.auth || sub.p256dh.length > 200 || sub.auth.length > 100) throw new Error("invalid subscription");
  const data = { userId, p256dh: sub.p256dh, auth: sub.auth, userAgent: (sub.userAgent ?? "").slice(0, 200) };
  await db.pushSubscription.upsert({ where: { endpoint: sub.endpoint }, create: { endpoint: sub.endpoint, ...data }, update: data });
  // höchstens 10 Geräte je Nutzer: älteste fliegen raus
  const all = await db.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (all.length > 10) await db.pushSubscription.deleteMany({ where: { id: { in: all.slice(10).map((s) => s.id) } } });
}

export async function deleteSubscription(db: PrismaClient, userId: string, endpoint: string) {
  await db.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export async function sendTestPush(db: PrismaClient, userId: string, locale: Locale) {
  return pushToUsers(db, [userId], { title: translate(locale, "push.test.title"), body: translate(locale, "push.test.body"), url: "/app", tag: "test" });
}
