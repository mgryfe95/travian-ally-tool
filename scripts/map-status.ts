// Map-Import prüfen: npm run map:status [-- --player <Name>] [-- --fetch] [-- --import]
//   ohne Option: Weltstatus + letzte Abrufe (Zeit, Zeilen, Hash)
//   --player <Name>  Dörfer des Spielers im Tool (letzter Import)
//   --fetch          aktuelle map.sql vom Spielserver laden: neu oder schon importiert? (+ Dörfer des Spielers darin)
//   --import         Import jetzt ausführen (wie der Worker)
import { db } from "../lib/db";
import { env } from "../lib/env";
import { fetchMapSql, importMapSql, sha256 } from "../lib/import/importer";
import { releaseCrons } from "../lib/map-release";
import { parseMapSql } from "../lib/mapsql/parser";
import { getWorldStatus, recordImportOutcome } from "../lib/services/world";
import { getInactiveDays } from "../lib/settings";

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const player = args.includes("--player") ? args[args.indexOf("--player") + 1] : undefined;
const cfg = env();
const tz = cfg.GAME_TIMEZONE;
const fmt = (d: Date) => new Intl.DateTimeFormat("de-DE", { timeZone: tz, dateStyle: "short", timeStyle: "medium" }).format(d);

const world = await getWorldStatus(db);
console.log(`Welt: ${cfg.TRAVIAN_SERVER_URL} · Status ${world.status} · Fehlversuche in Folge ${world.failures} · letzter Erfolg ${world.lastSuccessAt ? fmt(world.lastSuccessAt) : "–"}`);
console.log(`Worker-Zeitplan (${tz}): ${releaseCrons(cfg.MAP_RELEASE_TIME).join(" | ")}${cfg.IMPORT_CRON ? ` + "${cfg.IMPORT_CRON}"` : ""}`);
const snaps = await db.snapshot.findMany({ orderBy: { id: "desc" }, take: 7 });
console.log("\nLetzte Importe (neue map.sql):");
for (const s of snaps) console.log(`  ${fmt(s.fetchedAt)}  ${String(s.rowCount).padStart(6)} Dörfer  ${s.hash.slice(0, 12)}`);
if (!snaps.length) console.log("  – noch keiner –");

if (player) {
  const p = await db.player.findFirst({ where: { name: { equals: player, mode: "insensitive" } } });
  const vs = p ? await db.village.findMany({ where: { playerId: p.id }, orderBy: { id: "asc" } }) : [];
  console.log(`\nIm Tool: ${p ? `${p.name} (id ${p.id}) – ${vs.length} Dörfer` : `Spieler "${player}" nicht gefunden`}`);
  for (const v of vs) console.log(`  ${v.name} (${v.x}|${v.y}) ${v.population} EW`);
}

if (flag("--fetch") || flag("--import")) {
  const t0 = Date.now();
  const text = await fetchMapSql(cfg.TRAVIAN_SERVER_URL);
  const hash = sha256(text);
  const known = await db.snapshot.findUnique({ where: { hash } });
  const rows = parseMapSql(text);
  console.log(`\nLive map.sql: ${rows.length} Dörfer, ${hash.slice(0, 12)}, ${Date.now() - t0} ms → ${known ? `schon importiert am ${fmt(known.fetchedAt)}` : "NEU (noch nicht importiert)"}`);
  if (player) {
    const mine = rows.filter((r) => r.playerName.toLowerCase() === player.toLowerCase());
    console.log(`  ${player} in der Live-Datei: ${mine.length} Dörfer${mine.length ? ` – ${mine.map((r) => `${r.villageName} (${r.x}|${r.y})`).join(", ")}` : ""}`);
  }
  if (flag("--import")) {
    const r = await importMapSql(db, text, { inactiveDays: await getInactiveDays(db), timeZone: tz });
    await recordImportOutcome(db, true);
    console.log("Import:", r);
  }
}
await db.$disconnect();
