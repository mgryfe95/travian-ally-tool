import { EXPECTED_CELLS, type Reading, type ReadingKind } from "./reading";

export type Issue = { level: "hard" | "soft"; message: string };
export type KnownVillage = { id: number; name: string; x: number; y: number };
export type Assessment = { confidence: number; issues: Issue[]; village: KnownVillage | null; matched: Record<string, number> };

const MAX_COORD = 1000;
const STATS_KINDS = ["VILLAGE_TROOPS", "VILLAGE_TROOPS_PRESENT", "VILLAGE_RESOURCES", "VILLAGE_PRODUCTION", "VILLAGE_CULTURE", "VILLAGE_SMITHY", "VILLAGE_HOSPITAL", "VILLAGE_TRAINING"];
const sumCol = (rows: number[][], i: number) => rows.reduce((s, r) => s + (r[i] ?? 0), 0);
const num = (v: number | null): v is number => typeof v === "number" && Number.isFinite(v);

/** Deterministische Prüfungen: das Maß für die Konfidenz. Die KI-Selbstauskunft deckelt nur nach oben. */
export function assess(r: Reading, known: KnownVillage[] = [], agreement = 1): Assessment {
  const issues: Issue[] = [];
  const hard = (m: string) => issues.push({ level: "hard", message: m });
  const soft = (m: string) => issues.push({ level: "soft", message: m });
  const byCoord = new Map(known.map((v) => [`${v.x}|${v.y}`, v]));
  const byName = new Map(known.map((v) => [v.name.trim().toLowerCase(), v]));
  const matched: Record<string, number> = {};

  if (r.kind === "UNKNOWN") hard("Screenshot-Art nicht erkannt");
  for (const row of r.rows) {
    if (row.x === null && row.y === null && row.name && !row.name.startsWith("summary:") && STATS_KINDS.includes(r.kind)) {
      // Desktop-Statistiktabellen nennen nur den Dorfnamen → über die eigenen Dörfer zuordnen
      const k = byName.get(row.name.trim().toLowerCase());
      if (k) {
        matched[`${k.x}|${k.y}`] = k.id;
        row.x = k.x;
        row.y = k.y;
      } else if (known.length) soft(`Dorf „${row.name}“ nicht zugeordnet`);
    }
    if (row.x !== null && row.y !== null) {
      if (Math.abs(row.x) > MAX_COORD || Math.abs(row.y) > MAX_COORD) hard(`Koordinaten unplausibel: ${row.x}|${row.y}`);
      const k = byCoord.get(`${row.x}|${row.y}`);
      if (k) matched[`${row.x}|${row.y}`] = k.id;
      else if (known.length && STATS_KINDS.includes(r.kind)) soft(`Dorf ${row.name ?? ""} (${row.x}|${row.y}) gehört nicht zu deinem Konto`);
    }
  }

  const expected = EXPECTED_CELLS[r.kind];
  if (expected) {
    for (const row of r.rows.filter((x) => !x.name?.startsWith("summary:"))) if (!expected.includes(row.cells.length)) hard(`„${row.name ?? "?"}“: ${row.cells.length} Spalten statt ${expected.join(" oder ")}`);
    if (r.rows.length === 0) hard("Keine Zeilen erkannt");
    if (r.rows.some((x) => x.cells.some((c) => !num(c) && c !== null))) hard("Nicht-numerischer Wert");
  }
  if (STATS_KINDS.includes(r.kind) && r.rows.some((x) => x.x === null || x.y === null) && !known.length) soft("Dörfer ohne Koordinaten – Zuordnung nicht prüfbar");

  // Summenzeile muss zu den Dörfern passen (stärkstes Signal gegen verlesene Ziffern)
  if (r.totals && (["VILLAGE_TROOPS", "VILLAGE_RESOURCES", "VILLAGE_PRODUCTION", "VILLAGE_CULTURE"] as ReadingKind[]).includes(r.kind)) {
    const rows = r.rows.map((x) => x.cells.map((c) => c ?? 0));
    r.totals.cells.forEach((t, i) => {
      if (!num(t)) return;
      const sum = sumCol(rows, i);
      // Lagerbestände ticken zwischen den Zeilen und der Summenzeile weiter → Toleranz 1 %; alles andere muss exakt stimmen
      const tol = r.kind === "VILLAGE_RESOURCES" && i < 4 ? Math.max(100, Math.abs(t) * 0.01) : 0;
      if (Math.abs(sum - t) > tol) hard(`Summe Spalte ${i + 1}: ${sum} ≠ ${t}`);
    });
  } else if (["VILLAGE_TROOPS", "VILLAGE_RESOURCES"].includes(r.kind) && r.rows.length > 1) soft("Keine Summenzeile zum Gegenprüfen");

  if (r.kind === "VILLAGE_TROOPS" || r.kind === "RALLY_POINT") {
    for (const row of r.rows) if (row.cells.some((c) => num(c) && c < 0)) hard("Negative Truppenzahl");
  }
  if (r.kind === "RESOURCE_VIEW") {
    if (r.fields.length !== 18) (r.fields.length >= 14 ? soft : hard)(`${r.fields.length} von 18 Rohstofffeldern erkannt`);
    if (r.fields.some((f) => f.level < 0 || f.level > 25)) hard("Feldstufe außerhalb 0–25");
  }
  if (r.kind === "VILLAGE_VIEW") {
    if (r.buildings.length === 0) hard("Keine Gebäude erkannt");
    if (r.buildings.some((b) => b.level < 0 || b.level > 25)) hard("Gebäudestufe außerhalb 0–25");
  }
  if (r.kind === "VILLAGE_RESOURCES" && r.topBar && r.rows.some((x) => x.cells.length === 8)) {
    const cur = r.rows.find((x) => x.current) ?? r.rows[0];
    // Kopfleiste ändert sich laufend (Produktion/Std.) – Abweichung > 1 % zur Zeile ist ein Lesefehler
    if (cur && r.topBar.wood !== null && cur.cells[0] !== null && Math.abs((cur.cells[0] ?? 0) - r.topBar.wood) > Math.max(50, r.topBar.wood * 0.01)) soft("Kopfleiste und Dorfzeile weichen ab");
  }
  if (r.kind === "BATTLE_REPORT") {
    const roles = new Set(r.rows.map((x) => x.name ?? ""));
    for (const need of ["attacker_units", "defender_units"]) if (!roles.has(need)) hard(`Kampfbericht: Zeile „${need}“ fehlt`);
    for (const side of ["attacker", "defender"]) {
      const u = r.rows.find((x) => x.name === `${side}_units`);
      const l = r.rows.find((x) => x.name === `${side}_losses`);
      if (u && l) {
        if (u.cells.length !== l.cells.length) hard(`${side}: Verluste/Einheiten unterschiedlich lang`);
        else if (u.cells.some((c, i) => (l.cells[i] ?? 0) > (c ?? 0))) hard(`${side}: Verluste größer als Einheiten`);
      }
    }
  }

  const unc = Math.min(r.uncertain.length, 4);
  let c = 1;
  for (const i of issues) c *= i.level === "hard" ? 0.45 : 0.9;
  c *= 0.93 ** unc;
  c *= Math.max(0, Math.min(1, agreement));
  c = Math.min(c, Math.max(0, Math.min(1, r.selfRating)));
  const v = r.village && r.village.x !== null && r.village.y !== null ? byCoord.get(`${r.village.x}|${r.village.y}`) ?? null : null;
  return { confidence: Math.round(c * 1000) / 1000, issues, village: v, matched };
}

/** Anteil gleicher Zahlen zwischen zwei Durchläufen (Konsens). 1 = identisch. */
export function agreementOf(a: Reading, b: Reading): number {
  if (a.kind !== b.kind) return 0;
  const flat = (r: Reading) => [
    ...r.rows.flatMap((x) => [x.x, x.y, ...x.cells]),
    ...(r.totals?.cells ?? []),
    // Felder/Gebäude: Reihenfolge bei gleicher Höhe ist mehrdeutig → als Multimenge vergleichen
    ...r.fields.map((f) => f.level).sort((p, q) => p - q),
    ...r.buildings.map((x) => x.level).sort((p, q) => p - q),
    ...(r.topBar ? [r.topBar.wood, r.topBar.clay, r.topBar.iron, r.topBar.crop] : []),
  ];
  const fa = flat(a);
  const fb = flat(b);
  const len = Math.max(fa.length, fb.length);
  if (len === 0) return 1;
  let same = 0;
  for (let i = 0; i < len; i++) if (fa[i] === fb[i]) same++;
  return same / len;
}
