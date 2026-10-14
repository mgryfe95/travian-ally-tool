// Analyse-Skript für die Travian-Wissensdatenbank (Schritt 1, kein Import). Auf einem Rechner MIT Internetzugang ausführen:
//   npx tsx scripts/probe-knowledgebase.ts [startUrl]
// Schreibt Rohdaten + REPORT.md nach ./storage/gamedata-raw/ — diesen Ordner mir zurückgeben, dann baue ich den Parser.
// Höflich: identifizierender User-Agent, robots.txt wird beachtet, 1,5 s Pause, höchstens 6 Seiten.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { allowedByRobots, analyzeHtml } from "../lib/gamedata/probe";

const start = process.argv[2] ?? "https://knowledgebase.legends.travian.com/en-US/buildings";
const out = path.resolve("storage/gamedata-raw");
const UA = "ally-tool-probe/1.0 (privates Allianz-Tool; Analyse der Datenstruktur)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
await mkdir(out, { recursive: true });

const origin = new URL(start).origin;
const robots = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": UA } }).then((r) => (r.ok ? r.text() : "")).catch(() => "");
await writeFile(path.join(out, "robots.txt"), robots);

const report: string[] = [`# Probe ${new Date().toISOString()}`, `Start: ${start}`, `robots.txt: ${robots ? "vorhanden" : "nicht abrufbar/leer"}`, ""];
const queue = [start];
const seen = new Set<string>();
while (queue.length && seen.size < 6) {
  const url = queue.shift()!;
  if (seen.has(url)) continue;
  seen.add(url);
  if (!allowedByRobots(robots, new URL(url).pathname)) {
    report.push(`## ${url}\nvon robots.txt untersagt – übersprungen\n`);
    continue;
  }
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/json" } }).catch((e) => ({ ok: false, status: 0, text: async () => String(e), headers: new Headers() }) as Response);
  const body = await res.text();
  const file = `${seen.size}-${new URL(url).pathname.replace(/[^a-z0-9]+/gi, "_")}.html`;
  await writeFile(path.join(out, file), body);
  const a = analyzeHtml(body, url);
  report.push(
    `## ${url}`, `Status ${res.status} · ${body.length} Bytes · Datei ${file}`, `Titel: ${a.title}`, `Tabellen im HTML: ${a.tables}`,
    `Eingebettetes JSON: ${a.embeddedJson.map((e) => `${e.source} (${e.bytes} B)`).join(", ") || "keins"}`,
    `Daten-Endpunkte: ${a.dataUrls.slice(0, 20).join("\n  ") || "keine gefunden"}`,
    `Links (erste 40): ${a.links.slice(0, 40).join("\n  ")}`, "",
  );
  if (seen.size === 1) queue.push(...a.links.filter((l) => l.startsWith(origin) && /build|resource|unit|troop/i.test(l)).slice(0, 5));
  for (const d of a.dataUrls.slice(0, 2)) if (d.startsWith(origin)) queue.push(d);
  await sleep(1500);
}
await writeFile(path.join(out, "REPORT.md"), report.join("\n"));
console.log(`Fertig. Ergebnis: ${path.join(out, "REPORT.md")}`);
