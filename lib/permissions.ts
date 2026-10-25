import { AppError } from "./i18n/errors";
import type { MessageKey, Params } from "./i18n";

export const ROLES = ["GUEST", "MEMBER", "MODERATOR", "ADMIN"] as const;
/** GUEST = verifizierter enger Bündnispartner. UNVERIFIED wird nie gespeichert: Konto ohne verifizierte Spielerzuordnung (nur Verifizierungsseite, keine Rechte). */
export type Role = (typeof ROLES)[number] | "UNVERIFIED";
/** Rollen, die in der DB stehen dürfen (identisch mit ROLES). */
export const STORED_ROLES = ROLES;
export type StoredRole = (typeof STORED_ROLES)[number];

export const rank = (r: Role) => (r === "UNVERIFIED" ? -1 : ROLES.indexOf(r));

export const PERMISSIONS = [
  "chat.read", "chat.write", "chat.moderate", "chat.upload",
  "tags.manage", "taskforce.create", "taskforce.manage",
  "members.invite", "members.approve", "roles.assign", "permissions.edit",
  "map.view", "settings.edit", "alliances.classify", "gamedata.edit",
  "troops.view", "schedule.view", "schedule.manage", "messenger.use", "messenger.broadcast",
  "ai.advice", "incidents.report", "incidents.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const DEFAULT_PERMISSIONS: Record<StoredRole, Permission[]> = {
  GUEST: ["map.view", "chat.read", "chat.write", "schedule.view", "messenger.use"], // enge Bündnispartner (verifiziert); Kanäle steuern per minReadRole
  MEMBER: ["map.view", "chat.read", "chat.write", "chat.upload", "schedule.view", "messenger.use", "ai.advice", "incidents.report"],
  MODERATOR: ["map.view", "chat.read", "chat.write", "chat.upload", "chat.moderate", "tags.manage", "taskforce.create", "members.invite", "members.approve", "troops.view", "schedule.view", "messenger.use", "messenger.broadcast", "ai.advice", "incidents.report"],
  ADMIN: [...PERMISSIONS],
};

export type Matrix = Record<StoredRole, ReadonlySet<Permission>>;

export function defaultMatrix(): Matrix {
  return Object.fromEntries(STORED_ROLES.map((r) => [r, new Set(DEFAULT_PERMISSIONS[r])])) as unknown as Matrix;
}

export class ForbiddenError extends AppError {
  readonly status = 403;
}

/** Adressen aus der ENV-Liste (Notzugang) sind immer Admin – unabhängig vom Eintrag in der DB. */
export const isEmergencyAdmin = (email: string, emergencyEmails: readonly string[]) => emergencyEmails.includes(email.trim().toLowerCase());

export function effectiveRole(user: { email: string; role: string }, emergencyEmails: readonly string[]): Role {
  if (isEmergencyAdmin(user.email, emergencyEmails)) return "ADMIN";
  return (STORED_ROLES as readonly string[]).includes(user.role) ? (user.role as StoredRole) : "GUEST";
}

/** Admins haben immer alle Rechte (die Matrix gilt für Moderator, Mitglied und Gast). */
export function hasPermission(role: Role, perm: Permission, matrix: Matrix): boolean {
  if (role === "ADMIN") return true;
  if (role === "UNVERIFIED") return false;
  return matrix[role].has(perm);
}

const deny = (key: MessageKey, params?: Params): never => {
  throw new ForbiddenError(key, params);
};

/** Rolle eines Nutzers ändern. Admins dürfen jede Rolle vergeben und ändern; andere nur unterhalb ihrer eigenen. */
export function assertCanAssignRole(actor: Role, target: Role, newRole: Role, matrix: Matrix) {
  if (!hasPermission(actor, "roles.assign", matrix)) deny("err.perm.missing", { perm: "roles.assign" });
  if (actor !== "ADMIN" && rank(target) >= rank(actor)) deny("err.perm.onlyBelowOwn");
  if (actor !== "ADMIN" && rank(newRole) >= rank(actor)) deny("err.perm.onlyRolesBelow");
}

/** Sperren, entsperren oder löschen. Notzugangs-Konten und das eigene Konto sind ausgenommen (siehe Service). */
export function assertCanModerateUser(actor: Role, target: Role, matrix: Matrix) {
  if (!hasPermission(actor, "roles.assign", matrix)) deny("err.perm.missing", { perm: "roles.assign" });
  if (actor !== "ADMIN" && rank(target) >= rank(actor)) deny("err.perm.onlyBelowOwn");
}

/** Rechte-Matrix bearbeiten (Moderator, Mitglied, Gast). Admins haben immer alles. */
export function assertCanEditPermission(actor: Role, role: Role, perm: Permission, matrix: Matrix) {
  if (!hasPermission(actor, "permissions.edit", matrix)) deny("err.perm.missing", { perm: "permissions.edit" });
  void perm;
  if (role === "ADMIN") deny("err.perm.adminAlwaysAll");
}
