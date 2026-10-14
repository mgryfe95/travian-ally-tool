export const ROLES = ["GUEST", "MEMBER", "MODERATOR", "ADMIN", "SYSTEMADMIN"] as const;
export type Role = (typeof ROLES)[number];
/** Rollen, die in der DB stehen dürfen. SYSTEMADMIN wird ausschließlich aus SYSTEMADMIN_EMAILS abgeleitet. */
export const STORED_ROLES = ["GUEST", "MEMBER", "MODERATOR", "ADMIN"] as const;
export type StoredRole = (typeof STORED_ROLES)[number];

export const rank = (r: Role) => ROLES.indexOf(r);

export const PERMISSIONS = [
  "chat.read", "chat.write", "chat.moderate", "chat.upload",
  "tags.manage", "taskforce.create", "taskforce.manage",
  "members.invite", "members.approve", "roles.assign", "permissions.edit",
  "map.view", "settings.edit", "alliances.classify", "gamedata.edit",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const DEFAULT_PERMISSIONS: Record<StoredRole, Permission[]> = {
  GUEST: ["map.view", "chat.read"],
  MEMBER: ["map.view", "chat.read", "chat.write", "chat.upload"],
  MODERATOR: ["map.view", "chat.read", "chat.write", "chat.upload", "chat.moderate", "tags.manage", "taskforce.create", "members.invite", "members.approve"],
  ADMIN: [...PERMISSIONS],
};

/** Rechte, die nur SYSTEMADMIN an der Rolle ADMIN ändern darf (Aussperr-Schutz). */
export const ADMIN_LOCKED_PERMISSIONS: Permission[] = ["permissions.edit", "roles.assign"];

export type Matrix = Record<StoredRole, ReadonlySet<Permission>>;

export function defaultMatrix(): Matrix {
  return Object.fromEntries(STORED_ROLES.map((r) => [r, new Set(DEFAULT_PERMISSIONS[r])])) as unknown as Matrix;
}

export class ForbiddenError extends Error {
  readonly status = 403;
}

/** SYSTEMADMIN folgt nur aus der ENV-Liste (case-insensitiv), nie aus der DB. */
export function effectiveRole(user: { email: string; role: string }, systemadminEmails: readonly string[]): Role {
  if (systemadminEmails.includes(user.email.trim().toLowerCase())) return "SYSTEMADMIN";
  return (STORED_ROLES as readonly string[]).includes(user.role) ? (user.role as StoredRole) : "GUEST";
}

export function hasPermission(role: Role, perm: Permission, matrix: Matrix): boolean {
  if (role === "SYSTEMADMIN") return true;
  return matrix[role].has(perm);
}

const deny = (msg: string): never => {
  throw new ForbiddenError(msg);
};

/** Rolle eines Nutzers ändern. Wirft ForbiddenError (→ HTTP 403). */
export function assertCanAssignRole(actor: Role, target: Role, newRole: Role, matrix: Matrix) {
  if (!hasPermission(actor, "roles.assign", matrix)) deny("Fehlendes Recht roles.assign");
  if (target === "SYSTEMADMIN") deny("SYSTEMADMIN kann nicht geändert werden");
  if (newRole === "SYSTEMADMIN") deny("SYSTEMADMIN kann nicht vergeben werden");
  if (rank(target) >= rank(actor) && actor !== "SYSTEMADMIN") deny("Nur Nutzer unterhalb der eigenen Rolle sind änderbar");
  if (actor !== "SYSTEMADMIN" && rank(newRole) >= rank(actor)) deny("Nur Rollen unterhalb der eigenen Rolle sind vergebbar");
}

/** Sperren, entsperren oder löschen. */
export function assertCanModerateUser(actor: Role, target: Role, matrix: Matrix) {
  if (!hasPermission(actor, "roles.assign", matrix)) deny("Fehlendes Recht roles.assign");
  if (target === "SYSTEMADMIN") deny("SYSTEMADMIN kann nicht gesperrt oder gelöscht werden");
  if (rank(target) >= rank(actor) && actor !== "SYSTEMADMIN") deny("Nur Nutzer unterhalb der eigenen Rolle");
}

/** Rechte-Matrix bearbeiten. `role` ist die Rolle, deren Recht geändert wird. */
export function assertCanEditPermission(actor: Role, role: Role, perm: Permission, matrix: Matrix) {
  if (!hasPermission(actor, "permissions.edit", matrix)) deny("Fehlendes Recht permissions.edit");
  if (role === "SYSTEMADMIN") deny("Rechte von SYSTEMADMIN sind nicht änderbar");
  if (actor !== "SYSTEMADMIN" && role === "ADMIN" && ADMIN_LOCKED_PERMISSIONS.includes(perm)) {
    deny(`${perm} der Rolle ADMIN darf nur SYSTEMADMIN ändern`);
  }
}
