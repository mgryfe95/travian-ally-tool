import type { Prisma, PrismaClient } from "@prisma/client";
import { canDeleteMessage, canEditMessage, canManageTaskforce, canReadChannel, canWriteChannel, type ChatCtx } from "../chat/access";
import { env } from "../env";
import { effectiveRole, ForbiddenError, hasPermission, ROLES, type Role } from "../permissions";
import { publish } from "../realtime";
import { storage } from "../storage";
import { audit, loadMatrix, type Actor } from "./context";

export class ChatError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export const MAX_BODY = 4000;
export const DEFAULT_CHANNELS = ["Deff-Call", "Deff-Reports", "Off-Call", "Off-Reports", "Ressources", "Settlement", "Sitter", "Mixed topics"];
export const DEFAULT_TAGS: [string, string][] = [["Dringend", "red"], ["Angriff", "amber"], ["Info", "blue"], ["Erledigt", "green"]];
export const TAG_COLORS = ["red", "amber", "blue", "green", "purple", "gray"] as const;

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "kanal";

export async function chatCtx(db: PrismaClient, actor: Actor): Promise<ChatCtx> {
  const [matrix, tfs] = await Promise.all([loadMatrix(db), db.taskforceMember.findMany({ where: { userId: actor.id }, select: { taskforceId: true } })]);
  return { userId: actor.id, role: actor.role, matrix, taskforceIds: new Set(tfs.map((t) => t.taskforceId)) };
}

// ───────── Seed ─────────

/** Idempotent: legt Standard-Kanäle (Baum ALLY) und Tags nur an, wenn noch keine existieren. */
export async function seedChat(db: PrismaClient) {
  if ((await db.channel.count({ where: { tree: "ALLY" } })) === 0) {
    await db.channel.createMany({
      data: DEFAULT_CHANNELS.map((name, i) => ({ tree: "ALLY" as const, name, slug: slugify(name), sortOrder: i, minReadRole: name === "Mixed topics" ? "GUEST" : "MEMBER", minWriteRole: "MEMBER" })),
    });
  }
  if ((await db.tag.count()) === 0) await db.tag.createMany({ data: DEFAULT_TAGS.map(([name, color]) => ({ name, color })) });
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
  if (!ch || !canReadChannel(ch, ctx)) throw new ForbiddenError("Kein Zugriff auf diesen Kanal");
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
  tags: { id: number; name: string; color: string }[];
  attachments: { id: number; kind: string; mime: string; name: string; sizeBytes: number; width: number | null; height: number | null; hasThumb: boolean; snippet: string | null }[];
};

type MessageRow = Prisma.MessageGetPayload<{ include: { tags: { include: { tag: true } }; attachments: true; channel: { select: { name: true } } } }>;

async function toViews(db: PrismaClient, rows: MessageRow[]): Promise<MessageView[]> {
  const users = await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.authorId))] } }, select: { id: true, name: true, email: true, role: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((m) => {
    const u = byId.get(m.authorId);
    return {
      id: m.id, channelId: m.channelId, channelName: m.channel.name,
      author: { id: m.authorId, name: u?.name ?? "gelöscht", role: u ? effectiveRole(u, env().SYSTEMADMIN_EMAILS) : "GUEST" },
      body: m.body, createdAt: m.createdAt.toISOString(), editedAt: m.editedAt?.toISOString() ?? null,
      tags: m.tags.map((t) => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color })),
      attachments: m.attachments.map((a) => ({ id: a.id, kind: a.kind, mime: a.mime, name: a.name, sizeBytes: a.sizeBytes, width: a.width, height: a.height, hasThumb: !!a.thumbKey, snippet: a.snippet })),
    };
  });
}

const INCLUDE = { tags: { include: { tag: true } }, attachments: { orderBy: { id: "asc" as const } }, channel: { select: { name: true } } };

async function loadView(db: PrismaClient, id: number) {
  const row = await db.message.findUnique({ where: { id }, include: INCLUDE });
  return row ? (await toViews(db, [row]))[0] : undefined;
}

export async function postMessage(
  db: PrismaClient, ctx: ChatCtx, input: { channelId: number; body: string; tagIds?: number[]; attachmentIds?: number[] },
): Promise<MessageView> {
  const ch = await db.channel.findUnique({ where: { id: input.channelId } });
  if (!ch || !canWriteChannel(ch, ctx)) throw new ForbiddenError("Kein Schreibrecht in diesem Kanal");
  const body = input.body.trim();
  const attachmentIds = [...new Set(input.attachmentIds ?? [])];
  if (!body && attachmentIds.length === 0) throw new ChatError("Nachricht ist leer");
  if (body.length > MAX_BODY) throw new ChatError(`Nachricht zu lang (max. ${MAX_BODY} Zeichen)`);
  if (attachmentIds.length > env().UPLOAD_MAX_FILES) throw new ChatError(`Maximal ${env().UPLOAD_MAX_FILES} Dateien pro Nachricht`);
  if (attachmentIds.length > 0 && !hasPermission(ctx.role, "chat.upload", ctx.matrix)) throw new ForbiddenError("Fehlendes Recht chat.upload");
  const tagIds = [...new Set(input.tagIds ?? [])];
  if (tagIds.length > 0 && (await db.tag.count({ where: { id: { in: tagIds } } })) !== tagIds.length) throw new ChatError("Unbekannter Tag");

  const id = await db.$transaction(async (tx) => {
    const own = attachmentIds.length ? await tx.attachment.findMany({ where: { id: { in: attachmentIds }, uploaderId: ctx.userId, messageId: null } }) : [];
    if (own.length !== attachmentIds.length) throw new ChatError("Ungültiger Anhang");
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
  if (!m || m.deletedAt) throw new ChatError("Nachricht nicht gefunden", 404);
  if (!canReadChannel(m.channel, ctx)) throw new ForbiddenError("Kein Zugriff");
  if (!canEditMessage(m.authorId, ctx)) throw new ForbiddenError("Nur der Autor kann bearbeiten");
  const body = bodyRaw.trim();
  if (!body || body.length > MAX_BODY) throw new ChatError("Ungültiger Text");
  await db.message.update({ where: { id: messageId }, data: { body, editedAt: new Date() } });
  const view = (await loadView(db, messageId))!;
  publish(m.channelId, "message:edit", view);
  return view;
}

/** Löschen (Autor oder chat.moderate): Nachricht wird markiert, Anhänge werden samt Dateien entfernt. */
export async function deleteMessage(db: PrismaClient, ctx: ChatCtx, messageId: number) {
  const m = await db.message.findUnique({ where: { id: messageId }, include: { channel: true, attachments: true } });
  if (!m || m.deletedAt) throw new ChatError("Nachricht nicht gefunden", 404);
  if (!canReadChannel(m.channel, ctx)) throw new ForbiddenError("Kein Zugriff");
  if (!canDeleteMessage(m.authorId, ctx)) throw new ForbiddenError("Fehlendes Recht chat.moderate");
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
    if (!ch || !canReadChannel(ch, ctx)) throw new ForbiddenError("Kein Zugriff auf diesen Kanal");
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

export async function createTaskforce(db: PrismaClient, ctx: ChatCtx, input: { name: string; description?: string; memberIds?: string[] }) {
  if (!hasPermission(ctx.role, "taskforce.create", ctx.matrix)) throw new ForbiddenError("Fehlendes Recht taskforce.create");
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) throw new ChatError("Name: 2–60 Zeichen");
  const memberIds = [...new Set((input.memberIds ?? []).filter((id) => id !== ctx.userId))];
  const valid = memberIds.length ? await db.user.findMany({ where: { id: { in: memberIds }, banned: false, role: { not: "GUEST" } }, select: { id: true } }) : [];
  const tf = await db.$transaction(async (tx) => {
    const t = await tx.taskforce.create({
      data: { name, description: input.description?.trim() ?? "", createdBy: ctx.userId, members: { create: [{ userId: ctx.userId, role: "lead" }, ...valid.map((u) => ({ userId: u.id, role: "member" }))] } },
    });
    await tx.channel.create({ data: { tree: "TASKFORCE", name, slug: `tf-${t.id}`, taskforceId: t.id, sortOrder: t.id } });
    return t;
  });
  await audit(db, ctx.userId, "taskforce.create", `taskforce:${tf.id}`, undefined, { name });
  return tf;
}

async function requireManage(db: PrismaClient, ctx: ChatCtx, taskforceId: number) {
  const m = await db.taskforceMember.findUnique({ where: { taskforceId_userId: { taskforceId, userId: ctx.userId } } });
  if (!canManageTaskforce(ctx, m?.role === "lead")) throw new ForbiddenError("Nur Leads und Admins verwalten Task-Forces");
}

export async function addTaskforceMember(db: PrismaClient, ctx: ChatCtx, taskforceId: number, userId: string, role: "lead" | "member" = "member") {
  await requireManage(db, ctx, taskforceId);
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u || u.banned || u.role === "GUEST") throw new ChatError("Nutzer kann nicht hinzugefügt werden");
  await db.taskforceMember.upsert({ where: { taskforceId_userId: { taskforceId, userId } }, create: { taskforceId, userId, role }, update: { role } });
  await audit(db, ctx.userId, "taskforce.member_add", `taskforce:${taskforceId}`, undefined, { userId, role });
}

export async function removeTaskforceMember(db: PrismaClient, ctx: ChatCtx, taskforceId: number, userId: string) {
  await requireManage(db, ctx, taskforceId);
  const leads = await db.taskforceMember.count({ where: { taskforceId, role: "lead" } });
  const target = await db.taskforceMember.findUnique({ where: { taskforceId_userId: { taskforceId, userId } } });
  if (target?.role === "lead" && leads <= 1) throw new ChatError("Der letzte Lead kann nicht entfernt werden");
  await db.taskforceMember.deleteMany({ where: { taskforceId, userId } });
  await audit(db, ctx.userId, "taskforce.member_remove", `taskforce:${taskforceId}`, { userId });
}

export async function archiveTaskforce(db: PrismaClient, ctx: ChatCtx, taskforceId: number) {
  await requireManage(db, ctx, taskforceId);
  const now = new Date();
  await db.$transaction([db.taskforce.update({ where: { id: taskforceId }, data: { archivedAt: now } }), db.channel.updateMany({ where: { taskforceId }, data: { archivedAt: now } })]);
  await audit(db, ctx.userId, "taskforce.archive", `taskforce:${taskforceId}`);
}

// ───────── Kanäle & Tags verwalten (Admin) ─────────

function requireSettings(ctx: ChatCtx) {
  if (!hasPermission(ctx.role, "settings.edit", ctx.matrix)) throw new ForbiddenError("Fehlendes Recht settings.edit");
}
const checkRole = (r: string) => {
  if (!(ROLES as readonly string[]).includes(r) || r === "SYSTEMADMIN") throw new ChatError("Ungültige Rolle");
};

export async function createChannel(db: PrismaClient, ctx: ChatCtx, input: { name: string; minReadRole?: string; minWriteRole?: string }) {
  requireSettings(ctx);
  const name = input.name.trim();
  if (name.length < 2 || name.length > 40) throw new ChatError("Name: 2–40 Zeichen");
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
  if (!ch || ch.tree !== "ALLY") throw new ChatError("Kanal nicht gefunden", 404);
  const data: Prisma.ChannelUpdateInput = {};
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (n.length < 2 || n.length > 40) throw new ChatError("Name: 2–40 Zeichen");
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
  if (!hasPermission(ctx.role, "tags.manage", ctx.matrix)) throw new ForbiddenError("Fehlendes Recht tags.manage");
}

export async function saveTag(db: PrismaClient, ctx: ChatCtx, input: { id?: number; name: string; color: string }) {
  requireTags(ctx);
  const name = input.name.trim();
  if (name.length < 2 || name.length > 24) throw new ChatError("Name: 2–24 Zeichen");
  if (!(TAG_COLORS as readonly string[]).includes(input.color)) throw new ChatError("Ungültige Farbe");
  try {
    return input.id
      ? await db.tag.update({ where: { id: input.id }, data: { name, color: input.color } })
      : await db.tag.create({ data: { name, color: input.color, createdBy: ctx.userId } });
  } catch {
    throw new ChatError("Tag existiert bereits");
  }
}

export async function deleteTag(db: PrismaClient, ctx: ChatCtx, id: number) {
  requireTags(ctx);
  await db.tag.deleteMany({ where: { id } });
}

