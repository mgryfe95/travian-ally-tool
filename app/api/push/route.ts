import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, tooMany, unauthorized } from "@/lib/http";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { vapidPublicKey } from "@/lib/notify/push";
import { createLimiter } from "@/lib/ratelimit";
import { deleteSubscription, saveSubscription, sendTestPush } from "@/lib/services/notify";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
const limiter = createLimiter(20, 60_000);

/** Öffentlicher VAPID-Schlüssel (null = Push auf dem Server aus). */
export function GET() {
  return NextResponse.json({ publicKey: vapidPublicKey() });
}

/** Gerät anmelden (`{subscription}`), abmelden (`{unsubscribe: endpoint}`) oder Test senden (`{test: true}`). */
export function POST(req: Request) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user || user.role === "UNVERIFIED") return unauthorized();
    if (!limiter.check(`push:${user.id}`)) return tooMany();
    const b = (await req.json().catch(() => null)) as { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; unsubscribe?: string; test?: boolean } | null;
    if (b?.test) return NextResponse.json({ sent: await sendTestPush(db, user.id, isLocale(user.locale) ? user.locale : DEFAULT_LOCALE) });
    if (typeof b?.unsubscribe === "string") {
      await deleteSubscription(db, user.id, b.unsubscribe);
      return NextResponse.json({ ok: true });
    }
    const s = b?.subscription;
    try {
      await saveSubscription(db, user.id, { endpoint: String(s?.endpoint ?? ""), p256dh: String(s?.keys?.p256dh ?? ""), auth: String(s?.keys?.auth ?? ""), userAgent: req.headers.get("user-agent") ?? "" });
    } catch {
      return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
