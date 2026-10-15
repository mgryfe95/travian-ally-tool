import { NextResponse } from "next/server";
import { UploadError } from "./chat/attachments";
import type { MessageKey } from "./i18n";
import { AppError, localizeError } from "./i18n/errors";
import { getLocale } from "./i18n/server";
import { ForbiddenError } from "./permissions";
import { ChatError } from "./services/chat";

/** Antwort mit lokalisiertem Fehlertext (Sprache: Konto > Cookie > Accept-Language). */
export async function errorResponse(key: MessageKey, status: number): Promise<Response> {
  return NextResponse.json({ error: localizeError(new AppError(key), await getLocale()) }, { status });
}

/** Übersetzt Fachfehler in HTTP-Antworten (403/4xx), alles andere → 500 ohne Details. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    const locale = await getLocale();
    if (e instanceof ForbiddenError) return NextResponse.json({ error: localizeError(e, locale) }, { status: 403 });
    if (e instanceof ChatError || e instanceof UploadError) return NextResponse.json({ error: localizeError(e, locale) }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: localizeError(new AppError("err.internal"), locale) }, { status: 500 });
  }
}

export const unauthorized = () => errorResponse("err.unauthorized", 401);
export const tooMany = () => errorResponse("err.tooManyRequests", 429);
