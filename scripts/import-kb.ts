// Spieldaten (Gebäude) aus der Legends-Wissensdatenbank importieren – aus einer lokal gespeicherten main.js der Seite:
//   npx tsx scripts/import-kb.ts <main.js> [--dry-run]
// Es wird nur gelesen (kein Code der Datei wird ausgeführt). Import nur, wenn Welt/Version/Geschwindigkeit zur eigenen Welt passen.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { db } from "../lib/db";
import { env } from "../lib/env";
import { GameDataError, importGameData } from "../lib/gamedata/import";
import { KbError, kbToGameData, parseKnowledgeBase } from "../lib/gamedata/kb";
import { worldProfile } from "../lib/world-profile";

const [file, flag] = process.argv.slice(2);
if (!file) throw new Error("usage: tsx scripts/import-kb.ts <main.js> [--dry-run]");
const world = worldProfile(env().TRAVIAN_SERVER_URL, { version: env().GAME_VERSION, speed: env().GAME_SPEED });
try {
  if (world.version !== "legends") throw new KbError(`Die Quelle ist die Legends-Wissensdatenbank, die Welt ist aber „${world.version}“ – kein Import`);
  const js = readFileSync(file, "utf8");
  const data = kbToGameData(parseKnowledgeBase(js), world, `https://knowledgebase.legends.travian.com/main.js (abgerufen ${new Date().toISOString().slice(0, 10)}, sha256 ${createHash("sha256").update(js).digest("hex").slice(0, 16)})`);
  const levels = data.buildings.reduce((n, b) => n + b.levels.length, 0);
  console.log(`Gelesen: ${data.buildings.length} Gebäude, ${levels} Stufen, ${data.tribes.length} Völker · Welt ${world.host} · ${world.version} · x${world.speed}`);
  if (flag === "--dry-run") {
    writeFileSync("gamedata-from-kb.json", JSON.stringify(data, null, 1));
    console.log("Trockenlauf: gamedata-from-kb.json geschrieben, nichts importiert.");
  } else console.log(await importGameData(db, data, world));
} catch (e) {
  if (e instanceof KbError || e instanceof GameDataError) {
    console.error("Abgelehnt:\n" + e.message);
    process.exitCode = 1;
  } else throw e;
} finally {
  await db.$disconnect();
}
