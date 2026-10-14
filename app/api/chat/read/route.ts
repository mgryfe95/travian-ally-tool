import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, unauthorized } from "@/lib/http";
import { chatCtx, markRead } from "@/lib/services/chat";
import { getCurrentUser } from "@/lib/session";

export function POST(req: Request) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const b = (await req.json().catch(() => null)) as { channelId?: number } | null;
    if (typeof b?.channelId !== "number") return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    await markRead(db, await chatCtx(db, user), b.channelId);
    return NextResponse.json({ ok: true });
  });
}
