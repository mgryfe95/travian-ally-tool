import type { Prisma, PrismaClient } from "@prisma/client";
import { worldMismatches, type WorldProfile } from "../world-profile";
import { gameDataSchema } from "./schema";
import { AppError } from "../i18n/errors";

export class GameDataError extends AppError {}

/**
 * Manuell ausgelöster Import: validiert die Datei strikt und legt eine neue `GameDataVersion` samt Zeilen an.
 * Es werden niemals Werte ergänzt oder geschätzt; ältere Versionen bleiben erhalten.
 */
export async function importGameData(db: PrismaClient, raw: unknown, world: WorldProfile) {
  const parsed = gameDataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new GameDataError("err.gamedata.invalid", { issues: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n") });
  }
  const d = parsed.data;
  const mismatch = worldMismatches(d, world);
  if (mismatch.length) throw new GameDataError("err.gamedata.worldMismatch", { details: mismatch.join("\n") });
  return db.$transaction(
    async (tx) => {
      const version = await tx.gameDataVersion.create({ data: { source: d.source, serverSpeed: d.serverSpeed, worldHost: world.host, gameVersion: world.version, notes: d.notes } });
      const tribeIds = new Map<string, number>();
      for (const t of d.tribes) {
        const row = await tx.tribe.create({ data: { versionId: version.id, key: t.key, name: t.name, traits: t.traits as Prisma.InputJsonValue } });
        tribeIds.set(t.key, row.id);
      }
      for (const b of d.buildings) {
        const row = await tx.building.create({
          data: { versionId: version.id, key: b.key, gid: b.gid, name: b.name, nameEn: b.nameEn, category: b.category, tribeRestriction: b.tribeRestriction, maxLevel: b.maxLevel, prerequisites: b.prerequisites as Prisma.InputJsonValue, description: b.description },
        });
        await tx.buildingLevel.createMany({ data: b.levels.map((l) => ({ ...l, buildingId: row.id, effects: l.effects as Prisma.InputJsonValue })) });
        const fx = b.levels.flatMap((l) => Object.entries({ ...(l.effects ?? {}), culturePoints: l.culturePoints }).filter(([, v]) => typeof v === "number" && Number.isFinite(v)).map(([effect, value]) => ({ buildingId: row.id, level: l.level, effect, value: value as number })));
        if (fx.length) await tx.buildingLevelEffect.createMany({ data: fx });
      }
      for (const u of d.units) {
        const { tribe, ...rest } = u;
        await tx.unit.create({ data: { ...rest, researchReq: u.researchReq as Prisma.InputJsonValue, versionId: version.id, tribeId: tribeIds.get(tribe)! } });
      }
      return { versionId: version.id, tribes: d.tribes.length, buildings: d.buildings.length, levels: d.buildings.reduce((n, b) => n + b.levels.length, 0), units: d.units.length };
    },
    { timeout: 120_000 },
  );
}
