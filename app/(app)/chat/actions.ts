"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { localizeError } from "@/lib/i18n/errors";
import { ForbiddenError } from "@/lib/permissions";
import { archiveTaskforce, ChatError, chatCtx, createTaskforce, inviteToTaskforce, removeTaskforceMember, respondTaskforceInvite, revokeTaskforceInvite, setTaskforceRole } from "@/lib/services/chat";
import { requireUser } from "@/lib/session";

async function run(back: string, fn: () => Promise<string | void>): Promise<never> {
  let target = back;
  try {
    target = (await fn()) ?? back;
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof ChatError) target = `${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(localizeError(e, (await getT()).locale))}`;
    else throw e;
  }
  redirect(target);
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function createTaskforceAction(f: FormData) {
  return run("/chat/tf/new", async () => {
    const ctx = await chatCtx(db, await requireUser());
    const tf = await createTaskforce(db, ctx, { name: str(f, "name"), description: str(f, "description"), memberIds: f.getAll("members").map(String) });
    const ch = await db.channel.findFirstOrThrow({ where: { taskforceId: tf.id } });
    return `/chat?c=${ch.id}`;
  });
}

const tfRole = (v: string) => (v === "lead" || v === "reader" ? v : "member");

export async function inviteMemberAction(f: FormData) {
  const id = Number(str(f, "taskforceId"));
  return run(`/chat/tf/${id}`, async () => void (await inviteToTaskforce(db, await chatCtx(db, await requireUser()), id, str(f, "userId"), tfRole(str(f, "role")))));
}

export async function revokeInviteAction(f: FormData) {
  const id = Number(str(f, "taskforceId"));
  return run(`/chat/tf/${id}`, async () => revokeTaskforceInvite(db, await chatCtx(db, await requireUser()), Number(str(f, "inviteId"))));
}

export async function setRoleAction(f: FormData) {
  const id = Number(str(f, "taskforceId"));
  return run(`/chat/tf/${id}`, async () => setTaskforceRole(db, await chatCtx(db, await requireUser()), id, str(f, "userId"), tfRole(str(f, "role"))));
}

export async function respondInviteAction(f: FormData) {
  return run("/chat", async () => {
    const ch = await respondTaskforceInvite(db, await chatCtx(db, await requireUser()), Number(str(f, "inviteId")), str(f, "answer") === "accept");
    return ch ? `/chat?c=${ch}` : "/chat";
  });
}

export async function leaveTaskforceAction(f: FormData) {
  const id = Number(str(f, "taskforceId"));
  return run(`/chat/tf/${id}`, async () => {
    const u = await requireUser();
    await removeTaskforceMember(db, await chatCtx(db, u), id, u.id);
    return "/chat";
  });
}

export async function removeMemberAction(f: FormData) {
  const id = Number(str(f, "taskforceId"));
  return run(`/chat/tf/${id}`, async () => removeTaskforceMember(db, await chatCtx(db, await requireUser()), id, str(f, "userId")));
}

export async function archiveTaskforceAction(f: FormData) {
  const id = Number(str(f, "taskforceId"));
  return run(`/chat/tf/${id}`, async () => {
    await archiveTaskforce(db, await chatCtx(db, await requireUser()), id);
    return "/chat";
  });
}
