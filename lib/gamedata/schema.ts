import { z } from "zod";
import { translate } from "../i18n";

const nat = z.number().int().nonnegative();
const key = z.string().regex(/^[a-z0-9_]+$/, translate("en", "err.gamedata.keyFormat"));

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
    source: z.string().min(10, translate("en", "err.gamedata.source")),
    world: z.object({ host: z.string().min(3, translate("en", "err.gamedata.worldHost")), gameVersion: z.string().min(2, translate("en", "err.gamedata.worldVersion")) }),
    serverSpeed: z.number().int().positive(),
    notes: z.string().default(""),
    tribes: z.array(tribeSchema).default([]),
    buildings: z.array(buildingSchema).default([]),
    units: z.array(unitSchema).default([]),
  })
  .superRefine((d, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const dup = (items: string[], what: "err.gamedata.dupTribe" | "err.gamedata.dupBuilding" | "err.gamedata.dupUnit") => {
      const seen = new Set<string>();
      for (const i of items) {
        if (seen.has(i)) issue(translate("en", what, { key: i }));
        seen.add(i);
      }
    };
    dup(d.tribes.map((t) => t.key), "err.gamedata.dupTribe");
    dup(d.buildings.map((b) => b.key), "err.gamedata.dupBuilding");
    dup(d.units.map((u) => `${u.tribe}/${u.key}`), "err.gamedata.dupUnit");
    const tribes = new Set(d.tribes.map((t) => t.key));
    for (const u of d.units) if (!tribes.has(u.tribe)) issue(translate("en", "err.gamedata.unitUnknownTribe", { key: u.key, tribe: u.tribe }));
    for (const b of d.buildings) {
      const levels = b.levels.map((l) => l.level).sort((x, y) => x - y);
      if (levels.some((l, i) => l !== i + 1)) issue(translate("en", "err.gamedata.levelsGap", { key: b.key }));
      if (levels.length > 0 && levels[levels.length - 1]! > b.maxLevel) issue(translate("en", "err.gamedata.levelAboveMax", { key: b.key }));
      if (b.tribeRestriction && tribes.size > 0 && !tribes.has(b.tribeRestriction)) issue(translate("en", "err.gamedata.buildingUnknownTribe", { key: b.key, tribe: b.tribeRestriction }));
    }
  });

export type GameDataFile = z.infer<typeof gameDataSchema>;
