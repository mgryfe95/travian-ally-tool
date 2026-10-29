"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { mailEnabled } from "@/lib/mail";
import { createLimiter } from "@/lib/ratelimit";
import { requireUser } from "@/lib/session";

const resetLimiter = createLimiter(3, 15 * 60_000);

/** Reset-Link an die eigene Adresse (einmalig, 1 h gültig); führt auf die vom App-Layout entkoppelte Seite /reset-password. */
export async function requestOwnResetAction() {
  const user = await requireUser();
  if (!mailEnabled()) redirect("/account?reset=nomail");
  if (!resetLimiter.check(user.id)) redirect("/account?reset=limit");
  await auth.api.requestPasswordReset({ body: { email: user.email, redirectTo: "/reset-password" } });
  redirect("/account?reset=sent");
}
