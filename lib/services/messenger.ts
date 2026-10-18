import type { PrismaClient } from "@prisma/client";
import { ForbiddenError, hasPermission, rank, type Permission } from "../permissions";
import { publishUser } from "../realtime";
import { audit, loadMatrix, userLocale, type Actor } from "./context";
import { ChatError } from "./chat";
import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import { env } from "../env";
import { storage } from "../storage";

export const MAX_DM = 4000;
export const MAX_SUBJECT = 100;

async function requirePerm(db: PrismaClient, actor: Actor, perm: Permission) {
  if (!hasPermission(actor.role, perm, await loadMatrix(db))) throw new ForbiddenError("err.perm.missing", { perm });
}

/** Wer ansprechbar ist: aktives Konto, kein Gast. */
const reachable = { banned: false, role: { not: "GUEST" } } as const;

export const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

// ───────── Direktnachrichten ─────────

export async function getOrCreateThread(db: PrismaClient, actor: Actor, otherId: string) {
  await requirePerm(db, actor, "messenger.use");
  if (otherId === actor.id) throw new ChatError("err.messenger.self");
  const other = await db.user.findFirst({ where: { id: otherId, ...reachable } });
  if (!other) throw new ChatError("err.messenger.recipientUnreachable");
  const key = pairKey(actor.id, otherId);
  const [a, b] = actor.id < otherId ? [actor.id, otherId] : [otherId, actor.id];
  return db.dmThread.upsert({ where: { pairKey: key }, create: { pairKey: key, userA: a, userB: b }, update: {} });
}

async function ownThread(db: PrismaClient, userId: string, threadId: number) {
  const t = await db.dmThread.findUnique({ where: { id: threadId } });
  if (!t || (t.userA !== userId && t.userB !== userId)) throw new ChatError("err.messenger.threadNotFound");
  return { thread: t, otherId: t.userA === userId ? t.userB : t.userA };
}

export async function sendDm(db: PrismaClient, actor: Actor, threadId: number, bodyRaw: string, attachmentIdsRaw: number[] = []) {
  await requirePerm(db, actor, "messenger.use");
  const { otherId } = await ownThread(db, actor.id, threadId);
  const body = bodyRaw.trim();
  const attachmentIds = [...new Set(attachmentIdsRaw)];
  if (!body && attachmentIds.length === 0) throw new ChatError("err.chat.empty");
  if (attachmentIds.length > env().UPLOAD_MAX_FILES) throw new ChatError("err.chat.maxFiles", { max: env().UPLOAD_MAX_FILES });
  if (attachmentIds.length > 0) {
    await requirePerm(db, actor, "chat.upload");
    const own = await db.attachment.count({ where: { id: { in: attachmentIds }, uploaderId: actor.id, messageId: null, dmMessageId: null } });
    if (own !== attachmentIds.length) throw new ChatError("err.chat.invalidAttachment");
  }
  if (body.length > MAX_DM) throw new ChatError("err.chat.tooLong", { max: MAX_DM });
  const other = await db.user.findFirst({ where: { id: otherId, ...reachable } });
  if (!other) throw new ChatError("err.messenger.recipientUnreachable");
  const m = await db.dmMessage.create({ data: { threadId, authorId: actor.id, body } });
  if (attachmentIds.length) await db.attachment.updateMany({ where: { id: { in: attachmentIds } }, data: { dmMessageId: m.id } });
  await db.dmRead.upsert({ where: { userId_threadId: { userId: actor.id, threadId } }, create: { userId: actor.id, threadId, lastReadMsgId: m.id }, update: { lastReadMsgId: m.id } });
  publishUser(otherId, "messenger:new", { threadId });
  publishUser(actor.id, "messenger:new", { threadId });
  return m;
}

export type ThreadView = { id: number; other: { id: string; name: string }; last: { body: string; at: Date; mine: boolean } | null; unread: number };

export async function listThreads(db: PrismaClient, userId: string): Promise<ThreadView[]> {
  const threads = await db.dmThread.findMany({ where: { OR: [{ userA: userId }, { userB: userId }] } });
  if (threads.length === 0) return [];
  const ids = threads.map((t) => t.id);
  const [reads, users, lasts] = await Promise.all([
    db.dmRead.findMany({ where: { userId, threadId: { in: ids } } }),
    db.user.findMany({ where: { id: { in: threads.map((t) => (t.userA === userId ? t.userB : t.userA)) } }, select: { id: true, name: true } }),
    db.dmMessage.findMany({ where: { threadId: { in: ids } }, orderBy: { id: "desc" }, distinct: ["threadId"] }),
  ]);
  const readMap = new Map(reads.map((r) => [r.threadId, r.lastReadMsgId]));
  const names = new Map(users.map((u) => [u.id, u.name]));
  const lastMap = new Map(lasts.map((m) => [m.threadId, m]));
  const unreadRows = await db.dmMessage.groupBy({ by: ["threadId"], where: { threadId: { in: ids }, authorId: { not: userId } }, _count: true, _max: { id: true } });
  const unread = new Map<number, number>();
  for (const u of unreadRows) {
    const lastRead = readMap.get(u.threadId) ?? 0;
    if ((u._max.id ?? 0) > lastRead) unread.set(u.threadId, await db.dmMessage.count({ where: { threadId: u.threadId, authorId: { not: userId }, id: { gt: lastRead } } }));
  }
  return threads
    .map((t) => {
      const oid = t.userA === userId ? t.userB : t.userA;
      const l = lastMap.get(t.id);
      return { id: t.id, other: { id: oid, name: names.get(oid) ?? translate(DEFAULT_LOCALE, "err.deletedUser") }, last: l ? { body: l.body, at: l.createdAt, mine: l.authorId === userId } : null, unread: unread.get(t.id) ?? 0 };
    })
    .filter((t) => t.last !== null)
    .sort((a, b) => b.last!.at.getTime() - a.last!.at.getTime());
}

export type DmAttachment = { id: number; kind: string; name: string; sizeBytes: number; hasThumb: boolean; removed: boolean };
export type DmView = { id: number; authorId: string; body: string; createdAt: Date; attachments: DmAttachment[] };

/** Nachrichten eines Threads (neueste zuletzt, max. `limit`); markiert den Thread als gelesen. */
export async function readThread(db: PrismaClient, userId: string, threadId: number, limit = 100): Promise<{ other: { id: string; name: string }; messages: DmView[] }> {
  const { otherId } = await ownThread(db, userId, threadId);
  const [rows, other] = await Promise.all([
    db.dmMessage.findMany({ where: { threadId }, orderBy: { id: "desc" }, take: limit, include: { attachments: { orderBy: { id: "asc" } } } }),
    db.user.findUnique({ where: { id: otherId }, select: { id: true, name: true } }),
  ]);
  const messages = rows.reverse();
  const last = messages[messages.length - 1]?.id ?? 0;
  await db.dmRead.upsert({ where: { userId_threadId: { userId, threadId } }, create: { userId, threadId, lastReadMsgId: last }, update: { lastReadMsgId: last } });
  return { other: other ?? { id: otherId, name: translate(DEFAULT_LOCALE, "err.deletedUser") }, messages: messages.map((m) => ({
    id: m.id, authorId: m.authorId, body: m.body, createdAt: m.createdAt,
    attachments: m.attachments.map((a) => ({ id: a.id, kind: a.kind, name: a.name, sizeBytes: a.sizeBytes, hasThumb: !!a.thumbKey && !a.removedAt, removed: a.removedAt !== null })),
  })) };
}

// ───────── Rundnachrichten ─────────

export type Audience = { type: "all" } | { type: "role"; role: "MEMBER" | "MODERATOR" | "ADMIN" } | { type: "taskforce"; taskforceId: number } | { type: "users"; userIds: string[] };

async function resolveAudience(db: PrismaClient, actor: Actor, a: Audience, locale: Locale): Promise<{ ids: string[]; label: string }> {
  let ids: string[] = [];
  let label = "";
  if (a.type === "all") {
    ids = (await db.user.findMany({ where: reachable, select: { id: true } })).map((u) => u.id);
    label = translate(locale, "err.audience.all");
  } else if (a.type === "role") {
    if (!["MEMBER", "MODERATOR", "ADMIN"].includes(a.role)) throw new ChatError("err.role.invalid");
    // „ab Rolle“: Moderator = Moderatoren und Admins
    ids = (await db.user.findMany({ where: { ...reachable, role: { in: (["MEMBER", "MODERATOR", "ADMIN"] as const).filter((r) => rank(r) >= rank(a.role)) } }, select: { id: true } })).map((u) => u.id);
    label = translate(locale, "err.audience.role", { role: a.role === "MEMBER" ? "Member" : a.role === "MODERATOR" ? "Moderator" : "Admin" });
  } else if (a.type === "taskforce") {
    const tf = await db.taskforce.findFirst({ where: { id: a.taskforceId, archivedAt: null }, include: { members: true } });
    if (!tf) throw new ChatError("err.chat.tfNotFound");
    const active = await db.user.findMany({ where: { id: { in: tf.members.map((m) => m.userId) }, ...reachable }, select: { id: true } });
    ids = active.map((u) => u.id);
    label = translate(locale, "err.audience.taskforce", { name: tf.name });
  } else {
    const want = [...new Set(a.userIds)];
    ids = (await db.user.findMany({ where: { id: { in: want }, ...reachable }, select: { id: true } })).map((u) => u.id);
    label = translate(locale, "err.audience.selection", { n: ids.filter((i) => i !== actor.id).length });
  }
  return { ids: ids.filter((i) => i !== actor.id), label };
}

export async function sendBroadcast(db: PrismaClient, actor: Actor, input: { subject: string; body: string; audience: Audience }) {
  await requirePerm(db, actor, "messenger.broadcast");
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (subject.length < 2 || subject.length > MAX_SUBJECT) throw new ChatError("err.messenger.subjectLength", { max: MAX_SUBJECT });
  if (!body) throw new ChatError("err.chat.empty");
  if (body.length > MAX_DM) throw new ChatError("err.chat.tooLong", { max: MAX_DM });
  const { ids, label } = await resolveAudience(db, actor, input.audience, await userLocale(db, actor.id));
  if (ids.length === 0) throw new ChatError("err.messenger.noRecipients");
  const b = await db.broadcast.create({ data: { senderId: actor.id, subject, body, audience: label, recipients: { create: ids.map((userId) => ({ userId })) } } });
  await audit(db, actor.id, "broadcast.send", `broadcast:${b.id}`, undefined, { audience: label, recipients: ids.length });
  for (const id of ids) publishUser(id, "messenger:new", { broadcastId: b.id });
  return { id: b.id, recipients: ids.length };
}

export type InboxItem = { id: number; subject: string; body: string; sender: { id: string; name: string }; createdAt: Date; read: boolean };

export async function listInbox(db: PrismaClient, userId: string, take = 50): Promise<InboxItem[]> {
  const rows = await db.broadcastRecipient.findMany({ where: { userId }, include: { broadcast: true }, orderBy: { broadcastId: "desc" }, take });
  const senders = await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.broadcast.senderId))] } }, select: { id: true, name: true } });
  const n = new Map(senders.map((u) => [u.id, u.name]));
  return rows.map((r) => ({ id: r.broadcastId, subject: r.broadcast.subject, body: r.broadcast.body, sender: { id: r.broadcast.senderId, name: n.get(r.broadcast.senderId) ?? translate(DEFAULT_LOCALE, "err.deletedUser") }, createdAt: r.broadcast.createdAt, read: r.readAt !== null }));
}

export async function markBroadcastRead(db: PrismaClient, userId: string, broadcastId: number) {
  await db.broadcastRecipient.updateMany({ where: { broadcastId, userId, readAt: null }, data: { readAt: new Date() } });
}

export async function listSent(db: PrismaClient, userId: string, take = 30) {
  const rows = await db.broadcast.findMany({ where: { senderId: userId }, orderBy: { id: "desc" }, take, include: { recipients: { select: { readAt: true } } } });
  return rows.map((b) => ({ id: b.id, subject: b.subject, audience: b.audience, createdAt: b.createdAt, recipients: b.recipients.length, read: b.recipients.filter((r) => r.readAt).length }));
}

// ───────── Ungelesen (Navigation) ─────────

export async function unreadCounts(db: PrismaClient, userId: string): Promise<{ dm: number; broadcast: number; total: number }> {
  const [threads, broadcast] = await Promise.all([listThreads(db, userId), db.broadcastRecipient.count({ where: { userId, readAt: null } })]);
  const dm = threads.reduce((s, t) => s + t.unread, 0);
  return { dm, broadcast, total: dm + broadcast };
}

/**
 * Obergrenze je Nutzer (Standard 10.000 eigene Direktnachrichten): Die ältesten darüber werden samt Anhängen gelöscht.
 * Speicherbedarf grob 0,5 KB je Nachricht in der Datenbank – 10.000 Nachrichten ≈ 5 MB.
 */
export async function capDirectMessages(db: PrismaClient, max = env().DM_MAX_PER_USER): Promise<number> {
  if (max <= 0) return 0;
  const heavy = await db.dmMessage.groupBy({ by: ["authorId"], _count: true, having: { authorId: { _count: { gt: max } } } });
  let removed = 0;
  for (const h of heavy) {
    const cut = await db.dmMessage.findFirst({ where: { authorId: h.authorId }, orderBy: { id: "desc" }, skip: max, select: { id: true } });
    if (!cut) continue;
    const old = { authorId: h.authorId, id: { lte: cut.id } };
    const atts = await db.attachment.findMany({ where: { dmMessage: old } });
    for (const a of atts) for (const key of [a.storageKey, a.thumbKey, a.previewKey]) if (key) await storage().delete(key);
    removed += (await db.dmMessage.deleteMany({ where: old })).count;
  }
  return removed;
}
