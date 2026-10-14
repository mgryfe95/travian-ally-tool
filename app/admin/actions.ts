"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { RELATIONS, type Relation } from "@/lib/alliance-group";
import { ForbiddenError, PERMISSIONS, ROLES, type Permission, type Role } from "@/lib/permissions";
import { classifyAlliance, deleteUser, setRolePermission, setUserBanned, setUserRole } from "@/lib/services/admin";
import { approveLink, createInvite, inviteMessage, rejectLink, revokeInvite, VerificationError } from "@/lib/services/verification";
import { requireUser } from "@/lib/session";

/** Führt die Aktion aus und leitet zurück; Fachfehler erscheinen als ?error=… statt als Absturz. */
async function run(back: string, fn: () => Promise<void>): Promise<never> {
  let error: string | undefined;
  try {
    await fn();
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof VerificationError) error = e.message;
    else throw e;
  }
  redirect(error ? `${back}?error=${encodeURIComponent(error)}` : back);
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const int = (f: FormData, k: string) => Number(str(f, k));

export async function classifyAllianceAction(f: FormData) {
  return run("/admin/alliances", async () => {
    const rel = str(f, "relation");
    if (rel !== "CLEAR" && !RELATIONS.includes(rel as Relation)) throw new VerificationError("Ungültiger Typ");
    await classifyAlliance(db, await requireUser(), int(f, "allianceId"), rel as Relation | "CLEAR", str(f, "note") || undefined);
  });
}

export async function setRoleAction(f: FormData) {
  return run("/admin/users", async () => {
    const role = str(f, "role");
    if (!ROLES.includes(role as Role)) throw new VerificationError("Ungültige Rolle");
    await setUserRole(db, await requireUser(), str(f, "userId"), role as Role);
  });
}

export async function banAction(f: FormData) {
  return run("/admin/users", async () => setUserBanned(db, await requireUser(), str(f, "userId"), str(f, "banned") === "1"));
}

export async function deleteUserAction(f: FormData) {
  return run("/admin/users", async () => deleteUser(db, await requireUser(), str(f, "userId")));
}

export async function setPermissionAction(f: FormData) {
  return run("/admin/permissions", async () => {
    const perm = str(f, "permission");
    const role = str(f, "role");
    if (!(PERMISSIONS as readonly string[]).includes(perm) || !ROLES.includes(role as Role)) throw new VerificationError("Ungültige Eingabe");
    await setRolePermission(db, await requireUser(), role as Role, perm as Permission, str(f, "enabled") === "1");
  });
}

export async function approveLinkAction(f: FormData) {
  return run("/admin/members", async () => approveLink(db, await requireUser(), int(f, "linkId")));
}
export async function rejectLinkAction(f: FormData) {
  return run("/admin/members", async () => rejectLink(db, await requireUser(), int(f, "linkId")));
}
export async function revokeInviteAction(f: FormData) {
  return run("/admin/members", async () => revokeInvite(db, await requireUser(), int(f, "inviteId")));
}

export type InviteState = { error?: string; message?: string; url?: string };

/** Klartext-Token wird nur hier einmal ausgegeben. */
export async function createInviteAction(_prev: InviteState, f: FormData): Promise<InviteState> {
  try {
    const { token, player } = await createInvite(db, await requireUser(), int(f, "playerId"));
    const message = inviteMessage({ playerName: player.name, token, appUrl: env().APP_URL });
    return { message, url: `${env().APP_URL.replace(/\/+$/, "")}/invite/${token}` };
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof VerificationError) return { error: e.message };
    throw e;
  }
}
