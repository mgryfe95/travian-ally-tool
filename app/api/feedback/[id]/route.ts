import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, tooMany, unauthorized } from "@/lib/http";
import { createLimiter } from "@/lib/ratelimit";
import { replyFeedback, setFeedbackStatus } from "@/lib/services/feedback";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
const limiter = createLimiter(60, 60_000);

/** Antwort im Thread. */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!limiter.check(`fb:${user.id}`)) return tooMany();
    const b = (await req.json().catch(() => null)) as { body?: string } | null;
    const c = await replyFeedback(db, user, Number((await params).id), String(b?.body ?? ""));
    return NextResponse.json({ id: c.id }, { status: 201 });
  });
}

/** Status setzen: `{ status: "open" | "closed" }`. */
export function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const b = (await req.json().catch(() => null)) as { status?: string } | null;
    await setFeedbackStatus(db, user, Number((await params).id), b?.status === "closed" ? "closed" : "open");
    return NextResponse.json({ ok: true });
  });
}
