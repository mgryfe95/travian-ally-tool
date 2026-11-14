import type Anthropic from "@anthropic-ai/sdk";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { benefitsMarkdown, rowsToEffects } from "../gamedata/effects";
import { compareLosses } from "../gamedata/losses";
import { translate, type Locale, type MessageKey } from "../i18n";
import { effectLabelKey } from "../gamedata/effects";
import { searchMemoryHybrid } from "../services/memory";

/** Werkzeuge des KI-Chats: nur lesend, immer im Namen des angemeldeten Nutzers. */
export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_buildings",
    description: "List all buildings in the game data (name, max level, category). Use to find the exact building name before get_building.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_building",
    description: "Full level table of one building from the game data: cost (wood, clay, iron, crop), build time at this server's speed and all effects per level with the change to the previous level. Use for any question about levels, costs, benefits or comparisons.",
    input_schema: { type: "object", properties: { name: { type: "string", description: "Building name in German or English, e.g. 'Granary' or 'Kornspeicher'" }, from_level: { type: "integer" }, to_level: { type: "integer" } }, required: ["name"], additionalProperties: false },
  },
  {
    name: "get_units",
    description: "Unit table of a tribe from the game data: attack, defence vs infantry/cavalry, speed (fields/h), crop upkeep, total training cost (sum of all resources), training time. Without tribe: all tribes.",
    input_schema: { type: "object", properties: { tribe: { type: "string", description: "romans, teutons, gauls, egyptians, huns, spartans, vikings (or German names)" } }, additionalProperties: false },
  },
  {
    name: "compare_battle_losses",
    description: "Who sacrificed more? Converts the losses of both sides of one of the player's incidents (from the battle report) into resources (total training cost) and lost crop upkeep. Without incident_id: the latest incident with losses.",
    input_schema: { type: "object", properties: { incident_id: { type: "integer" } }, additionalProperties: false },
  },
  {
    name: "search_memory",
    description: "Search the player's knowledge (earlier incidents, clarified reports, chats, feedback on suggestions) for more context.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
  },
];

const TRIBES: Record<string, number> = { romans: 1, römer: 1, roman: 1, teutons: 2, germanen: 2, teuton: 2, gauls: 3, gallier: 3, gaul: 3, egyptians: 6, ägypter: 6, huns: 7, hunnen: 7, spartans: 8, spartaner: 8, vikings: 9, wikinger: 9 };

const schemas = {
  list_buildings: z.object({}).passthrough(),
  get_building: z.object({ name: z.string().min(1).max(60), from_level: z.number().int().optional(), to_level: z.number().int().optional() }),
  get_units: z.object({ tribe: z.string().max(30).optional() }),
  compare_battle_losses: z.object({ incident_id: z.number().int().optional() }),
  search_memory: z.object({ query: z.string().min(1).max(300) }),
};

/** Führt ein Werkzeug aus; Ergebnis ist Text (Markdown/JSON) für das Modell. Fehler → kurzer Text, kein Abbruch. */
export async function runChatTool(db: PrismaClient, userId: string, locale: Locale, name: string, input: unknown): Promise<{ text: string; error?: boolean }> {
  const schema = schemas[name as keyof typeof schemas];
  if (!schema) return { text: `unknown tool ${name}`, error: true };
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) return { text: `invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`, error: true };
  const a = parsed.data as Record<string, unknown>;
  switch (name) {
    case "list_buildings": {
      const rows = await db.building.findMany({ select: { name: true, nameEn: true, maxLevel: true, category: true }, orderBy: { gid: "asc" } });
      return { text: rows.length ? rows.map((r) => `${r.nameEn ?? r.name} / ${r.name} (max ${r.maxLevel}, ${r.category})`).join("\n") : "no game data imported" };
    }
    case "get_building": {
      const q = String(a.name).trim().toLowerCase();
      const all = await db.building.findMany({ select: { id: true, name: true, nameEn: true, maxLevel: true, version: { select: { serverSpeed: true } } } });
      const b = all.find((x) => [x.name, x.nameEn].some((n) => n?.toLowerCase() === q)) ?? all.find((x) => [x.name, x.nameEn].some((n) => n?.toLowerCase().includes(q)));
      if (!b) return { text: `building "${a.name}" not found – use list_buildings`, error: true };
      const from = typeof a.from_level === "number" ? a.from_level : 0, to = typeof a.to_level === "number" ? a.to_level : b.maxLevel;
      const rows = await db.buildingLevel.findMany({ where: { buildingId: b.id, level: { gte: Math.max(0, from - 1), lte: to } }, orderBy: { level: "asc" }, include: { effectRows: true } });
      const levels = rows.map((l) => ({ ...l, effects: rowsToEffects(l.effectRows) }));
      const md = benefitsMarkdown(`${b.nameEn ?? b.name} / ${b.name} (max level ${b.maxLevel}, server speed x${b.version.serverSpeed})`, levels, b.version.serverSpeed, (id) => translate(locale, effectLabelKey(id) as MessageKey), locale);
      return { text: md };
    }
    case "get_units": {
      const t = a.tribe ? TRIBES[String(a.tribe).toLowerCase()] : undefined;
      if (a.tribe && !t) return { text: `unknown tribe "${a.tribe}"`, error: true };
      const rows = await db.unitName.findMany({ where: t ? { tribeVid: t } : {}, orderBy: [{ tribeVid: "asc" }, { slot: "asc" }] });
      if (!rows.length) return { text: "no unit data imported" };
      const head = "| tribe | slot | unit | attack | def_inf | def_cav | speed | upkeep | cost_total | train_time_s |\n|---|---|---|---|---|---|---|---|---|---|";
      return { text: `${head}\n${rows.map((r) => `| ${r.tribeVid} | ${r.slot} | ${r.nameEn}${r.nameDe ? ` / ${r.nameDe}` : ""} | ${r.attack ?? "?"} | ${r.defInf ?? "?"} | ${r.defCav ?? "?"} | ${r.speed ?? "?"} | ${r.upkeep ?? "?"} | ${r.costTotal ?? "?"} | ${r.trainTimeSec ?? "?"} |`).join("\n")}\n(tribe ids: 1 Romans, 2 Teutons, 3 Gauls, 6 Egyptians, 7 Huns, 8 Spartans, 9 Vikings; values at server speed 1, smithy 0)` };
    }
    case "compare_battle_losses": {
      const has = (v: unknown) => Array.isArray(v) && v.length > 0;
      const i = typeof a.incident_id === "number"
        ? await db.incident.findFirst({ where: { id: a.incident_id, userId } })
        : (await db.incident.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 })).find((x) => has(x.attackerLosses) || has(x.defenderLosses)) ?? null;
      if (!i) return { text: "no own incident with battle report losses found", error: true };
      const c = await compareLosses(db, i);
      return { text: JSON.stringify({ incident: { id: i.id, type: i.type, attacker: i.attackerName, date: (i.occurredAt ?? i.createdAt).toISOString().slice(0, 10) }, attackerLosses: c.attacker, ownLosses: c.defender, moreLost: c.moreLost, note: "value = total training cost (wood+clay+iron+crop) of the lost units; heroes and units without cost data are listed under unknown" }) };
    }
    case "search_memory": {
      const hits = await searchMemoryHybrid(db, userId, String(a.query), 6);
      return { text: hits.length ? hits.map((h) => `- [${h.sourceType} ${h.updatedAt.toISOString().slice(0, 10)}] ${h.title}: ${h.body.slice(0, 500)}`).join("\n") : "nothing found" };
    }
  }
  return { text: "unsupported", error: true };
}
