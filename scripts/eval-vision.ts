// Misst die Erkennungsgüte gegen die Gold-Beispiele (tests/fixtures/screenshots/*.png + .gold.json). Kostet API-Aufrufe.
//   ANTHROPIC_API_KEY=… [ANTHROPIC_MODEL=…] npx tsx scripts/eval-vision.ts [passes=2] [filter]
// Ausgabe je Bild: Trefferquote der Zahlen (Gold vs. Lesung), berechnete Konfidenz, Auffälligkeiten. Ziel: Trefferquote ≥ 0,99.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ClaudeVision, DEFAULT_MODEL } from "../lib/ai/claude";
import { readingSchema } from "../lib/ai/reading";
import { agreementOf, assess } from "../lib/ai/validate";

const key = process.env.ANTHROPIC_API_KEY;
if (!key) throw new Error("ANTHROPIC_API_KEY fehlt");
const passes = Number(process.argv[2] ?? 2);
const filter = process.argv[3];
const dir = join(import.meta.dirname, "../tests/fixtures/screenshots");
const known = [
  { id: 1, name: "MG Ryfe", x: -3, y: -82 },
  { id: 2, name: "OG Ryfe", x: -7, y: -82 },
  { id: 3, name: "MG", x: -3, y: -83 },
  { id: 4, name: "OG", x: -4, y: -81 },
];
const vision = new ClaudeVision(key, process.env.ANTHROPIC_MODEL || DEFAULT_MODEL);
let sum = 0;
let n = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".gold.json") && (!filter || x.includes(filter)))) {
  const base = f.replace(".gold.json", "");
  const gold = readingSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8")));
  const img = readFileSync(join(dir, `${base}.png`));
  const runs = await Promise.all(Array.from({ length: passes }, () => vision.read(img)));
  const acc = agreementOf(gold, runs[0]!);
  const cons = runs.length > 1 ? agreementOf(runs[0]!, runs[1]!) : 0.9;
  const a = assess(runs[0]!, known, cons);
  sum += acc;
  n++;
  console.log(`${base.padEnd(40)} kind=${runs[0]!.kind === gold.kind ? "ok " : "FALSCH(" + runs[0]!.kind + ")"} treffer=${acc.toFixed(3)} konfidenz=${a.confidence} ${a.issues.map((i) => i.message).join("; ")}`);
}
console.log(`\nØ Trefferquote: ${(sum / Math.max(n, 1)).toFixed(3)} über ${n} Bilder`);
