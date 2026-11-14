import { db } from "@/lib/db";
import { tooMany, unauthorized } from "@/lib/http";
import { AppError, localizeError } from "@/lib/i18n/errors";
import { getLocale } from "@/lib/i18n/server";
import { ForbiddenError } from "@/lib/permissions";
import { createLimiter } from "@/lib/ratelimit";
import { sendChatMessage } from "@/lib/services/aichat";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const limiter = createLimiter(20, 60_000);

/**
 * KI-Chat mit Streaming: Antwort als NDJSON-Ereignisse
 * `{"t":"text","v":"…"}` (Textstück), `{"t":"tool","v":"get_building"}` (Werkzeug läuft), `{"t":"done"}` bzw. `{"t":"error","v":"…"}`.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role === "UNVERIFIED") return unauthorized();
  if (!limiter.check(`aichat:${user.id}`)) return tooMany();
  const b = (await req.json().catch(() => null)) as { chatId?: number; text?: string } | null;
  const locale = await getLocale();
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(ctl) {
      const send = (o: object) => { try { ctl.enqueue(enc.encode(`${JSON.stringify(o)}\n`)); } catch { /* Client weg */ } };
      let streamed = false;
      try {
        const r = await sendChatMessage(db, user, Number(b?.chatId), String(b?.text ?? ""), locale, new Date(), {
          onText: (v) => { streamed = true; send({ t: "text", v }); },
          onTool: (v) => send({ t: "tool", v }),
        });
        if (!streamed && r.answer) send({ t: "text", v: r.answer }); // Befehle, Klärung: Antwort am Stück
        send({ t: "done" });
      } catch (e) {
        if (!(e instanceof AppError || e instanceof ForbiddenError)) console.error("[aichat] Stream fehlgeschlagen", e);
        send({ t: "error", v: localizeError(e instanceof AppError || e instanceof ForbiddenError ? e : new AppError("err.internal"), locale) });
      } finally {
        ctl.close();
      }
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
