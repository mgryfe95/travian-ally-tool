import { NextResponse } from "next/server";
import { getLocale } from "@/lib/i18n/server";
import { AppError, localizeError } from "@/lib/i18n/errors";
import { createLimiter } from "@/lib/ratelimit";
import { registerUser, RegisterError } from "@/lib/services/register";

const limiter = createLimiter(5, 10 * 60_000);

export async function POST(req: Request) {
  const locale = await getLocale();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!limiter.check(ip)) return NextResponse.json({ error: localizeError(new AppError("err.tooManyAttempts"), locale) }, { status: 429 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: localizeError(new AppError("err.badRequest"), locale) }, { status: 400 });
  }
  try {
    const r = await registerUser(body);
    const res = NextResponse.json({ ok: true, verified: r.verified, warning: r.warningError ? localizeError(r.warningError, locale) : r.warning });
    for (const c of r.setCookie) res.headers.append("set-cookie", c);
    return res;
  } catch (e) {
    if (e instanceof RegisterError) return NextResponse.json({ error: localizeError(e, locale) }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: localizeError(new AppError("err.internal"), locale) }, { status: 500 });
  }
}
