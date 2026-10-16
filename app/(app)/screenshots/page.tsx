import { Thumb } from "@/components/Thumb";
import { ScreenshotReview } from "@/components/ScreenshotReview";
import { UploadBox } from "@/components/UploadBox";
import type { ParsedShot } from "@/lib/ai/pipeline";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getT } from "@/lib/i18n/server";
import { translate, type MessageKey } from "@/lib/i18n";
import { ownVillages } from "@/lib/services/villages";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const STATUS: Record<string, MessageKey> = {
  uploaded: "screenshots.status.uploaded", needs_review: "screenshots.status.needs_review", parsed: "screenshots.status.parsed", failed: "screenshots.status.failed", rejected: "screenshots.status.rejected",
};
const KINDS: Record<string, MessageKey> = {
  RALLY_POINT: "screenshots.kind.RALLY_POINT", VILLAGE_TROOPS: "screenshots.kind.VILLAGE_TROOPS", VILLAGE_TROOPS_PRESENT: "screenshots.kind.VILLAGE_TROOPS_PRESENT",
  VILLAGE_TRAINING: "screenshots.kind.VILLAGE_TRAINING", VILLAGE_SMITHY: "screenshots.kind.VILLAGE_SMITHY", VILLAGE_HOSPITAL: "screenshots.kind.VILLAGE_HOSPITAL",
  VILLAGE_CULTURE: "screenshots.kind.VILLAGE_CULTURE", VILLAGE_RESOURCES: "screenshots.kind.VILLAGE_RESOURCES", VILLAGE_PRODUCTION: "screenshots.kind.VILLAGE_PRODUCTION",
  RESOURCE_VIEW: "screenshots.kind.RESOURCE_VIEW", VILLAGE_VIEW: "screenshots.kind.VILLAGE_VIEW", BATTLE_REPORT: "screenshots.kind.BATTLE_REPORT", UNKNOWN: "screenshots.kind.UNKNOWN",
};

export default async function ScreenshotsPage() {
  const { t, locale } = await getT();
  const kindLabel = (k: string | null) => (k && KINDS[k] ? t(KINDS[k] as MessageKey) : k);
  const user = await requireUser();
  const shots = await db.screenshot.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 });
  const confirmed = await db.visionExample.groupBy({ by: ["kind"], _count: true });
  const need = env().VISION_LEARNING_MIN;
  const villages = (await ownVillages(db, user.id)).map((v) => ({ id: v.id, label: `${v.name} (${v.x}|${v.y})` }));
  return (
    <>
      <header>
        <div className="sub">{t("screenshots.crumb")}</div>
        <h1>{t("screenshots.title")}</h1>
        <p className="sub" style={{ marginTop: 4 }}>
          {t("screenshots.intro", { need })}{" "}
          {t("screenshots.introShare")}
        </p>
      </header>
      <section className="card"><UploadBox id="shot-any" label={t("screenshots.uploadLabel")} hint={t("screenshots.uploadHint")} /></section>
      {confirmed.length > 0 && <p className="sub">{t("screenshots.confirmedPerKind", { list: confirmed.map((c) => `${kindLabel(c.kind)} ${c._count}/${need}`).join(" · ") })}</p>}
      {shots.map((s) => {
        const p = (s.parsed ?? {}) as ParsedShot;
        return (
          <section key={s.id} className="card" aria-label={t("screenshots.itemLabel", { id: s.id })}>
            <div className="row between">
              <span className="row" style={{ gap: 10 }}>
                {s.thumbKey && !s.removedAt ? <Thumb src={`/api/screenshots/${s.id}/file?v=thumb`} size={48} /> : null}
                <strong>{kindLabel(s.detectedKind)}</strong>
              </span>
              <span className="sub">{STATUS[s.status] ? t(STATUS[s.status] as MessageKey) : s.status}{s.confidence !== null ? ` · ${t("screenshots.confidence", { pct: Math.round(s.confidence * 100) })}` : ""}</span>
            </div>
            {(p.errorKey || p.error) && <p className="errtext">{p.errorKey ? translate(locale, p.errorKey, p.errorParams) : p.error}</p>}
            {s.status === "needs_review" && p.reading && <ScreenshotReview id={s.id} reading={p.reading} issues={(p.issues ?? []).map((i) => ({ level: i.level, message: i.key ? translate(locale, i.key, i.params) : i.message }))} villages={villages} defaultVillageId={s.villageId ?? undefined} />}
          </section>
        );
      })}
    </>
  );
}
