import { Thumb } from "@/components/Thumb";
import { RetractButton } from "@/components/RetractButton";
import { ScreenshotReview } from "@/components/ScreenshotReview";
import { UploadBox } from "@/components/UploadBox";
import type { ParsedShot } from "@/lib/ai/pipeline";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getT } from "@/lib/i18n/server";
import { translate, type MessageKey } from "@/lib/i18n";
import { loadBuildingNameSets } from "@/lib/gamedata/names";
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
  const nameSets = await loadBuildingNameSets(db, locale);
  const kindLabels = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, t(v)]));
  const own = await ownVillages(db, user.id);
  const tribeOf = new Map((await db.player.findMany({ where: { id: { in: [...new Set(own.map((v) => v.playerId))] } }, select: { id: true, tribe: true } })).map((p) => [p.id, p.tribe]));
  const villages = own.map((v) => ({ id: v.id, label: `${v.name} (${v.x}|${v.y})`, tribe: tribeOf.get(v.playerId) }));
  // Lern-Beispiele: eigene (Admins: alle), mit zugehörigem Screenshot für die Vorschau
  const examples = await db.visionExample.findMany({ where: user.role === "ADMIN" ? {} : { createdBy: user.id }, orderBy: { createdAt: "desc" }, take: 40 });
  const exShots = await db.screenshot.findMany({ where: { storageKey: { in: examples.map((e) => e.storageKey) }, removedAt: null }, select: { id: true, storageKey: true, thumbKey: true } });
  const exampleAuthors = new Map((await db.user.findMany({ where: { id: { in: [...new Set(examples.map((e) => e.createdBy))] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const shotOf = new Map(exShots.map((x) => [x.storageKey, x]));
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
            {s.status === "needs_review" && p.reading && <ScreenshotReview id={s.id} reading={p.reading} issues={(p.issues ?? []).map((i) => ({ level: i.level, message: i.key ? translate(locale, i.key, i.params) : i.message }))} villages={villages} defaultVillageId={s.villageId ?? undefined} nameSets={nameSets} kindLabels={kindLabels} />}
            {s.status === "parsed" && p.confirmedBy && !s.removedAt && <RetractButton id={s.id} />}
          </section>
        );
      })}
    {examples.length > 0 && (
        <section className="card" aria-labelledby="ex-h">
          <h2 id="ex-h">{t("screenshots.examples.title")}</h2>
          <p className="sub" style={{ fontSize: 12, margin: "4px 0 10px" }}>{t("screenshots.examples.intro", { n: 30 })}</p>
          {examples.map((e) => {
            const sh = shotOf.get(e.storageKey);
            return (
              <details key={e.id} style={{ borderTop: "1px solid var(--line2)", padding: "8px 0" }}>
                <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                  {sh?.thumbKey ? <Thumb src={`/api/screenshots/${sh.id}/file?v=thumb`} size={40} /> : null}
                  <strong>{kindLabel(e.kind)}</strong>
                  <span className="sub" style={{ fontSize: 12 }}>{e.createdAt.toLocaleDateString(locale === "en" ? "en-GB" : "de-DE")}{e.createdBy !== user.id ? ` · ${t("screenshots.examples.of", { user: exampleAuthors.get(e.createdBy) ?? "?" })}` : ""}</span>
                </summary>
                <div style={{ marginTop: 8 }}>
                  <ScreenshotReview id={sh?.id ?? 0} exampleId={e.id} reading={e.gold} issues={[]} villages={[]} nameSets={nameSets} kindLabels={kindLabels} />
                </div>
              </details>
            );
          })}
        </section>
      )}
    </>
  );
}
