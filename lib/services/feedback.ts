import type { PrismaClient } from "@prisma/client";
import { ForbiddenError, hasPermission } from "../permissions";
import { audit, loadMatrix, type Actor } from "./context";
import { ChatError } from "./chat";

export const MAX_FEEDBACK = 2000;
const MAX_SELECTOR = 600;
const MAX_PATH = 300;

export type FeedbackStatus = "open" | "closed";
export type FeedbackView = {
  id: number; path: string; selector: string; label: string; status: FeedbackStatus; createdAt: string; closedAt: string | null;
  createdBy: { id: string; name: string }; closedBy: { id: string; name: string } | null;
  comments: { id: number; author: { id: string; name: string }; body: string; createdAt: string }[];
};

/** Beta-Feedback dürfen Konten mit Beta-Kennzeichen und alle, die Rollen vergeben (Admins). */
export async function canFeedback(db: PrismaClient, actor: Actor): Promise<boolean> {
  if (hasPermission(actor.role, "roles.assign", await loadMatrix(db))) return true;
  return !!(await db.user.findUnique({ where: { id: actor.id }, select: { betaTester: true } }))?.betaTester;
}

async function requireFeedback(db: PrismaClient, actor: Actor) {
  if (!(await canFeedback(db, actor))) throw new ForbiddenError("err.beta.notTester");
}

const clean = (s: string, max: number) => s.trim().slice(0, max);
function body(raw: string) {
  const b = raw.trim();
  if (!b) throw new ChatError("err.chat.empty");
  if (b.length > MAX_FEEDBACK) throw new ChatError("err.chat.tooLong", { max: MAX_FEEDBACK });
  return b;
}

/** Neuer Thread zu einem Element (erster Kommentar inklusive). */
export async function createFeedback(db: PrismaClient, actor: Actor, input: { path: string; selector: string; label?: string; body: string }) {
  await requireFeedback(db, actor);
  const path = clean(input.path, MAX_PATH), selector = clean(input.selector, MAX_SELECTOR);
  if (!path.startsWith("/") || !selector) throw new ChatError("err.beta.target");
  return db.feedbackThread.create({ data: { path, selector, label: clean(input.label ?? "", 160), createdBy: actor.id, comments: { create: { authorId: actor.id, body: body(input.body) } } } });
}

/** Antwort in einem Thread (auch in geschlossenen – öffnet ihn nicht automatisch). */
export async function replyFeedback(db: PrismaClient, actor: Actor, threadId: number, raw: string) {
  await requireFeedback(db, actor);
  if (!(await db.feedbackThread.findUnique({ where: { id: threadId } }))) throw new ChatError("err.beta.notFound", undefined, 404);
  return db.feedbackComment.create({ data: { threadId, authorId: actor.id, body: body(raw) } });
}

export async function setFeedbackStatus(db: PrismaClient, actor: Actor, threadId: number, status: FeedbackStatus, now = new Date()) {
  await requireFeedback(db, actor);
  const r = await db.feedbackThread.updateMany({ where: { id: threadId }, data: status === "closed" ? { status, closedAt: now, closedBy: actor.id } : { status, closedAt: null, closedBy: null } });
  if (!r.count) throw new ChatError("err.beta.notFound", undefined, 404);
}

/** Alle Threads (optional gefiltert), neueste zuerst, mit Kommentaren und Namen – auch die Grundlage für den JSON-Export. */
export async function listFeedback(db: PrismaClient, actor: Actor, filter: { status?: FeedbackStatus | "all"; path?: string } = {}): Promise<FeedbackView[]> {
  await requireFeedback(db, actor);
  const rows = await db.feedbackThread.findMany({
    where: { ...(filter.status && filter.status !== "all" ? { status: filter.status } : {}), ...(filter.path ? { path: filter.path } : {}) },
    include: { comments: { orderBy: { id: "asc" } } }, orderBy: { id: "desc" }, take: 1000,
  });
  const ids = [...new Set(rows.flatMap((r) => [r.createdBy, r.closedBy ?? "", ...r.comments.map((c) => c.authorId)]).filter(Boolean))];
  const names = new Map((await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const who = (id: string) => ({ id, name: names.get(id) ?? "?" });
  return rows.map((r) => ({
    id: r.id, path: r.path, selector: r.selector, label: r.label, status: r.status as FeedbackStatus, createdAt: r.createdAt.toISOString(), closedAt: r.closedAt?.toISOString() ?? null,
    createdBy: who(r.createdBy), closedBy: r.closedBy ? who(r.closedBy) : null,
    comments: r.comments.map((c) => ({ id: c.id, author: who(c.authorId), body: c.body, createdAt: c.createdAt.toISOString() })),
  }));
}

/** Beta-Kennzeichen setzen (nur wer Rollen vergeben darf). */
export async function setBetaTester(db: PrismaClient, actor: Actor, userId: string, on: boolean) {
  if (!hasPermission(actor.role, "roles.assign", await loadMatrix(db))) throw new ForbiddenError("err.perm.missing", { perm: "roles.assign" });
  await db.user.update({ where: { id: userId }, data: { betaTester: on } });
  await audit(db, actor.id, "beta.tester", `user:${userId}`, undefined, { on });
}
