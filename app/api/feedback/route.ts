import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, tooMany, unauthorized } from "@/lib/http";
import { createLimiter } from "@/lib/ratelimit";
import { createFeedback, listFeedback, type FeedbackStatus } from "@/lib/services/feedback";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
const limiter = createLimiter(60, 60_000);

/** Beta-Feedback lesen: `?status=open|closed|all&path=/…`; `&download=1` liefert eine JSON-Datei. */
export function GET(req: Request) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const q = new URL(req.url).searchParams;
    const status = (["open", "closed", "all"].includes(q.get("status") ?? "") ? q.get("status") : "all") as FeedbackStatus | "all";
    const threads = await listFeedback(db, user, { status, path: q.get("path") || undefined });
    if (q.get("download") !== "1") return NextResponse.json({ threads });
    const body = JSON.stringify({ exportedAt: new Date().toISOString(), status, threads }, null, 2);
    return new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="beta-feedback-${status}-${new Date().toISOString().slice(0, 10)}.json"` } });
  });
}

/** Neuer Kommentar-Thread zu einem Element. */
export function POST(req: Request) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!limiter.check(`fb:${user.id}`)) return tooMany();
    const b = (await req.json().catch(() => null)) as { path?: string; selector?: string; label?: string; body?: string } | null;
    const t = await createFeedback(db, user, { path: String(b?.path ?? ""), selector: String(b?.selector ?? ""), label: String(b?.label ?? ""), body: String(b?.body ?? "") });
    return NextResponse.json({ id: t.id }, { status: 201 });
  });
}
