import { NextResponse } from "next/server";
import { createLimiter } from "@/lib/ratelimit";
import { registerUser, RegisterError } from "@/lib/services/register";

const limiter = createLimiter(5, 10 * 60_000);

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!limiter.check(ip)) return NextResponse.json({ error: "Zu viele Versuche, bitte später erneut." }, { status: 429 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  try {
    const r = await registerUser(body);
    const res = NextResponse.json({ ok: true, verified: r.verified, warning: r.warning });
    for (const c of r.setCookie) res.headers.append("set-cookie", c);
    return res;
  } catch (e) {
    if (e instanceof RegisterError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
