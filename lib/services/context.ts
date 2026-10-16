import type { PrismaClient } from "@prisma/client";
import { defaultMatrix, PERMISSIONS, STORED_ROLES, type Matrix, type Permission, type Role, type StoredRole } from "../permissions";
import { DEFAULT_LOCALE, isLocale, type Locale } from "../i18n";

/** Wer handelt. `role` ist die bereits abgeleitete effektive Rolle (Notzugangs-Adressen aus der ENV sind ADMIN). */
export type Actor = { id: string; role: Role };

/** Sprache des Nutzers (für persistierte Texte); unbekannt → Englisch. */
export async function userLocale(db: Pick<PrismaClient, "user">, userId: string): Promise<Locale> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
  return u?.locale && isLocale(u.locale) ? u.locale : DEFAULT_LOCALE;
}

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
