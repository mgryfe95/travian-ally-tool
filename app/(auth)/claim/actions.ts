"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getT } from "@/lib/i18n/server";
import { localizeError } from "@/lib/i18n/errors";
import { fetchMapSql, importMapSql } from "@/lib/import/importer";
import { getInactiveDays } from "@/lib/settings";
import { proveLink, startClaim, VerificationError } from "@/lib/services/verification";
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

/** Neue map.sql laden und importieren; zwei gleichzeitige Importe derselben Datei (Worker/Knopf) scheitern am Hash-Unique → „unverändert“. */
async function fetchAndImport(): Promise<"imported" | "unchanged"> {
  const text = await fetchMapSql(env().TRAVIAN_SERVER_URL);
  try {
    return (await importMapSql(db, text, { inactiveDays: await getInactiveDays(db), timeZone: env().GAME_TIMEZONE })).status;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "unchanged";
    throw e;
  }
}

export async function proveLinkAction() {
  const user = await requireUser();
  const r = await proveLink(db, user.id, { fetchAndImport });
  redirect(r === "verified" ? "/" : `/claim?r=${r}`);
}
