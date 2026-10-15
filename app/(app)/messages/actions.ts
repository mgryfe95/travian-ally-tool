"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { localizeError } from "@/lib/i18n/errors";
import { ForbiddenError } from "@/lib/permissions";
import { ChatError } from "@/lib/services/chat";
import { getOrCreateThread, sendBroadcast, type Audience } from "@/lib/services/messenger";
import { requireUser } from "@/lib/session";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

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

export async function openThreadAction(f: FormData) {
  return run("/messages", async () => `/messages?c=${(await getOrCreateThread(db, await requireUser(), str(f, "userId"))).id}`);
}

export async function sendBroadcastAction(f: FormData) {
  return run("/messages?t=bc", async () => {
    const kind = str(f, "audience");
    let audience: Audience;
    if (kind === "all") audience = { type: "all" };
    else if (kind.startsWith("role:")) audience = { type: "role", role: kind.slice(5) as "MEMBER" | "MODERATOR" | "ADMIN" };
    else if (kind.startsWith("tf:")) audience = { type: "taskforce", taskforceId: Number(kind.slice(3)) };
    else audience = { type: "users", userIds: f.getAll("userIds").map(String) };
    const r = await sendBroadcast(db, await requireUser(), { subject: str(f, "subject"), body: str(f, "body"), audience });
    return `/messages?t=bc&sent=${r.recipients}`;
  });
}
