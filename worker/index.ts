import cron from "node-cron";
import { db } from "../lib/db";
import { env } from "../lib/env";
import { fetchMapSql, importMapSql } from "../lib/import/importer";
import { getInactiveDays } from "../lib/settings";

const cfg = env();
let running = false;

export async function runImport() {
  if (running) return;
  running = true;
  try {
    const text = await fetchMapSql(cfg.TRAVIAN_SERVER_URL);
    const result = await importMapSql(db, text, { inactiveDays: await getInactiveDays(db) });
    console.log("[worker] import", result);
  } catch (err) {
    console.error("[worker] import failed", err);
  } finally {
    running = false;
  }
}

if (!cron.validate(cfg.IMPORT_CRON)) throw new Error(`Invalid IMPORT_CRON: ${cfg.IMPORT_CRON}`);
cron.schedule(cfg.IMPORT_CRON, () => void runImport());
void runImport();
console.log(`[worker] started, schedule "${cfg.IMPORT_CRON}"`);
