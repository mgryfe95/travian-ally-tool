"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { startClaim, VerificationError } from "@/lib/services/verification";
import { requireUser } from "@/lib/session";

export async function startClaimAction(f: FormData) {
  const user = await requireUser();
  const name = String(f.get("playerName") ?? "").trim();
  let error: string | undefined;
  try {
    const players = await db.player.findMany({ where: { name: { equals: name, mode: "insensitive" } }, take: 2 });
    if (players.length !== 1) throw new VerificationError(players.length === 0 ? "Kein Spieler mit diesem Namen" : "Name nicht eindeutig");
    await startClaim(db, user.id, players[0]!.id);
  } catch (e) {
    if (e instanceof VerificationError) error = e.message;
    else throw e;
  }
  redirect(error ? `/account?error=${encodeURIComponent(error)}` : "/account");
}
