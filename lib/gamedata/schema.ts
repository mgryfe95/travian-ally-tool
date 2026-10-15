import { z } from "zod";

const nat = z.number().int().nonnegative();
const key = z.string().regex(/^[a-z0-9_]+$/, "key: nur a-z, 0-9 und _");

export const levelSchema = z.object({
  level: z.number().int().positive(),
  costWood: nat, costClay: nat, costIron: nat, costCrop: nat,
  upkeep: nat,
  buildTimeSec: nat,
  culturePoints: nat,
  effects: z.record(z.unknown()).default({}),
});

export const buildingSchema = z.object({
  key,
  gid: z.number().int().positive().nullable().default(null),
  name: z.string().min(1),
  category: z.string().min(1),
  tribeRestriction: z.string().nullable().default(null),
  maxLevel: z.number().int().positive(),
  prerequisites: z.array(z.unknown()).default([]),
  description: z.string().default(""),
  levels: z.array(levelSchema).min(1),
});

export const unitSchema = z.object({
  tribe: key,
  key,
  name: z.string().min(1),
  attack: nat, defInf: nat, defCav: nat, speed: nat, carry: nat,
  costWood: nat, costClay: nat, costIron: nat, costCrop: nat,
  upkeep: nat,
  trainTimeSec: nat,
  building: z.string().min(1),
  researchReq: z.record(z.unknown()).default({}),
});

export const tribeSchema = z.object({ key, name: z.string().min(1), traits: z.record(z.unknown()).default({}) });

/** Import-Datei. `source` = URL + Abrufdatum der freigegebenen Quelle. `world` + `serverSpeed` bezeichnen die Welt, für die die Werte gelten
 *  (Host, Spielversion, Geschwindigkeit) – sie müssen zur eigenen Welt passen, sonst wird nichts importiert. */
export const gameDataSchema = z
  .object({
    source: z.string().min(10, "source: URL + Abrufdatum angeben"),
    world: z.object({ host: z.string().min(3, "world.host fehlt"), gameVersion: z.string().min(2, "world.gameVersion fehlt") }),
    serverSpeed: z.number().int().positive(),
    notes: z.string().default(""),
    tribes: z.array(tribeSchema).default([]),
    buildings: z.array(buildingSchema).default([]),
    units: z.array(unitSchema).default([]),
  })
  .superRefine((d, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const dup = (items: string[], what: string) => {
      const seen = new Set<string>();
      for (const i of items) {
        if (seen.has(i)) issue(`${what} doppelt: ${i}`);
        seen.add(i);
      }
    };
    dup(d.tribes.map((t) => t.key), "Volk");
    dup(d.buildings.map((b) => b.key), "Gebäude");
    dup(d.units.map((u) => `${u.tribe}/${u.key}`), "Einheit");
    const tribes = new Set(d.tribes.map((t) => t.key));
    for (const u of d.units) if (!tribes.has(u.tribe)) issue(`Einheit ${u.key}: unbekanntes Volk ${u.tribe}`);
    for (const b of d.buildings) {
      const levels = b.levels.map((l) => l.level).sort((x, y) => x - y);
      if (levels.some((l, i) => l !== i + 1)) issue(`Gebäude ${b.key}: Stufen müssen lückenlos bei 1 beginnen`);
      if (levels.length > 0 && levels[levels.length - 1]! > b.maxLevel) issue(`Gebäude ${b.key}: Stufe über maxLevel`);
      if (b.tribeRestriction && tribes.size > 0 && !tribes.has(b.tribeRestriction)) issue(`Gebäude ${b.key}: unbekanntes Volk ${b.tribeRestriction}`);
    }
  });

export type GameDataFile = z.infer<typeof gameDataSchema>;
