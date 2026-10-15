// Einheitennamen je Volk aus dem Support-Artikel „Infantry and Cavalry Units comparison table“ (nur Namen):
//   npx tsx scripts/import-unit-names.ts <en.html> [de.html] [--overrides namen.json] [--template namen.json] [--dry-run]
//   --template schreibt eine Vorlage (Plätze 1–10 je Volk, englische Namen aus der Quelle, deutsche Namen zum Ausfüllen); --overrides liest sie wieder ein.
// Die HTML-Dateien stammen vom Probe-Skript (docs/DEPLOY.md). Es wird nur gelesen; Welt/Version müssen zur eigenen Welt passen (Legends).
import { readFileSync, writeFileSync } from "node:fs";
import { db } from "../lib/db";
import { env } from "../lib/env";
import { applyOverrides, mergeLanguages, overridesTemplate, parseUnitTables, UnitsError, type NameOverrides } from "../lib/gamedata/units";
import { worldProfile } from "../lib/world-profile";

const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf(name); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const overridesFile = opt("--overrides");
const templateFile = opt("--template");
const dry = args.includes("--dry-run");
const [enFile, deFile] = args.filter((a) => !a.startsWith("--"));
if (!enFile) throw new Error("usage: tsx scripts/import-unit-names.ts <en.html> [de.html] [--dry-run]");
try {
  const world = worldProfile(env().TRAVIAN_SERVER_URL, { version: env().GAME_VERSION, speed: env().GAME_SPEED });
  if (world.version !== "legends") throw new UnitsError(`Die Quelle ist das Legends Help Center, die Welt ist aber „${world.version}“ – kein Import`);
  let rows = mergeLanguages(parseUnitTables(readFileSync(enFile, "utf8")), deFile ? parseUnitTables(readFileSync(deFile, "utf8")) : undefined);
  if (templateFile) {
    writeFileSync(templateFile, JSON.stringify(overridesTemplate(rows, overridesFile ? (JSON.parse(readFileSync(overridesFile, "utf8")) as NameOverrides) : {}), null, 1));
    console.log(`Vorlage geschrieben: ${templateFile} – deutsche Namen (und Plätze 7–10 mit en + de) ausfüllen, dann mit --overrides importieren.`);
    process.exit(0);
  }
  if (overridesFile) rows = applyOverrides(rows, JSON.parse(readFileSync(overridesFile, "utf8")) as NameOverrides);
  const tribes = new Set(rows.map((r) => r.tribeVid)).size;
  console.log(`Gelesen: ${rows.length} Einheiten, ${tribes} Völker, Deutsch: ${rows.filter((r) => r.nameDe).length} von ${rows.length}`);
  for (const r of rows.filter((x) => x.slot <= 2)) console.log(`  Volk ${r.tribeVid} Platz ${r.slot}: ${r.nameEn}${r.nameDe ? ` / ${r.nameDe}` : ""}`);
  if (!dry) {
    const source = `https://support.travian.com/en/articles/187-infantry-and-cavalry-units-comparison-table (abgerufen ${new Date().toISOString().slice(0, 10)})`;
    for (const r of rows) await db.unitName.upsert({ where: { tribeVid_slot: { tribeVid: r.tribeVid, slot: r.slot } }, create: { ...r, gameVersion: world.version, source }, update: { ...r, gameVersion: world.version, source } });
    console.log("Importiert.");
  } else console.log("Trockenlauf: nichts geschrieben.");
} catch (e) {
  if (e instanceof UnitsError) {
    console.error("Abgelehnt: " + e.message);
    process.exitCode = 1;
  } else throw e;
} finally {
  await db.$disconnect();
}
