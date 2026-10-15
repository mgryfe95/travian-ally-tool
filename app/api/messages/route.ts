import { NextResponse } from "next/server";
import { createLimiter } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { handle, tooMany, unauthorized } from "@/lib/http";
import { sendDm } from "@/lib/services/messenger";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
const limiter = createLimiter(30, 60_000);

/** Direktnachricht senden. Fachfehler (Recht, leer, Empfänger) kommen über `handle` als 4xx. */
export function POST(req: Request) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!limiter.check(`dm:${user.id}`)) return tooMany();
    const b = (await req.json().catch(() => null)) as { threadId?: number; body?: string } | null;
    if (!b || !Number.isInteger(b.threadId) || typeof b.body !== "string") return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    const m = await sendDm(db, user, b.threadId as number, b.body);
    return NextResponse.json({ id: m.id }, { status: 201 });
  });
}
