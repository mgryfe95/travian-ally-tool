import { hasPermission, rank, type Matrix, type Role } from "../permissions";

export type ChannelLike = {
  tree: "ALLY" | "TASKFORCE";
  taskforceId: number | null;
  minReadRole: string;
  minWriteRole: string;
  archivedAt: Date | null;
};

export type ChatCtx = {
  userId: string;
  role: Role;
  matrix: Matrix;
  /** Task-Forces, in denen der Nutzer Mitglied ist. */
  taskforceIds: ReadonlySet<number>;
};

const KNOWN: readonly string[] = ["GUEST", "MEMBER", "MODERATOR", "ADMIN", "SYSTEMADMIN"];
/** Unbekannte Mindestrollen werden wie ADMIN behandelt (fail closed). */
const atLeast = (role: Role, min: string) => rank(role) >= rank(KNOWN.includes(min) ? (min as Role) : "ADMIN");

/** Lesen: ALLY → Recht chat.read + Mindestrolle; TASKFORCE → Mitglied (ADMIN/SYSTEMADMIN sehen alle). */
export function canReadChannel(ch: ChannelLike, ctx: ChatCtx): boolean {
  if (ch.archivedAt) return false;
  if (!hasPermission(ctx.role, "chat.read", ctx.matrix)) return false;
  if (ch.tree === "TASKFORCE") return atLeast(ctx.role, "ADMIN") || (ch.taskforceId !== null && ctx.taskforceIds.has(ch.taskforceId));
  return atLeast(ctx.role, ch.minReadRole);
}

export function canWriteChannel(ch: ChannelLike, ctx: ChatCtx): boolean {
  if (!canReadChannel(ch, ctx)) return false;
  if (!hasPermission(ctx.role, "chat.write", ctx.matrix)) return false;
  return ch.tree === "TASKFORCE" ? true : atLeast(ctx.role, ch.minWriteRole);
}

/** Bearbeiten: nur der Autor. Löschen: Autor oder chat.moderate. */
export const canEditMessage = (authorId: string, ctx: ChatCtx) => authorId === ctx.userId;
export const canDeleteMessage = (authorId: string, ctx: ChatCtx) => authorId === ctx.userId || hasPermission(ctx.role, "chat.moderate", ctx.matrix);

/** Task-Force verwalten: taskforce.manage, ADMIN/SYSTEMADMIN oder Lead dieser Task-Force. */
export function canManageTaskforce(ctx: ChatCtx, isLead: boolean): boolean {
  return hasPermission(ctx.role, "taskforce.manage", ctx.matrix) || atLeast(ctx.role, "ADMIN") || isLead;
}
