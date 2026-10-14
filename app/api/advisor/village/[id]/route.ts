import { NextResponse } from "next/server";
import { advise } from "@/lib/ai/advisor";
import { db } from "@/lib/db";
import { handle, unauthorized } from "@/lib/http";
import { getOwnVillage, getVillageInstructions } from "@/lib/services/villages";
import { getCurrentUser } from "@/lib/session";

/** Dorfbezogene Empfehlungen (Phase 1: Stub mit leerer Liste). Fremde Dörfer → 404. */
export function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const id = Number((await params).id);
    const village = Number.isInteger(id) ? await getOwnVillage(db, user.id, id) : null;
    if (!village) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    const me = await db.user.findUnique({ where: { id: user.id }, select: { aiInstructions: true } });
    return NextResponse.json(await advise({
      scope: "village", accountInstructions: me?.aiInstructions ?? "", villageInstructions: await getVillageInstructions(db, user.id, id), context: { villageId: id, state: village.state },
    }));
  });
}
