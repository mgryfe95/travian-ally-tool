import cron from "node-cron";
import { db } from "../lib/db";
import { env } from "../lib/env";
import { capDirectMessages } from "../lib/services/messenger";
import { fetchMapSql, importMapSql, pruneVillageSnapshots } from "../lib/import/importer";
import { getInactiveDays } from "../lib/settings";
import { purgeOldScreenshots } from "../lib/screenshots";
import { checkClaims } from "../lib/services/verification";
import { cleanupOrphanAttachments } from "../lib/chat/cleanup";
import { recordImportOutcome } from "../lib/services/world";
import { releaseCrons } from "../lib/map-release";

const cfg = env();
let running = false;

export async function runImport() {
  if (running) return;
  running = true;
  try {
    const text = await fetchMapSql(cfg.TRAVIAN_SERVER_URL);
    const result = await importMapSql(db, text, { inactiveDays: await getInactiveDays(db), timeZone: cfg.GAME_TIMEZONE });
    console.log("[worker] import", result);
    await recordImportOutcome(db, true);
    if (result.status === "imported") {
      console.log("[worker] umbenennungs-beweise verifiziert:", await checkClaims(db));
      console.log("[worker] alte Dorf-Rohzeilen entfernt:", await pruneVillageSnapshots(db));
    }
  } catch (err) {
    console.error("[worker] import failed", err);
    const world = await recordImportOutcome(db, false).catch(() => undefined);
    if (world?.status === "ended") console.warn("[worker] Spielwelt gilt als beendet (map.sql dauerhaft nicht abrufbar). Daten bleiben als Archiv sichtbar.");
  } finally {
    running = false;
  }
}

// Optionaler zusätzlicher Takt (Standard: aus – map.sql erscheint nur einmal täglich).
if (cfg.IMPORT_CRON) {
  if (!cron.validate(cfg.IMPORT_CRON)) throw new Error(`Invalid IMPORT_CRON: ${cfg.IMPORT_CRON}`);
  cron.schedule(cfg.IMPORT_CRON, () => void runImport());
}
// Gezielt nach der täglichen Veröffentlichung (Release-Zeit +0/+5/+15 Min.): Verifizierungen per Dorfname greifen sofort.
for (const expr of releaseCrons(cfg.MAP_RELEASE_TIME)) cron.schedule(expr, () => void runImport(), { timezone: cfg.GAME_TIMEZONE });
// Verwaiste Chat-Uploads (ohne Nachricht, älter als 24 h) stündlich aufräumen.
cron.schedule("20 3 * * *", () => void purgeOldScreenshots(db, cfg.SCREENSHOT_RETENTION_DAYS).then((n) => n && console.log("[worker] alte Screenshots gelöscht:", n)).catch((e) => console.error("[worker] purge failed", e)));
cron.schedule("30 3 * * *", () => void capDirectMessages(db).then((n) => n && console.log("[worker] alte Direktnachrichten über dem Limit gelöscht:", n)).catch((e) => console.error("[worker] dm cap failed", e)));
cron.schedule("40 * * * *", () => void cleanupOrphanAttachments(db).then((n) => n && console.log("[worker] verwaiste Uploads gelöscht:", n)).catch((e) => console.error("[worker] cleanup failed", e)));
void runImport();
console.log(`[worker] started, daily at ${cfg.MAP_RELEASE_TIME} ${cfg.GAME_TIMEZONE}${cfg.IMPORT_CRON ? `, extra "${cfg.IMPORT_CRON}"` : ""}`);
