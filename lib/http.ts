import { NextResponse } from "next/server";
import { UploadError } from "./chat/attachments";
import { ForbiddenError } from "./permissions";
import { ChatError } from "./services/chat";

/** Übersetzt Fachfehler in HTTP-Antworten (403/4xx), alles andere → 500 ohne Details. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ChatError || e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}

export const unauthorized = () => NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
export const tooMany = () => NextResponse.json({ error: "Zu viele Anfragen, bitte kurz warten." }, { status: 429 });
