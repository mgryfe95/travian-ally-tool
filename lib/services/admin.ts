import type { PrismaClient } from "@prisma/client";
import { env } from "../env";
import {
  assertCanAssignRole, assertCanEditPermission, assertCanModerateUser, effectiveRole, ForbiddenError, isEmergencyAdmin, rank, STORED_ROLES,
  type Permission, type Role, type StoredRole,
} from "../permissions";
import { audit, loadMatrix, type Actor } from "./context";
import { AppError } from "../i18n/errors";

async function loadTarget(db: PrismaClient, userId: string, sysadmins: readonly string[]) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("err.user.notFound");
  return { user, role: effectiveRole(user, sysadmins) as Role, emergency: isEmergencyAdmin(user.email, sysadmins) };
}

export async function setUserRole(
  db: PrismaClient, actor: Actor, userId: string, newRole: Role, sysadmins: readonly string[] = env().SYSTEMADMIN_EMAILS,
) {
  const { user, role, emergency } = await loadTarget(db, userId, sysadmins);
  if (emergency) throw new ForbiddenError("err.perm.protectedAccount");
  assertCanAssignRole(actor.role, role, newRole, await loadMatrix(db));
  if (!(STORED_ROLES as readonly string[]).includes(newRole)) throw new ForbiddenError("err.role.invalid");
  await db.user.update({ where: { id: userId }, data: { role: newRole as StoredRole } });
  await audit(db, actor.id, "user.role", `user:${userId}`, { role: user.role }, { role: newRole });
}

/**
 * Rolle je Spieler vorab festlegen (auch vor Registrierung/Einladung). Bei der Verifizierung bekommt das Konto diese Rolle;
 * ist der Spieler schon verifiziert verknüpft, wird die Rolle sofort übernommen. `null` = automatisch (Mitglied bzw. Gast).
 */
export async function setPlayerRole(db: PrismaClient, actor: Actor, playerId: number, newRole: StoredRole | null, sysadmins: readonly string[] = env().SYSTEMADMIN_EMAILS) {
  const matrix = await loadMatrix(db);
  const prev = await db.playerRole.findUnique({ where: { travianPlayerId: playerId } });
  assertCanAssignRole(actor.role, (prev?.role as Role | undefined) ?? "GUEST", newRole ?? "GUEST", matrix);
  if (newRole && !(STORED_ROLES as readonly string[]).includes(newRole)) throw new ForbiddenError("err.role.invalid");
  if (newRole) await db.playerRole.upsert({ where: { travianPlayerId: playerId }, create: { travianPlayerId: playerId, role: newRole, setBy: actor.id }, update: { role: newRole, setBy: actor.id, setAt: new Date() } });
  else await db.playerRole.deleteMany({ where: { travianPlayerId: playerId } });
  await audit(db, actor.id, "player.role", `player:${playerId}`, { role: prev?.role ?? null }, { role: newRole });
  if (!newRole) return;
  const links = await db.playerLink.findMany({ where: { travianPlayerId: playerId, status: "verified" }, select: { userId: true } });
  for (const l of links) {
    const t = await loadTarget(db, l.userId, sysadmins).catch(() => null);
    if (!t || t.emergency || t.user.role === newRole) continue;
    if (actor.role !== "ADMIN" && rank(t.role) >= rank(actor.role)) continue;
    await db.user.update({ where: { id: l.userId }, data: { role: newRole } });
    await audit(db, actor.id, "user.role", `user:${l.userId}`, { role: t.user.role }, { role: newRole, via: "player" });
  }
}

export async function setUserBanned(
  db: PrismaClient, actor: Actor, userId: string, banned: boolean, sysadmins: readonly string[] = env().SYSTEMADMIN_EMAILS,
) {
  const { user, role, emergency } = await loadTarget(db, userId, sysadmins);
  if (emergency) throw new ForbiddenError("err.perm.protectedAccount");
  if (banned && userId === actor.id) throw new ForbiddenError("err.perm.notSelf");
  assertCanModerateUser(actor.role, role, await loadMatrix(db));
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { banned } }),
    ...(banned ? [db.session.deleteMany({ where: { userId } })] : []),
  ]);
  await audit(db, actor.id, banned ? "user.ban" : "user.unban", `user:${userId}`, { banned: user.banned }, { banned });
}

export async function deleteUser(
  db: PrismaClient, actor: Actor, userId: string, sysadmins: readonly string[] = env().SYSTEMADMIN_EMAILS,
) {
  const { user, role, emergency } = await loadTarget(db, userId, sysadmins);
  if (emergency) throw new ForbiddenError("err.perm.protectedAccount");
  if (userId === actor.id) throw new ForbiddenError("err.perm.notSelf");
  assertCanModerateUser(actor.role, role, await loadMatrix(db));
  await db.user.delete({ where: { id: userId } });
  await audit(db, actor.id, "user.delete", `user:${userId}`, { email: user.email, role: user.role });
}

export async function setRolePermission(db: PrismaClient, actor: Actor, role: Role, permission: Permission, enabled: boolean) {
  const matrix = await loadMatrix(db);
  assertCanEditPermission(actor.role, role, permission, matrix);
  const stored = role as StoredRole;
  const before = matrix[stored].has(permission);
  if (enabled) await db.rolePermission.upsert({ where: { role_permission: { role, permission } }, create: { role, permission }, update: {} });
  else await db.rolePermission.deleteMany({ where: { role, permission } });
  await audit(db, actor.id, "permission.set", `role:${role}`, { permission, enabled: before }, { permission, enabled });
}

/** Allianz-Typ setzen: Recht alliances.classify (Admins immer). */
export async function classifyAlliance(
  db: PrismaClient, actor: Actor, allianceId: number, relation: import("../alliance-group").Relation | "CLEAR", note?: string,
) {
  const { hasPermission } = await import("../permissions");
  if (!hasPermission(actor.role, "alliances.classify", await loadMatrix(db))) throw new ForbiddenError("err.perm.missing", { perm: "alliances.classify" });
  const { setRelation, clearRelation } = await import("../alliance-group");
  const before = await db.allianceClassification.findUnique({ where: { allianceId } });
  if (relation === "CLEAR") await clearRelation(db, allianceId);
  else await setRelation(db, allianceId, relation, { note, updatedBy: actor.id });
  await audit(db, actor.id, "alliance.classify", `alliance:${allianceId}`, before ?? undefined, relation === "CLEAR" ? undefined : { relation, note });
}

/** Seed: Defaults in die Matrix schreiben (idempotent, überschreibt keine bestehenden Änderungen). */
export async function seedPermissions(db: Pick<PrismaClient, "rolePermission">) {
  if ((await db.rolePermission.count()) > 0) return;
  const { DEFAULT_PERMISSIONS } = await import("../permissions");
  await db.rolePermission.createMany({
    data: STORED_ROLES.flatMap((role) => DEFAULT_PERMISSIONS[role].map((permission) => ({ role, permission }))),
  });
}
