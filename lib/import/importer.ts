import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { computePlayerMetrics, diffSnapshots, type PopPoint } from "../analytics";
import { parseMapSql } from "../mapsql/parser";
import type { MapRow } from "../mapsql/types";

export type ImportResult = { status: "unchanged" } | { status: "imported"; snapshotId: number; rows: number; events: number };

const CHUNK = 5000;
const HISTORY_DAYS = 14;

const chunks = <T>(arr: T[], n = CHUNK): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Lädt `${serverUrl}/map.sql`. */
export async function fetchMapSql(serverUrl: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(`${serverUrl.replace(/\/+$/, "")}/map.sql`, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`map.sql: HTTP ${res.status}`);
  return res.text();
}

type PlayerAgg = { id: number; name: string; tribe: number; allianceId: number; allianceName: string; population: number; villageCount: number };

function aggregate(rows: MapRow[]) {
  const players = new Map<number, PlayerAgg>();
  for (const r of rows) {
    const p = players.get(r.playerId);
    if (p) {
      p.population += r.population;
      p.villageCount++;
    } else {
      players.set(r.playerId, {
        id: r.playerId, name: r.playerName, tribe: r.tribe, allianceId: r.allianceId,
        allianceName: r.allianceName, population: r.population, villageCount: 1,
      });
    }
  }
  const alliances = new Map<number, { id: number; name: string; memberCount: number; villageCount: number; population: number }>();
  for (const p of players.values()) {
    if (p.allianceId === 0) continue;
    const a = alliances.get(p.allianceId) ?? { id: p.allianceId, name: p.allianceName, memberCount: 0, villageCount: 0, population: 0 };
    a.memberCount++;
    a.villageCount += p.villageCount;
    a.population += p.population;
    alliances.set(p.allianceId, a);
  }
  return { players, alliances };
}

export async function importMapSql(
  db: PrismaClient,
  text: string,
  opts: { inactiveDays: number; now?: Date },
): Promise<ImportResult> {
  const hash = sha256(text);
  if (await db.snapshot.findUnique({ where: { hash }, select: { id: true } })) return { status: "unchanged" };

  const rows = parseMapSql(text);
  if (rows.length === 0) throw new Error("map.sql enthält keine Zeilen — Import abgebrochen, bestehende Daten bleiben unverändert");
  const now = opts.now ?? new Date();
  const today = isoDate(now);
  const { players, alliances } = aggregate(rows);

  return db.$transaction(
    async (tx) => {
      const prevSnap = await tx.snapshot.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
      const prevRows = prevSnap
        ? await tx.villageSnapshot.findMany({ where: { snapshotId: prevSnap.id }, select: { villageId: true, playerId: true, allianceId: true } })
        : [];

      const snap = await tx.snapshot.create({ data: { hash, rowCount: rows.length, fetchedAt: now } });
      for (const part of chunks(rows)) {
        await tx.villageSnapshot.createMany({
          data: part.map((r) => ({
            snapshotId: snap.id, villageId: r.villageId, fieldId: r.fieldId, x: r.x, y: r.y, tribe: r.tribe,
            villageName: r.villageName, playerId: r.playerId, playerName: r.playerName, allianceId: r.allianceId,
            allianceName: r.allianceName, population: r.population, extra: r.extra as Prisma.InputJsonValue,
          })),
        });
      }

      // Tagesaggregat (bei mehreren Importen am selben Tag gewinnt der letzte).
      const list = [...players.values()];
      for (const part of chunks(list)) {
        await tx.$executeRaw`
          INSERT INTO "PlayerDailyStat" ("playerId","date","population","villageCount","allianceId")
          SELECT * FROM unnest(${part.map((p) => p.id)}::int[], ${part.map(() => today)}::date[],
            ${part.map((p) => p.population)}::int[], ${part.map((p) => p.villageCount)}::int[], ${part.map((p) => p.allianceId)}::int[])
          ON CONFLICT ("playerId","date") DO UPDATE SET
            "population" = EXCLUDED."population", "villageCount" = EXCLUDED."villageCount", "allianceId" = EXCLUDED."allianceId"`;
      }

      // Kennzahlen aus der Tageshistorie.
      const since = new Date(now.getTime() - HISTORY_DAYS * 86_400_000);
      const stats = await tx.playerDailyStat.findMany({
        where: { date: { gte: since } }, select: { playerId: true, date: true, population: true }, orderBy: { date: "asc" },
      });
      const series = new Map<number, PopPoint[]>();
      for (const s of stats) {
        const arr = series.get(s.playerId) ?? [];
        arr.push({ date: isoDate(s.date), population: s.population });
        series.set(s.playerId, arr);
      }
      const firstSeen = new Map((await tx.player.findMany({ select: { id: true, firstSeen: true } })).map((p) => [p.id, p.firstSeen]));

      // Aktuelle Sicht neu aufbauen.
      await tx.player.deleteMany();
      await tx.village.deleteMany();
      await tx.alliance.deleteMany();
      for (const part of chunks(list)) {
        await tx.player.createMany({
          data: part.map((p) => {
            const m = computePlayerMetrics(series.get(p.id) ?? [], opts.inactiveDays);
            return {
              id: p.id, name: p.name, tribe: p.tribe, allianceId: p.allianceId, population: p.population,
              villageCount: p.villageCount, status: m.status, noGrowthDays: m.noGrowthDays,
              delta1: m.delta1, delta3: m.delta3, delta7: m.delta7, firstSeen: firstSeen.get(p.id) ?? now,
            };
          }),
        });
      }
      for (const part of chunks(rows)) {
        await tx.village.createMany({
          data: part.map((r) => ({
            id: r.villageId, fieldId: r.fieldId, x: r.x, y: r.y, name: r.villageName, playerId: r.playerId,
            population: r.population, extra: r.extra as Prisma.InputJsonValue,
          })),
        });
      }
      await tx.alliance.createMany({ data: [...alliances.values()] });

      const events = diffSnapshots(prevRows, rows);
      for (const part of chunks(events)) {
        await tx.event.createMany({
          data: part.map((e) => ({
            snapshotId: snap.id, type: e.type, at: now, playerId: e.playerId,
            otherPlayerId: "otherPlayerId" in e ? e.otherPlayerId : null,
            villageId: "villageId" in e ? e.villageId : null,
            data: e.type === "alliance_change" ? { from: e.fromAllianceId, to: e.toAllianceId } : undefined,
          })),
        });
      }
      return { status: "imported" as const, snapshotId: snap.id, rows: rows.length, events: events.length };
    },
    { timeout: 300_000, maxWait: 30_000 },
  );
}

/**
 * Nur die letzten `keep` Snapshots behalten ihre Dorf-Rohzeilen (für den Diff reicht der Vorgänger). Verlauf steckt in
 * `PlayerDailyStat`, Ereignisse bleiben erhalten. Hält die Datenbank bei ~24k Dörfern pro Tag klein.
 */
export async function pruneVillageSnapshots(db: PrismaClient, keep = 3): Promise<number> {
  const recent = await db.snapshot.findMany({ orderBy: { id: "desc" }, take: keep, select: { id: true } });
  if (recent.length < keep) return 0;
  const cutoff = recent[recent.length - 1]!.id;
  const res = await db.villageSnapshot.deleteMany({ where: { snapshotId: { lt: cutoff } } });
  return res.count;
}
