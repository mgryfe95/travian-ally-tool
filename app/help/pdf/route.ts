import { readFile } from "node:fs/promises";
import path from "node:path";
import { isLocale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/** Öffentliche Kurzübersicht als PDF (ohne Login). Sprache: `?lang=de|en`, sonst eingestellte Sprache. Dateien: public/help/overview.<sprache>.pdf. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("lang");
  const locale = isLocale(q) ? q : await getLocale();
  const file = await readFile(path.join(process.cwd(), "public", "help", `overview.${locale}.pdf`));
  return new Response(new Uint8Array(file), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="travian-ally-tool-overview.${locale}.pdf"`, "cache-control": "private, max-age=3600" },
  });
}
