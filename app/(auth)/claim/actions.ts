"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { localizeError } from "@/lib/i18n/errors";
import { startClaim, VerificationError } from "@/lib/services/verification";
import { requireUser } from "@/lib/session";

export async function startClaimAction(f: FormData) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const name = String(f.get("playerName") ?? "").trim();
  let error: string | undefined;
  try {
    const players = await db.player.findMany({ where: { name: { equals: name, mode: "insensitive" } }, take: 2 });
    if (players.length !== 1) error = players.length === 0 ? t("auth.claim.noPlayer") : t("auth.claim.ambiguous");
    else await startClaim(db, user.id, players[0]!.id);
  } catch (e) {
    if (e instanceof VerificationError) error = localizeError(e, locale);
    else throw e;
  }
  redirect(error ? `/claim?error=${encodeURIComponent(error)}` : "/claim");
}
