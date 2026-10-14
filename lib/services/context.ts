import type { PrismaClient } from "@prisma/client";
import { defaultMatrix, PERMISSIONS, STORED_ROLES, type Matrix, type Permission, type Role, type StoredRole } from "../permissions";

/** Wer handelt. `role` ist die bereits abgeleitete effektive Rolle (inkl. SYSTEMADMIN aus ENV). */
export type Actor = { id: string; role: Role };

/** Lädt die Rechte-Matrix; solange die Tabelle leer ist (vor dem Seed), gelten die Defaults. */
export async function loadMatrix(db: Pick<PrismaClient, "rolePermission">): Promise<Matrix> {
  const rows = await db.rolePermission.findMany();
  if (rows.length === 0) return defaultMatrix();
  const m = Object.fromEntries(STORED_ROLES.map((r) => [r, new Set<Permission>()])) as Record<StoredRole, Set<Permission>>;
  for (const r of rows) {
    if ((STORED_ROLES as readonly string[]).includes(r.role) && (PERMISSIONS as readonly string[]).includes(r.permission)) {
      m[r.role as StoredRole].add(r.permission as Permission);
    }
  }
  return m;
}

export async function audit(
  db: Pick<PrismaClient, "auditLog">,
  actorId: string,
  action: string,
  target: string,
  before?: unknown,
  after?: unknown,
) {
  await db.auditLog.create({
    data: { actorId, action, target, before: before === undefined ? undefined : (before as object), after: after === undefined ? undefined : (after as object) },
  });
}
