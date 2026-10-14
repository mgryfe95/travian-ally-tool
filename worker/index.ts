import cron from "node-cron";
import { env } from "../lib/env";

const cfg = env();

// map.sql-Import folgt in M2 (blockiert, bis das echte Spaltenformat verifiziert ist).
async function runImport() {
  console.log(`[worker] import tick for ${cfg.TRAVIAN_SERVER_URL}/map.sql (noch nicht implementiert)`);
}

if (!cron.validate(cfg.IMPORT_CRON)) throw new Error(`Invalid IMPORT_CRON: ${cfg.IMPORT_CRON}`);
cron.schedule(cfg.IMPORT_CRON, () => void runImport());
console.log(`[worker] started, schedule "${cfg.IMPORT_CRON}"`);
