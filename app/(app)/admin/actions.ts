"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError, localizeError } from "@/lib/i18n/errors";
import { getLocale, getT } from "@/lib/i18n/server";
import { RELATIONS, type Relation } from "@/lib/alliance-group";
import { ForbiddenError, PERMISSIONS, ROLES, type Permission, type Role } from "@/lib/permissions";
import { classifyAlliance, deleteUser, setRolePermission, setUserBanned, setUserRole } from "@/lib/services/admin";
import { approveLink, assignPlayer, createInvite, inviteMessage, rejectLink, revokeInvite, VerificationError } from "@/lib/services/verification";
import { ChatError, chatCtx, createChannel, deleteTag, deleteTagType, moveChannel, saveTag, saveTagType, updateChannel } from "@/lib/services/chat";
import { berlinToDate, cancelCall, createCall, deleteCall, deleteTemplate, saveTemplate, sendCall } from "@/lib/services/schedule";
import { requireUser } from "@/lib/session";
import { loadMemberRows } from "./tabs/data";

/** Führt die Aktion aus und leitet zurück; Fachfehler erscheinen als ?error=… statt als Absturz. */
async function run(tab: string, fn: () => Promise<void>): Promise<never> {
  let error: string | undefined;
  try {
    await fn();
  } catch (e) {
    if (e instanceof AppError || e instanceof ForbiddenError || e instanceof VerificationError || e instanceof ChatError) error = localizeError(e, await getLocale());
    else throw e;
  }
  redirect(`/admin?tab=${tab}${error ? `&error=${encodeURIComponent(error)}` : ""}`);
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const int = (f: FormData, k: string) => Number(str(f, k));

export async function classifyAllianceAction(f: FormData) {
  return run("alliances", async () => {
    const rel = str(f, "relation");
    if (rel !== "CLEAR" && !RELATIONS.includes(rel as Relation)) throw new AppError("admin.err.invalidType");
    await classifyAlliance(db, await requireUser(), int(f, "allianceId"), rel as Relation | "CLEAR", str(f, "note") || undefined);
  });
}

export async function setRoleAction(f: FormData) {
  return run(str(f, "tab") || "members", async () => {
    const role = str(f, "role");
    if (!ROLES.includes(role as Role)) throw new AppError("admin.err.invalidRole");
    await setUserRole(db, await requireUser(), str(f, "userId"), role as Role);
  });
}

export async function banAction(f: FormData) {
  return run("users", async () => setUserBanned(db, await requireUser(), str(f, "userId"), str(f, "banned") === "1"));
}

export async function deleteUserAction(f: FormData) {
  return run("users", async () => deleteUser(db, await requireUser(), str(f, "userId")));
}

export async function setPermissionAction(f: FormData) {
  return run("rights", async () => {
    const perm = str(f, "permission");
    const role = str(f, "role");
    if (!(PERMISSIONS as readonly string[]).includes(perm) || !ROLES.includes(role as Role)) throw new AppError("admin.err.invalidInput");
    await setRolePermission(db, await requireUser(), role as Role, perm as Permission, str(f, "enabled") === "1");
  });
}

export async function approveLinkAction(f: FormData) {
  return run("members", async () => approveLink(db, await requireUser(), int(f, "linkId")));
}
export async function assignPlayerAction(f: FormData) {
  return run("users", async () => assignPlayer(db, await requireUser(), str(f, "userId"), int(f, "playerId")));
}
export async function rejectLinkAction(f: FormData) {
  return run("members", async () => rejectLink(db, await requireUser(), int(f, "linkId")));
}
export async function revokeInviteAction(f: FormData) {
  return run("members", async () => revokeInvite(db, await requireUser(), int(f, "inviteId")));
}

export type InviteState = { error?: string; message?: string; items?: { player: string; message: string }[] };

const abs = async (token: string, name: string) => inviteMessage({ playerName: name, token, appUrl: env().APP_URL, locale: await getLocale() });

/** Neuer Link (der alte offene wird widerrufen). Der Klartext-Token erscheint nur hier einmal. */
export async function createInviteAction(_prev: InviteState, f: FormData): Promise<InviteState> {
  try {
    const user = await requireUser();
    const playerId = int(f, "playerId");
    await db.invite.updateMany({ where: { travianPlayerId: playerId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    const { token, player } = await createInvite(db, user, playerId);
    return { message: await abs(token, player.name) };
  } catch (e) {
    if (e instanceof AppError || e instanceof ForbiddenError || e instanceof VerificationError) return { error: localizeError(e, await getLocale()) };
    throw e;
  }
}

/** „Alle Uneingeladenen: Links erzeugen“ — nur Spieler ohne Konto, ohne offenen Claim und ohne offene Einladung. */
export async function createBulkInvitesAction(): Promise<InviteState> {
  try {
    const user = await requireUser();
    const rows = (await loadMemberRows(db)).filter((r) => r.state === "none");
    if (rows.length === 0) return { error: (await getT()).t("admin.err.noUninvited") };
    const items: NonNullable<InviteState["items"]> = [];
    for (const r of rows) {
      const { token, player } = await createInvite(db, user, r.player.id);
      items.push({ player: player.name, message: await abs(token, player.name) });
    }
    return { items };
  } catch (e) {
    if (e instanceof AppError || e instanceof ForbiddenError || e instanceof VerificationError) return { error: localizeError(e, await getLocale()) };
    throw e;
  }
}


// ───────── Kanäle & Tags ─────────

const cx = async () => chatCtx(db, await requireUser());

export async function createChannelAction(f: FormData) {
  return run("channels", async () => void (await createChannel(db, await cx(), { name: str(f, "name"), minReadRole: str(f, "minReadRole") || undefined, minWriteRole: str(f, "minWriteRole") || undefined })));
}
export async function updateChannelAction(f: FormData) {
  return run("channels", async () => updateChannel(db, await cx(), int(f, "channelId"), { name: str(f, "name"), minReadRole: str(f, "minReadRole"), minWriteRole: str(f, "minWriteRole") }));
}
export async function archiveChannelAction(f: FormData) {
  return run("channels", async () => updateChannel(db, await cx(), int(f, "channelId"), { archived: true }));
}
export async function moveChannelAction(f: FormData) {
  return run("channels", async () => moveChannel(db, await cx(), int(f, "channelId"), str(f, "dir") === "up" ? -1 : 1));
}
export async function saveTagAction(f: FormData) {
  return run("channels", async () => void (await saveTag(db, await cx(), { id: f.get("tagId") ? int(f, "tagId") : undefined, tagTypeId: f.get("tagTypeId") ? int(f, "tagTypeId") : undefined, name: str(f, "name"), color: str(f, "color") })));
}
export async function deleteTagAction(f: FormData) {
  return run("channels", async () => deleteTag(db, await cx(), int(f, "tagId")));
}

export async function saveTagTypeAction(f: FormData) {
  return run("channels", async () =>
    void (await saveTagType(db, await cx(), {
      id: f.get("tagTypeId") ? int(f, "tagTypeId") : undefined, name: str(f, "name"), multi: str(f, "multi") === "1", required: f.get("required") === "on",
      forTaskforces: f.get("forTaskforces") === "on", channelIds: f.getAll("channelIds").map(Number).filter(Number.isInteger),
    })));
}
export async function deleteTagTypeAction(f: FormData) {
  return run("channels", async () => deleteTagType(db, await cx(), int(f, "tagTypeId")));
}

// ───────── Allianz-Schedule ─────────
async function runSchedule(fn: () => Promise<void>): Promise<never> {
  let error: string | undefined;
  try {
    await fn();
  } catch (e) {
    if (e instanceof AppError || e instanceof ForbiddenError || e instanceof ChatError) error = localizeError(e, await getLocale());
    else throw e;
  }
  redirect(`/schedule${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}
export async function createCallAction(f: FormData) {
  return runSchedule(async () => {
    const atRaw = str(f, "at").trim();
    const at = atRaw ? berlinToDate(atRaw) : null;
    if (atRaw && !at) throw new AppError("admin.err.invalidTime");
    await createCall(db, await requireUser(), {
      kind: str(f, "kind"), title: str(f, "title"), coord: str(f, "coord"), at, note: str(f, "note"),
      channelId: f.get("channelId") ? int(f, "channelId") : undefined, templateId: f.get("templateId") ? int(f, "templateId") : undefined, sendNow: f.get("sendNow") === "1",
    });
  });
}
export async function sendCallAction(f: FormData) {
  return runSchedule(async () => void (await sendCall(db, await requireUser(), int(f, "callId"))));
}
export async function cancelCallAction(f: FormData) {
  return runSchedule(async () => cancelCall(db, await requireUser(), int(f, "callId")));
}
export async function deleteCallAction(f: FormData) {
  return runSchedule(async () => deleteCall(db, await requireUser(), int(f, "callId")));
}
export async function saveTemplateAction(f: FormData) {
  return runSchedule(async () => void (await saveTemplate(db, await requireUser(), {
    id: f.get("templateId") ? int(f, "templateId") : undefined, kind: str(f, "kind"), name: str(f, "name"), body: str(f, "body"), channelId: f.get("channelId") ? int(f, "channelId") : null,
  })));
}
export async function deleteTemplateAction(f: FormData) {
  return runSchedule(async () => deleteTemplate(db, await requireUser(), int(f, "templateId")));
}
