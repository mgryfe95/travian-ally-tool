import { Thumb } from "@/components/Thumb";
import { ScreenshotReview } from "@/components/ScreenshotReview";
import { UploadBox } from "@/components/UploadBox";
import type { ParsedShot } from "@/lib/ai/pipeline";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ownVillages } from "@/lib/services/villages";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { uploaded: "hochgeladen", needs_review: "wartet auf Prüfung", parsed: "übernommen", failed: "Fehler", rejected: "verworfen" };

export default async function ScreenshotsPage() {
  const user = await requireUser();
  const shots = await db.screenshot.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 });
  const confirmed = await db.visionExample.groupBy({ by: ["kind"], _count: true });
  const need = env().VISION_LEARNING_MIN;
  const villages = (await ownVillages(db, user.id)).map((v) => ({ id: v.id, label: `${v.name} (${v.x}|${v.y})` }));
  return (
    <>
      <header>
        <div className="sub">Screenshots</div>
        <h1>Screenshots prüfen</h1>
        <p className="sub" style={{ marginTop: 4 }}>
          Die Erkennung liest Werte aus deinen Screenshots. Im Lernmodus bestätigst du die Lesung – jede Bestätigung macht die Erkennung genauer. Nach {need} bestätigten Screenshots einer Art werden sehr sichere Lesungen automatisch übernommen.
          Deine Screenshots können als Beispiele für die Erkennung aller Mitglieder dienen.
        </p>
      </header>
      <section className="card"><UploadBox id="shot-any" label="Screenshot hochladen oder einfügen (Strg+V)" hint="Art und Gerät werden erkannt" /></section>
      {confirmed.length > 0 && <p className="sub">Bestätigt je Art: {confirmed.map((c) => `${c.kind} ${c._count}/${need}`).join(" · ")}</p>}
      {shots.map((s) => {
        const p = (s.parsed ?? {}) as ParsedShot;
        return (
          <section key={s.id} className="card" aria-label={`Screenshot ${s.id}`}>
            <div className="row between">
              <span className="row" style={{ gap: 10 }}>
                {s.thumbKey ? <Thumb src={`/api/screenshots/${s.id}/file?v=thumb`} size={48} /> : null}
                <strong>{s.detectedKind}</strong>
              </span>
              <span className="sub">{STATUS[s.status] ?? s.status}{s.confidence !== null ? ` · Konfidenz ${Math.round(s.confidence * 100)} %` : ""}</span>
            </div>
            {p.error && <p className="errtext">{p.error}</p>}
            {s.status === "needs_review" && p.reading && <ScreenshotReview id={s.id} reading={p.reading} issues={p.issues ?? []} villages={villages} defaultVillageId={s.villageId ?? undefined} />}
          </section>
        );
      })}
    </>
  );
}
