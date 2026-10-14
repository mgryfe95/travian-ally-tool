import cron from "node-cron";
import { db } from "../lib/db";
import { env } from "../lib/env";
import { fetchMapSql, importMapSql, pruneVillageSnapshots } from "../lib/import/importer";
import { getInactiveDays } from "../lib/settings";
import { checkClaims } from "../lib/services/verification";
import { cleanupOrphanAttachments } from "../lib/chat/cleanup";
import { recordImportOutcome } from "../lib/services/world";

const cfg = env();
let running = false;

export async function runImport() {
  if (running) return;
  running = true;
  try {
    const text = await fetchMapSql(cfg.TRAVIAN_SERVER_URL);
    const result = await importMapSql(db, text, { inactiveDays: await getInactiveDays(db) });
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

if (!cron.validate(cfg.IMPORT_CRON)) throw new Error(`Invalid IMPORT_CRON: ${cfg.IMPORT_CRON}`);
cron.schedule(cfg.IMPORT_CRON, () => void runImport());
// Verwaiste Chat-Uploads (ohne Nachricht, älter als 24 h) stündlich aufräumen.
cron.schedule("40 * * * *", () => void cleanupOrphanAttachments(db).then((n) => n && console.log("[worker] verwaiste Uploads gelöscht:", n)).catch((e) => console.error("[worker] cleanup failed", e)));
void runImport();
console.log(`[worker] started, schedule "${cfg.IMPORT_CRON}"`);
