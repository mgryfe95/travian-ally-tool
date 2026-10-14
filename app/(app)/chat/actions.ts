"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ForbiddenError } from "@/lib/permissions";
import { addTaskforceMember, archiveTaskforce, ChatError, chatCtx, createTaskforce, removeTaskforceMember } from "@/lib/services/chat";
import { requireUser } from "@/lib/session";

async function run(back: string, fn: () => Promise<string | void>): Promise<never> {
  let target = back;
  try {
    target = (await fn()) ?? back;
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof ChatError) target = `${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(e.message)}`;
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

export async function addMemberAction(f: FormData) {
  const id = Number(str(f, "taskforceId"));
  return run(`/chat/tf/${id}`, async () => addTaskforceMember(db, await chatCtx(db, await requireUser()), id, str(f, "userId"), str(f, "role") === "lead" ? "lead" : "member"));
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
