// Manueller Import der Spieldaten (nur aus freigegebener Quelle):
//   npx tsx scripts/import-gamedata.ts <datei.json>
// Format: docs/gamedata-format.md
import { readFileSync } from "node:fs";
import { db } from "../lib/db";
import { GameDataError, importGameData } from "../lib/gamedata/import";

const file = process.argv[2];
if (!file) throw new Error("usage: tsx scripts/import-gamedata.ts <datei.json>");
try {
  console.log(await importGameData(db, JSON.parse(readFileSync(file, "utf8"))));
} catch (e) {
  if (e instanceof GameDataError) {
    console.error("Import abgelehnt:\n" + e.message);
    process.exitCode = 1;
  } else throw e;
} finally {
  await db.$disconnect();
}
