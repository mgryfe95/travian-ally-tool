import type { Prisma, PrismaClient } from "@prisma/client";
import { canDeleteMessage, canEditMessage, canManageTaskforce, canReadChannel, canWriteChannel, type ChatCtx } from "../chat/access";
import { env } from "../env";
import { effectiveRole, ForbiddenError, hasPermission, rank, ROLES, type Role } from "../permissions";
import { publish } from "../realtime";
import { storage } from "../storage";
import { audit, loadMatrix, type Actor } from "./context";
import { AppError } from "../i18n/errors";
import { DEFAULT_LOCALE, translate, type MessageKey, type Params } from "../i18n";

export class ChatError extends AppError {
  constructor(key: MessageKey, params?: Params, readonly status = 400) {
    super(key, params);
  }
}

export const MAX_BODY = 4000;
export const DEFAULT_CHANNELS = ["Deff-Call", "Deff-Reports", "Off-Call", "Off-Reports", "Ressources", "Settlement", "Sitter", "Mixed topics"];
export const DEFAULT_TAGS: [string, string][] = [["Dringend", "red"], ["Angriff", "amber"], ["Info", "blue"], ["Erledigt", "green"]];
export const DEFAULT_TAG_TYPE = "Kategorie";
export const TAG_COLORS = ["red", "amber", "blue", "green", "purple", "gray"] as const;

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "kanal";

export async function chatCtx(db: PrismaClient, actor: Actor): Promise<ChatCtx> {
  const [matrix, tfs] = await Promise.all([loadMatrix(db), db.taskforceMember.findMany({ where: { userId: actor.id }, select: { taskforceId: true, role: true } })]);
  return { userId: actor.id, role: actor.role, matrix, taskforceIds: new Set(tfs.map((t) => t.taskforceId)), taskforceRoles: new Map(tfs.map((t) => [t.taskforceId, t.role])) };
}

// ───────── Seed ─────────

/** Idempotent: legt Standard-Kanäle (Baum ALLY) und Tags nur an, wenn noch keine existieren. */
export async function seedChat(db: PrismaClient) {
  if ((await db.channel.count({ where: { tree: "ALLY" } })) === 0) {
    await db.channel.createMany({
      data: DEFAULT_CHANNELS.map((name, i) => ({ tree: "ALLY" as const, name, slug: slugify(name), sortOrder: i, minReadRole: name === "Mixed topics" ? "GUEST" : "MEMBER", minWriteRole: "MEMBER" })),
    });
  }
  const type = (await db.tagType.findFirst({ orderBy: { id: "asc" } })) ?? (await db.tagType.create({ data: { name: DEFAULT_TAG_TYPE } }));
  if ((await db.tag.count()) === 0) await db.tag.createMany({ data: DEFAULT_TAGS.map(([name, color]) => ({ name, color, tagTypeId: type.id })) });
  if ((await db.channelTagType.count()) === 0) {
    const chans = await db.channel.findMany({ where: { tree: "ALLY" }, select: { id: true } });
    await db.channelTagType.createMany({ data: chans.map((c) => ({ channelId: c.id, tagTypeId: type.id })), skipDuplicates: true });
  }
}

// ───────── Kanäle ─────────

export type ChannelView = {
  id: number;
  tree: "ALLY" | "TASKFORCE";
  name: string;
  taskforceId: number | null;
  memberCount?: number;
  unread: number;
  canWrite: boolean;
};

export async function listChannels(db: PrismaClient, ctx: ChatCtx): Promise<ChannelView[]> {
  const channels = await db.channel.findMany({ where: { archivedAt: null }, orderBy: [{ tree: "asc" }, { sortOrder: "asc" }, { id: "asc" }], include: { taskforce: { include: { _count: { select: { members: true } } } } } });
  const readable = channels.filter((c) => canReadChannel(c, ctx));
  const unread = await unreadCounts(db, ctx.userId, readable.map((c) => c.id));
  return readable.map((c) => ({
    id: c.id, tree: c.tree, name: c.name, taskforceId: c.taskforceId, memberCount: c.taskforce?._count.members,
    unread: unread.get(c.id) ?? 0, canWrite: canWriteChannel(c, ctx),
  }));
}

export async function unreadCounts(db: PrismaClient, userId: string, channelIds: number[]): Promise<Map<number, number>> {
  if (channelIds.length === 0) return new Map();
  const rows = await db.$queryRaw<{ channelId: number; n: bigint }[]>`
    SELECT m."channelId", COUNT(*) AS n
    FROM "Message" m
    LEFT JOIN "ChannelRead" r ON r."channelId" = m."channelId" AND r."userId" = ${userId}
    WHERE m."channelId" = ANY(${channelIds}) AND m."deletedAt" IS NULL AND m."authorId" <> ${userId} AND m."id" > COALESCE(r."lastReadMsgId", 0)
    GROUP BY m."channelId"`;
  return new Map(rows.map((r) => [r.channelId, Number(r.n)]));
}

export async function markRead(db: PrismaClient, ctx: ChatCtx, channelId: number) {
  const ch = await db.channel.findUnique({ where: { id: channelId } });
  if (!ch || !canReadChannel(ch, ctx)) throw new ForbiddenError("err.chat.noChannelAccess");
  const last = await db.message.findFirst({ where: { channelId }, orderBy: { id: "desc" }, select: { id: true } });
  if (!last) return;
  await db.channelRead.upsert({
    where: { userId_channelId: { userId: ctx.userId, channelId } },
    create: { userId: ctx.userId, channelId, lastReadMsgId: last.id },
    update: { lastReadMsgId: last.id },
  });
}

// ───────── Nachrichten ─────────

export type MessageView = {
  id: number;
  channelId: number;
  channelName: string;
  author: { id: string; name: string; role: Role };
  body: string;
  createdAt: string;
  editedAt: string | null;
  tags: { id: number; name: string; color: string; typeId: number; typeName: string }[];
  attachments: { id: number; kind: string; mime: string; name: string; sizeBytes: number; width: number | null; height: number | null; hasThumb: boolean; snippet: string | null; removed: boolean }[];
};

type MessageRow = Prisma.MessageGetPayload<{ include: { tags: { include: { tag: { include: { tagType: true } } } }; attachments: true; channel: { select: { name: true } } } }>;

async function toViews(db: PrismaClient, rows: MessageRow[]): Promise<MessageView[]> {
  const users = await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.authorId))] } }, select: { id: true, name: true, email: true, role: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((m) => {
    const u = byId.get(m.authorId);
    return {
      id: m.id, channelId: m.channelId, channelName: m.channel.name,
      author: { id: m.authorId, name: u?.name ?? translate(DEFAULT_LOCALE, "err.deletedUser"), role: u ? effectiveRole(u, env().SYSTEMADMIN_EMAILS) : "GUEST" },
      body: m.body, createdAt: m.createdAt.toISOString(), editedAt: m.editedAt?.toISOString() ?? null,
      tags: [...m.tags].sort((a, b) => a.tag.tagType.sortOrder - b.tag.tagType.sortOrder || a.tag.tagTypeId - b.tag.tagTypeId || a.tag.id - b.tag.id).map((t) => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color, typeId: t.tag.tagTypeId, typeName: t.tag.tagType.name })),
      attachments: m.attachments.map((a) => ({ id: a.id, kind: a.kind, mime: a.mime, name: a.name, sizeBytes: a.sizeBytes, width: a.width, height: a.height, hasThumb: !!a.thumbKey && !a.removedAt, snippet: a.snippet, removed: a.removedAt !== null })),
    };
  });
}

const INCLUDE = { tags: { include: { tag: { include: { tagType: true } } } }, attachments: { orderBy: { id: "asc" as const } }, channel: { select: { name: true } } };

async function loadView(db: PrismaClient, id: number) {
  const row = await db.message.findUnique({ where: { id }, include: INCLUDE });
  return row ? (await toViews(db, [row]))[0] : undefined;
}

/** Tags einer Nachricht prüfen: bekannt, Typ im Kanal angeboten, Einzelauswahl-Typen höchstens ein Tag, Pflicht-Typen belegt. */
async function validateTags(db: PrismaClient, ch: { id: number; tree: string }, tagIds: number[]) {
  const offered = await offeredTagTypes(db, ch);
  const tags = tagIds.length ? await db.tag.findMany({ where: { id: { in: tagIds } } }) : [];
  if (tags.length !== tagIds.length) throw new ChatError("err.chat.unknownTag");
  const byType = new Map<number, number>();
  for (const t of tags) {
    if (!offered.some((o) => o.id === t.tagTypeId)) throw new ChatError("err.chat.tagNotOffered");
    byType.set(t.tagTypeId, (byType.get(t.tagTypeId) ?? 0) + 1);
  }
  for (const o of offered) {
    const n = byType.get(o.id) ?? 0;
    if (!o.multi && n > 1) throw new ChatError("err.chat.tagSingle", { name: o.name });
    if (o.required && n === 0) throw new ChatError("err.chat.tagRequired", { name: o.name });
  }
}

/** Tag-Typen, die in diesem Kanal angeboten werden (zugewiesen; in Task-Force-Kanälen zusätzlich alle mit forTaskforces). */
export async function offeredTagTypes(db: PrismaClient, ch: { id: number; tree: string }) {
  return db.tagType.findMany({
    where: { OR: [{ channels: { some: { channelId: ch.id } } }, ...(ch.tree === "TASKFORCE" ? [{ forTaskforces: true }] : [])] },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

export type TagTypeView = { id: number; name: string; multi: boolean; required: boolean; forTaskforces: boolean; channelIds: number[]; tags: { id: number; name: string; color: string }[] };

export async function listTagTypes(db: PrismaClient): Promise<TagTypeView[]> {
  const types = await db.tagType.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { channels: true, tags: { orderBy: { id: "asc" } } } });
  return types.map((t) => ({
    id: t.id, name: t.name, multi: t.multi, required: t.required, forTaskforces: t.forTaskforces,
    channelIds: t.channels.map((c) => c.channelId), tags: t.tags.map((x) => ({ id: x.id, name: x.name, color: x.color })),
  }));
}

export async function postMessage(
  db: PrismaClient, ctx: ChatCtx, input: { channelId: number; body: string; tagIds?: number[]; attachmentIds?: number[] },
): Promise<MessageView> {
  const ch = await db.channel.findUnique({ where: { id: input.channelId } });
  if (!ch || !canWriteChannel(ch, ctx)) throw new ForbiddenError("err.chat.noWriteAccess");
  const body = input.body.trim();
  const attachmentIds = [...new Set(input.attachmentIds ?? [])];
  if (!body && attachmentIds.length === 0) throw new ChatError("err.chat.empty");
  if (body.length > MAX_BODY) throw new ChatError("err.chat.tooLong", { max: MAX_BODY });
  if (attachmentIds.length > env().UPLOAD_MAX_FILES) throw new ChatError("err.chat.maxFiles", { max: env().UPLOAD_MAX_FILES });
  if (attachmentIds.length > 0 && !hasPermission(ctx.role, "chat.upload", ctx.matrix)) throw new ForbiddenError("err.perm.missing", { perm: "chat.upload" });
  const tagIds = [...new Set(input.tagIds ?? [])];
  await validateTags(db, ch, tagIds);

  const id = await db.$transaction(async (tx) => {
    const own = attachmentIds.length ? await tx.attachment.findMany({ where: { id: { in: attachmentIds }, uploaderId: ctx.userId, messageId: null } }) : [];
    if (own.length !== attachmentIds.length) throw new ChatError("err.chat.invalidAttachment");
    const m = await tx.message.create({ data: { channelId: ch.id, authorId: ctx.userId, body, tags: { create: tagIds.map((tagId) => ({ tagId })) } } });
    if (attachmentIds.length) await tx.attachment.updateMany({ where: { id: { in: attachmentIds } }, data: { messageId: m.id } });
    await tx.channelRead.upsert({ where: { userId_channelId: { userId: ctx.userId, channelId: ch.id } }, create: { userId: ctx.userId, channelId: ch.id, lastReadMsgId: m.id }, update: { lastReadMsgId: m.id } });
    return m.id;
  });
  const view = (await loadView(db, id))!;
  publish(ch.id, "message:new", view);
  return view;
}

export async function editMessage(db: PrismaClient, ctx: ChatCtx, messageId: number, bodyRaw: string): Promise<MessageView> {
  const m = await db.message.findUnique({ where: { id: messageId }, include: { channel: true } });
  if (!m || m.deletedAt) throw new ChatError("err.chat.messageNotFound", undefined, 404);
  if (!canReadChannel(m.channel, ctx)) throw new ForbiddenError("err.noAccess");
  if (!canEditMessage(m.authorId, ctx)) throw new ForbiddenError("err.chat.onlyAuthorEdits");
  const body = bodyRaw.trim();
  if (!body || body.length > MAX_BODY) throw new ChatError("err.chat.invalidText");
  await db.message.update({ where: { id: messageId }, data: { body, editedAt: new Date() } });
  const view = (await loadView(db, messageId))!;
  publish(m.channelId, "message:edit", view);
  return view;
}

/** Löschen (Autor oder chat.moderate): Nachricht wird markiert, Anhänge werden samt Dateien entfernt. */
export async function deleteMessage(db: PrismaClient, ctx: ChatCtx, messageId: number) {
  const m = await db.message.findUnique({ where: { id: messageId }, include: { channel: true, attachments: true } });
  if (!m || m.deletedAt) throw new ChatError("err.chat.messageNotFound", undefined, 404);
  if (!canReadChannel(m.channel, ctx)) throw new ForbiddenError("err.noAccess");
  if (!canDeleteMessage(m.authorId, ctx)) throw new ForbiddenError("err.perm.missing", { perm: "chat.moderate" });
  await db.$transaction([db.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } }), db.attachment.deleteMany({ where: { messageId } })]);
  await Promise.all(m.attachments.flatMap((a) => [a.storageKey, a.thumbKey, a.previewKey].filter((k): k is string => !!k).map((k) => storage().delete(k))));
  if (m.authorId !== ctx.userId) await audit(db, ctx.userId, "message.moderate_delete", `message:${messageId}`, { channelId: m.channelId, authorId: m.authorId });
  publish(m.channelId, "message:delete", { id: messageId, channelId: m.channelId });
}

export type MessageQuery = { channelId: number | "all"; before?: number; limit?: number; tagId?: number; q?: string };

/** Nachrichten eines Kanals oder (Sammelraum) aller lesbaren Allianz-Kanäle; Cursor = `before` (Nachrichten-ID). */
export async function listMessages(db: PrismaClient, ctx: ChatCtx, query: MessageQuery): Promise<{ messages: MessageView[]; nextBefore: number | null }> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  let channelIds: number[];
  if (query.channelId === "all") {
    const all = await db.channel.findMany({ where: { tree: "ALLY", archivedAt: null } });
    channelIds = all.filter((c) => canReadChannel(c, ctx)).map((c) => c.id);
  } else {
    const ch = await db.channel.findUnique({ where: { id: query.channelId } });
    if (!ch || !canReadChannel(ch, ctx)) throw new ForbiddenError("err.chat.noChannelAccess");
    channelIds = [ch.id];
  }
  if (channelIds.length === 0) return { messages: [], nextBefore: null };

  const q = query.q?.trim();
  let idFilter: number[] | undefined;
  if (q) {
    const hits = await db.$queryRaw<{ id: number }[]>`
      SELECT "id" FROM "Message"
      WHERE "channelId" = ANY(${channelIds}) AND "deletedAt" IS NULL AND (${query.before ?? 2147483647}::int > "id")
        AND to_tsvector('german', "body") @@ plainto_tsquery('german', ${q})
      ORDER BY "id" DESC LIMIT ${limit + 1}`;
    idFilter = hits.map((h) => h.id);
  }
  const rows = await db.message.findMany({
    where: {
      channelId: { in: channelIds }, deletedAt: null,
      ...(query.before ? { id: { lt: query.before } } : {}),
      ...(query.tagId ? { tags: { some: { tagId: query.tagId } } } : {}),
      ...(idFilter ? { id: { in: idFilter } } : {}),
    },
    orderBy: { id: "desc" }, take: limit + 1, include: INCLUDE,
  });
  const page = rows.slice(0, limit);
  const views = await toViews(db, page);
  return { messages: views.reverse(), nextBefore: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null };
}

// ───────── Task-Forces ─────────

export type TfRole = "founder" | "lead" | "member" | "reader";

/** Legt Task-Force + Kanal an. Der Ersteller ist Gründer; `memberIds` bekommen eine Einladung (Annahme nötig). */
export async function createTaskforce(db: PrismaClient, ctx: ChatCtx, input: { name: string; description?: string; memberIds?: string[] }) {
  if (!hasPermission(ctx.role, "taskforce.create", ctx.matrix)) throw new ForbiddenError("err.perm.missing", { perm: "taskforce.create" });
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) throw new ChatError("err.chat.nameLength", { min: 2, max: 60 });
  const memberIds = [...new Set((input.memberIds ?? []).filter((id) => id !== ctx.userId))];
  const valid = memberIds.length ? await db.user.findMany({ where: { id: { in: memberIds }, banned: false, role: { not: "GUEST" } }, select: { id: true } }) : [];
  const tf = await db.$transaction(async (tx) => {
    const t = await tx.taskforce.create({
      data: { name, description: input.description?.trim() ?? "", createdBy: ctx.userId, members: { create: [{ userId: ctx.userId, role: "founder" }] }, invites: { create: valid.map((u) => ({ userId: u.id, invitedBy: ctx.userId, role: "member" })) } },
    });
    await tx.channel.create({ data: { tree: "TASKFORCE", name, slug: `tf-${t.id}`, taskforceId: t.id, sortOrder: t.id } });
    return t;
  });
  await audit(db, ctx.userId, "taskforce.create", `taskforce:${tf.id}`, undefined, { name });
  return tf;
}

const isAdminish = (ctx: ChatCtx) => rank(ctx.role) >= rank("ADMIN");

async function myRole(db: PrismaClient, ctx: ChatCtx, taskforceId: number) {
  return (await db.taskforceMember.findUnique({ where: { taskforceId_userId: { taskforceId, userId: ctx.userId } } }))?.role ?? null;
}

/** Einladen/Entfernen: Gründer, Lead, Admin. */
async function requireManage(db: PrismaClient, ctx: ChatCtx, taskforceId: number) {
  const r = await myRole(db, ctx, taskforceId);
  if (!canManageTaskforce(ctx, r === "founder" || r === "lead")) throw new ForbiddenError("err.chat.tfManageOnly");
  return r;
}

/** Rollen vergeben: nur der Gründer (und Admins als Notausgang). */
async function requireFounder(db: PrismaClient, ctx: ChatCtx, taskforceId: number) {
  if ((await myRole(db, ctx, taskforceId)) !== "founder" && !isAdminish(ctx)) throw new ForbiddenError("err.chat.tfRolesFounder");
}

/** Direktes Hinzufügen (ohne Annahme) – für Admins/Gründer/Leads; im UI läuft der Normalfall über Einladungen. */
export async function addTaskforceMember(db: PrismaClient, ctx: ChatCtx, taskforceId: number, userId: string, role: "lead" | "member" | "reader" = "member") {
  await requireManage(db, ctx, taskforceId);
  if (role === "lead") await requireFounder(db, ctx, taskforceId);
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u || u.banned || u.role === "GUEST") throw new ChatError("err.chat.userCannotAdd");
  const existing = await db.taskforceMember.findUnique({ where: { taskforceId_userId: { taskforceId, userId } } });
  if (existing?.role === "founder") throw new ChatError("err.chat.founderRoleLocked");
  await db.taskforceMember.upsert({ where: { taskforceId_userId: { taskforceId, userId } }, create: { taskforceId, userId, role }, update: { role } });
  await audit(db, ctx.userId, "taskforce.member_add", `taskforce:${taskforceId}`, undefined, { userId, role });
}

export async function inviteToTaskforce(db: PrismaClient, ctx: ChatCtx, taskforceId: number, userId: string, role: "lead" | "member" | "reader" = "member") {
  await requireManage(db, ctx, taskforceId);
  if (role === "lead") await requireFounder(db, ctx, taskforceId);
  const tf = await db.taskforce.findUnique({ where: { id: taskforceId } });
  if (!tf || tf.archivedAt) throw new ChatError("err.chat.tfNotFound");
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u || u.banned || u.role === "GUEST") throw new ChatError("err.chat.userCannotInvite");
  if (await db.taskforceMember.findUnique({ where: { taskforceId_userId: { taskforceId, userId } } })) throw new ChatError("err.chat.alreadyMember");
  const open = await db.taskforceInvite.findFirst({ where: { taskforceId, userId, status: "pending" } });
  const inv = open
    ? await db.taskforceInvite.update({ where: { id: open.id }, data: { role, invitedBy: ctx.userId } })
    : await db.taskforceInvite.create({ data: { taskforceId, userId, invitedBy: ctx.userId, role } });
  await audit(db, ctx.userId, "taskforce.invite", `taskforce:${taskforceId}`, undefined, { userId, role });
  return inv;
}

export async function revokeTaskforceInvite(db: PrismaClient, ctx: ChatCtx, inviteId: number) {
  const inv = await db.taskforceInvite.findUnique({ where: { id: inviteId } });
  if (!inv) throw new ChatError("err.chat.inviteNotFound");
  await requireManage(db, ctx, inv.taskforceId);
  await db.taskforceInvite.updateMany({ where: { id: inviteId, status: "pending" }, data: { status: "revoked", answeredAt: new Date() } });
}

export async function listMyTaskforceInvites(db: PrismaClient, userId: string) {
  const rows = await db.taskforceInvite.findMany({ where: { userId, status: "pending", taskforce: { archivedAt: null } }, include: { taskforce: { select: { id: true, name: true, description: true } } }, orderBy: { id: "desc" } });
  const inviters = await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.invitedBy))] } }, select: { id: true, name: true } });
  const n = new Map(inviters.map((u) => [u.id, u.name]));
  return rows.map((r) => ({ id: r.id, role: r.role as TfRole, taskforce: r.taskforce, invitedBy: n.get(r.invitedBy) ?? "?" }));
}

/** Eingeladener nimmt an (→ Mitglied mit der eingeladenen Rolle) oder lehnt ab. */
export async function respondTaskforceInvite(db: PrismaClient, ctx: ChatCtx, inviteId: number, accept: boolean) {
  const inv = await db.taskforceInvite.findUnique({ where: { id: inviteId } });
  if (!inv || inv.userId !== ctx.userId || inv.status !== "pending") throw new ChatError("err.chat.inviteNotFound");
  const claimed = await db.taskforceInvite.updateMany({ where: { id: inviteId, status: "pending" }, data: { status: accept ? "accepted" : "declined", answeredAt: new Date() } });
  if (claimed.count === 0) throw new ChatError("err.chat.inviteNotFound");
  if (!accept) return null;
  const tf = await db.taskforce.findUnique({ where: { id: inv.taskforceId }, include: { channel: true } });
  if (!tf || tf.archivedAt) throw new ChatError("err.chat.tfGone");
  await db.taskforceMember.upsert({ where: { taskforceId_userId: { taskforceId: inv.taskforceId, userId: ctx.userId } }, create: { taskforceId: inv.taskforceId, userId: ctx.userId, role: inv.role }, update: {} });
  await audit(db, ctx.userId, "taskforce.join", `taskforce:${inv.taskforceId}`, undefined, { role: inv.role });
  return tf.channel?.id ?? null;
}

/** Rolle ändern (lead | member | reader): nur Gründer. Die Gründer-Rolle ist fest. */
export async function setTaskforceRole(db: PrismaClient, ctx: ChatCtx, taskforceId: number, userId: string, role: "lead" | "member" | "reader") {
  await requireFounder(db, ctx, taskforceId);
  if (!["lead", "member", "reader"].includes(role)) throw new ChatError("err.role.invalid");
  const target = await db.taskforceMember.findUnique({ where: { taskforceId_userId: { taskforceId, userId } } });
  if (!target) throw new ChatError("err.chat.notMember");
  if (target.role === "founder") throw new ChatError("err.chat.founderRoleLocked");
  await db.taskforceMember.update({ where: { taskforceId_userId: { taskforceId, userId } }, data: { role } });
  await audit(db, ctx.userId, "taskforce.role", `taskforce:${taskforceId}`, { userId, role: target.role }, { role });
}

/** Entfernen: Gründer/Admin alle außer dem Gründer, Leads nur Mitglieder und Leser, jeder sich selbst (Verlassen) – außer der Gründer. */
export async function removeTaskforceMember(db: PrismaClient, ctx: ChatCtx, taskforceId: number, userId: string) {
  const target = await db.taskforceMember.findUnique({ where: { taskforceId_userId: { taskforceId, userId } } });
  if (!target) return;
  if (target.role === "founder") throw new ChatError("err.chat.founderCannotRemove");
  if (userId !== ctx.userId) {
    const r = await requireManage(db, ctx, taskforceId);
    if (r === "lead" && target.role === "lead" && !isAdminish(ctx)) throw new ForbiddenError("err.chat.leadsCannotRemoveLeads");
  }
  await db.taskforceMember.deleteMany({ where: { taskforceId, userId } });
  await audit(db, ctx.userId, "taskforce.member_remove", `taskforce:${taskforceId}`, { userId });
}

export async function archiveTaskforce(db: PrismaClient, ctx: ChatCtx, taskforceId: number) {
  await requireFounder(db, ctx, taskforceId);
  const now = new Date();
  await db.$transaction([db.taskforce.update({ where: { id: taskforceId }, data: { archivedAt: now } }), db.channel.updateMany({ where: { taskforceId }, data: { archivedAt: now } })]);
  await audit(db, ctx.userId, "taskforce.archive", `taskforce:${taskforceId}`);
}

// ───────── Kanäle & Tags verwalten (Admin) ─────────

function requireSettings(ctx: ChatCtx) {
  if (!hasPermission(ctx.role, "settings.edit", ctx.matrix)) throw new ForbiddenError("err.perm.missing", { perm: "settings.edit" });
}
const checkRole = (r: string) => {
  if (!(ROLES as readonly string[]).includes(r)) throw new ChatError("err.role.invalid");
};

export async function createChannel(db: PrismaClient, ctx: ChatCtx, input: { name: string; minReadRole?: string; minWriteRole?: string }) {
  requireSettings(ctx);
  const name = input.name.trim();
  if (name.length < 2 || name.length > 40) throw new ChatError("err.chat.nameLength", { min: 2, max: 40 });
  const minRead = input.minReadRole ?? "MEMBER";
  const minWrite = input.minWriteRole ?? "MEMBER";
  checkRole(minRead);
  checkRole(minWrite);
  let slug = slugify(name);
  if (await db.channel.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const max = await db.channel.aggregate({ where: { tree: "ALLY" }, _max: { sortOrder: true } });
  const ch = await db.channel.create({ data: { tree: "ALLY", name, slug, sortOrder: (max._max.sortOrder ?? -1) + 1, minReadRole: minRead, minWriteRole: minWrite } });
  await audit(db, ctx.userId, "channel.create", `channel:${ch.id}`, undefined, { name });
  return ch;
}

export async function updateChannel(db: PrismaClient, ctx: ChatCtx, id: number, patch: { name?: string; minReadRole?: string; minWriteRole?: string; archived?: boolean }) {
  requireSettings(ctx);
  const ch = await db.channel.findUnique({ where: { id } });
  if (!ch || ch.tree !== "ALLY") throw new ChatError("err.chat.channelNotFound", undefined, 404);
  const data: Prisma.ChannelUpdateInput = {};
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (n.length < 2 || n.length > 40) throw new ChatError("err.chat.nameLength", { min: 2, max: 40 });
    data.name = n;
  }
  if (patch.minReadRole) {
    checkRole(patch.minReadRole);
    data.minReadRole = patch.minReadRole;
  }
  if (patch.minWriteRole) {
    checkRole(patch.minWriteRole);
    data.minWriteRole = patch.minWriteRole;
  }
  if (patch.archived !== undefined) data.archivedAt = patch.archived ? new Date() : null;
  await db.channel.update({ where: { id }, data });
  await audit(db, ctx.userId, "channel.update", `channel:${id}`, { name: ch.name, minReadRole: ch.minReadRole, minWriteRole: ch.minWriteRole, archived: !!ch.archivedAt }, patch);
}

/** Verschiebt einen Kanal um eine Position nach oben (-1) oder unten (+1). */
export async function moveChannel(db: PrismaClient, ctx: ChatCtx, id: number, dir: -1 | 1) {
  requireSettings(ctx);
  const list = await db.channel.findMany({ where: { tree: "ALLY", archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  const i = list.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const reordered = [...list];
  [reordered[i], reordered[j]] = [reordered[j]!, reordered[i]!];
  await db.$transaction(reordered.map((c, idx) => db.channel.update({ where: { id: c.id }, data: { sortOrder: idx } })));
}

function requireTags(ctx: ChatCtx) {
  if (!hasPermission(ctx.role, "tags.manage", ctx.matrix)) throw new ForbiddenError("err.perm.missing", { perm: "tags.manage" });
}

export async function saveTag(db: PrismaClient, ctx: ChatCtx, input: { id?: number; tagTypeId?: number; name: string; color: string }) {
  requireTags(ctx);
  const name = input.name.trim();
  if (name.length < 2 || name.length > 24) throw new ChatError("err.chat.nameLength", { min: 2, max: 24 });
  if (!(TAG_COLORS as readonly string[]).includes(input.color)) throw new ChatError("err.chat.invalidColor");
  try {
    if (input.id) return await db.tag.update({ where: { id: input.id }, data: { name, color: input.color } });
    if (!input.tagTypeId || !(await db.tagType.findUnique({ where: { id: input.tagTypeId } }))) throw new ChatError("err.chat.tagTypeMissing");
    return await db.tag.create({ data: { tagTypeId: input.tagTypeId, name, color: input.color, createdBy: ctx.userId } });
  } catch (e) {
    if (e instanceof ChatError) throw e;
    throw new ChatError("err.chat.tagExists");
  }
}

export async function deleteTag(db: PrismaClient, ctx: ChatCtx, id: number) {
  requireTags(ctx);
  await db.tag.deleteMany({ where: { id } });
}

export async function saveTagType(
  db: PrismaClient, ctx: ChatCtx, input: { id?: number; name: string; multi: boolean; required: boolean; forTaskforces: boolean; channelIds: number[] },
) {
  requireTags(ctx);
  const name = input.name.trim();
  if (name.length < 2 || name.length > 24) throw new ChatError("err.chat.nameLength", { min: 2, max: 24 });
  const channelIds = [...new Set(input.channelIds)];
  if (channelIds.length && (await db.channel.count({ where: { id: { in: channelIds }, tree: "ALLY" } })) !== channelIds.length) throw new ChatError("err.chat.unknownChannel");
  const data = { name, multi: input.multi, required: input.required, forTaskforces: input.forTaskforces };
  try {
    return await db.$transaction(async (tx) => {
      const t = input.id ? await tx.tagType.update({ where: { id: input.id }, data }) : await tx.tagType.create({ data });
      await tx.channelTagType.deleteMany({ where: { tagTypeId: t.id } });
      await tx.channelTagType.createMany({ data: channelIds.map((channelId) => ({ channelId, tagTypeId: t.id })) });
      return t;
    });
  } catch {
    throw new ChatError("err.chat.tagTypeExists");
  }
}

export async function deleteTagType(db: PrismaClient, ctx: ChatCtx, id: number) {
  requireTags(ctx);
  if ((await db.tag.count({ where: { tagTypeId: id } })) > 0) throw new ChatError("err.chat.deleteTagsFirst");
  await db.tagType.deleteMany({ where: { id } });
}
