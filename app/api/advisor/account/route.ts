import { NextResponse } from "next/server";
import { advise } from "@/lib/ai/advisor";
import { db } from "@/lib/db";
import { handle, unauthorized } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";

/** Accountweite Empfehlungen (Phase 1: Stub mit leerer Liste). */
export function POST() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const me = await db.user.findUnique({ where: { id: user.id }, select: { aiInstructions: true } });
    return NextResponse.json(await advise({ scope: "account", accountInstructions: me?.aiInstructions ?? "", context: {} }));
  });
}
