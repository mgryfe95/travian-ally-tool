import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { env } from "./env";
import { effectiveRole, hasPermission, type Permission, type Role } from "./permissions";
import { loadMatrix, type Actor } from "./services/context";

export type CurrentUser = Actor & { email: string; name: string };

/** Frisch aus der DB: Rolle und Sperre gelten bei jedem Request sofort; SYSTEMADMIN kommt nur aus der ENV-Liste. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.banned) return null;
  return { id: user.id, email: user.email, name: user.name, role: effectiveRole(user, env().SYSTEMADMIN_EMAILS) };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(...perms: Permission[]): Promise<CurrentUser> {
  const user = await requireUser();
  const matrix = await loadMatrix(db);
  if (!perms.some((p) => hasPermission(user.role, p, matrix))) redirect("/forbidden");
  return user;
}

export async function permissionsOf(role: Role, perms: readonly Permission[]): Promise<Record<string, boolean>> {
  const matrix = await loadMatrix(db);
  return Object.fromEntries(perms.map((p) => [p, hasPermission(role, p, matrix)]));
}
