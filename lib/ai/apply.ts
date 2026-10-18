import type { Prisma, PrismaClient } from "@prisma/client";
import type { Reading, ReadingRow } from "./reading";
import type { KnownVillage } from "./validate";
import type { TroopEntry } from "../troops";

export type Applied = { villageId: number; areas: string[] };

const unitName = (i: number, n: number) => (n === 11 && i === 10 ? "Held" : `Einheit ${i + 1}`);
const toEntries = (cells: (number | null)[]): TroopEntry[] =>
  cells.flatMap((c, i) => (c ? [{ unit: unitName(i, cells.length), inVillage: c, away: 0, support: 0 }] : []));
const RES = ["wood", "clay", "iron", "crop"] as const;
const four = (c: (number | null)[]) => Object.fromEntries(RES.map((k, i) => [k, c[i] ?? null]));

type Patch = { troops?: TroopEntry[]; resources?: Record<string, unknown>; fields?: unknown; buildings?: unknown; queues?: Record<string, unknown> };

/** Zerlegt eine Lesung in Änderungen je Dorf (nur Dörfer aus `known`, also des eigenen Kontos). */
export function planApply(r: Reading, known: KnownVillage[], hintVillageId?: number, preferHint = false): Map<number, Patch> {
  const byCoord = new Map(known.map((v) => [`${v.x}|${v.y}`, v.id]));
  const hint = hintVillageId && known.some((v) => v.id === hintVillageId) ? hintVillageId : undefined;
  const header = r.village?.x != null && r.village?.y != null ? byCoord.get(`${r.village.x}|${r.village.y}`) : undefined;
  const byName = known.find((v) => r.village?.name && v.name.toLowerCase() === r.village.name.toLowerCase())?.id;
  // Vom Nutzer ausdrücklich gewähltes Dorf (preferHint) schlägt die Erkennung
  const current = preferHint && hint !== undefined ? hint : (header ?? hint ?? byName);
  const out = new Map<number, Patch>();
  const patch = (id: number | undefined) => (id === undefined ? undefined : (out.get(id) ?? out.set(id, {}).get(id)!));
  const nameMap = new Map(known.map((v) => [v.name.trim().toLowerCase(), v.id]));
  // Mobil/Koordinaten haben Vorrang; Desktop-Tabellen nennen nur den Dorfnamen
  const rowId = (row: ReadingRow) => (row.x != null && row.y != null ? byCoord.get(`${row.x}|${row.y}`) : row.name ? nameMap.get(row.name.trim().toLowerCase()) : undefined);
  const q = (id: number | undefined, key: string, v: unknown) => {
    const p = patch(id);
    if (p) p.queues = { ...p.queues, [key]: v };
  };

  switch (r.kind) {
    case "RALLY_POINT": {
      // nur der eigene Block des geöffneten Dorfes: „Eigene Truppen“ bzw. mobil die einzige Zeile
      const own = r.rows.find((x) => rowId(x) === current && (x.texts[0] === "Eigene Truppen" || r.device === "MOBILE")) ?? (r.device === "MOBILE" ? r.rows[0] : undefined);
      const p = patch(current);
      if (own && p) p.troops = toEntries(own.cells);
      break;
    }
    case "VILLAGE_TROOPS":
      for (const row of r.rows) {
        const p = patch(rowId(row));
        if (p) p.troops = toEntries(row.cells);
      }
      break;
    case "VILLAGE_RESOURCES":
    case "VILLAGE_PRODUCTION":
      for (const row of r.rows) {
        const p = patch(rowId(row));
        if (!p) continue;
        if (r.kind === "VILLAGE_PRODUCTION") p.resources = { productionGross: four(row.cells) };
        else p.resources = { stock: four(row.cells), ...(row.cells.length === 8 ? { production: four(row.cells.slice(4)) } : {}), merchants: row.texts[0] ?? null };
      }
      break;
    case "RESOURCE_VIEW": {
      const p = patch(current);
      if (!p) break;
      p.fields = r.fields;
      const net = r.rows.find((x) => x.name === "production_net");
      p.resources = { ...(r.topBar ? { stock: { wood: r.topBar.wood, clay: r.topBar.clay, iron: r.topBar.iron, crop: r.topBar.crop }, freeCrop: r.topBar.freeCrop } : {}), ...(net ? { production: four(net.cells) } : {}) };
      const queue = r.rows.filter((x) => x.name?.startsWith("queue:"));
      if (queue.length) p.queues = { construction: queue.map((x) => ({ building: x.name!.slice(6), level: x.cells[0], remaining: x.texts[0], finishAt: x.texts[1] })) };
      break;
    }
    case "VILLAGE_VIEW": {
      const p = patch(current);
      if (!p) break;
      p.buildings = r.buildings;
      // Mobil mit ausgeklappter Kopfleiste: Bestände und Produktion lassen sich auch hier ablesen
      const vnet = r.rows.find((x) => x.name === "production_net");
      if (r.topBar || vnet) p.resources = { ...(r.topBar ? { stock: { wood: r.topBar.wood, clay: r.topBar.clay, iron: r.topBar.iron, crop: r.topBar.crop }, freeCrop: r.topBar.freeCrop } : {}), ...(vnet ? { production: four(vnet.cells) } : {}) };
      const queue = r.rows.filter((x) => x.name?.startsWith("queue:"));
      if (queue.length) p.queues = { construction: queue.map((x) => ({ building: x.name!.slice(6), level: x.cells[0], remaining: x.texts[0], finishAt: x.texts[1] })) };
      break;
    }
    case "VILLAGE_SMITHY":
    case "VILLAGE_HOSPITAL":
    case "VILLAGE_TRAINING":
    case "VILLAGE_CULTURE":
      for (const row of r.rows) q(rowId(row), r.kind.slice(8).toLowerCase(), { cells: row.cells, texts: row.texts });
      break;
    default:
      break; // VILLAGE_TROOPS_PRESENT, BATTLE_REPORT: erst gespeichert, noch nicht in den Dorfzustand übernommen
  }
  return out;
}


export async function applyReading(db: PrismaClient, userId: string, screenshotId: number, r: Reading, known: KnownVillage[], hintVillageId?: number, now = new Date(), preferHint = false): Promise<Applied[]> {
  const plan = planApply(r, known, hintVillageId, preferHint);
  const applied: Applied[] = [];
  for (const [villageId, p] of plan) {
    if (p.troops) p.troops = await nameUnits(db, villageId, p.troops);
    const cur = await db.villageState.findUnique({ where: { villageId } });
    const merge = (a: unknown, b: Record<string, unknown> | undefined) => ({ ...((a as Record<string, unknown> | null) ?? {}), ...(b ?? {}) });
    const data: Prisma.VillageStateUncheckedUpdateInput = { userId, capturedAt: now, sourceScreenshotId: screenshotId };
    const areas: string[] = [];
    if (p.troops) {
      data.troops = p.troops as unknown as Prisma.InputJsonValue;
      data.troopsAt = now;
      areas.push("troops");
    }
    if (p.resources) {
      data.resources = merge(cur?.resources, p.resources) as Prisma.InputJsonValue;
      data.resourcesAt = now;
      areas.push("resources");
    }
    if (p.fields) {
      data.fields = p.fields as Prisma.InputJsonValue;
      data.buildingsAt = now;
      areas.push("fields");
    }
    if (p.buildings) {
      data.buildings = inheritNames(p.buildings, cur?.buildings) as Prisma.InputJsonValue;
      data.buildingsAt = now;
      areas.push("buildings");
    }
    if (p.queues) {
      data.queues = merge(cur?.queues, p.queues) as Prisma.InputJsonValue;
      areas.push("queues");
    }
    if (!areas.length) continue;
    await db.villageState.upsert({ where: { villageId }, create: { ...(data as Prisma.VillageStateUncheckedCreateInput), villageId }, update: data });
    applied.push({ villageId, areas });
  }
  return applied;
}

type Bld = { slot?: number | null; name?: string | null; level: number };
/** Das Dorfzentrum-Bild nennt kaum Namen: fehlende Namen werden vom bisherigen Stand übernommen (gleicher Platz, sonst gleiche Reihenfolge bei gleicher Anzahl). */
export function inheritNames(next: unknown, prev: unknown): Bld[] {
  const n = Array.isArray(next) ? (next as Bld[]) : [];
  const o = Array.isArray(prev) ? (prev as Bld[]) : [];
  const bySlot = new Map(o.filter((b) => b.slot != null && b.name).map((b) => [b.slot as number, b.name as string]));
  const sameLen = n.length === o.length && n.every((b) => b.slot == null) && o.every((b) => b.slot == null);
  return n.map((b, i) => (b.name ? b : { ...b, name: (b.slot != null ? bySlot.get(b.slot) : undefined) ?? (sameLen ? (o[i]?.name ?? null) : null) }));
}

/** „Einheit N“ → echter Name, sobald Einheitennamen für das Volk des Dorfbesitzers (map.sql) vorliegen; Held und unbekannte Plätze bleiben. */
export async function nameUnits(db: PrismaClient, villageId: number, entries: TroopEntry[]): Promise<TroopEntry[]> {
  const v = await db.village.findUnique({ where: { id: villageId }, select: { playerId: true } });
  const p = v ? await db.player.findUnique({ where: { id: v.playerId }, select: { tribe: true } }) : null;
  if (!p) return entries;
  const names = new Map((await db.unitName.findMany({ where: { tribeVid: p.tribe } })).map((n) => [n.slot, n.nameDe ?? n.nameEn]));
  return entries.map((e) => {
    const m = /^Einheit (\d+)$/.exec(e.unit);
    return m && names.has(Number(m[1])) ? { ...e, unit: names.get(Number(m[1]))! } : e;
  });
}
