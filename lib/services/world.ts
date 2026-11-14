import type { PrismaClient } from "@prisma/client";

/** Anzahl aufeinanderfolgender fehlgeschlagener stündlicher Importe, ab der die Welt als beendet gilt (Default 36 h). */
export const DEFAULT_END_FAILURES = 36;

export type WorldStatus = { status: "active" | "ended"; failures: number; lastSuccessAt: Date | null; endedAt: Date | null };

const get = async (db: PrismaClient, key: string) => (await db.setting.findUnique({ where: { key } }))?.value;
const set = (db: PrismaClient, key: string, value: string) => db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });

export async function getWorldStatus(db: PrismaClient): Promise<WorldStatus> {
  const [failures, last, ended] = await Promise.all([get(db, "worldFailures"), get(db, "worldLastSuccess"), get(db, "worldEndedAt")]);
  return { status: ended ? "ended" : "active", failures: Number(failures ?? 0) || 0, lastSuccessAt: last ? new Date(last) : null, endedAt: ended ? new Date(ended) : null };
}

/**
 * Ergebnis eines Importlaufs festhalten. Ein Erfolg setzt alles zurück (auch „beendet“ – falls die Welt doch weiterläuft),
 * `threshold` Fehlschläge in Folge markieren die Welt als beendet. „Unverändert“ zählt als Erfolg (die Datei war abrufbar).
 */
export async function recordImportOutcome(db: PrismaClient, ok: boolean, opts: { threshold?: number; now?: Date } = {}): Promise<WorldStatus> {
  const now = opts.now ?? new Date();
  if (ok) {
    await Promise.all([set(db, "worldFailures", "0"), set(db, "worldLastSuccess", now.toISOString()), db.setting.deleteMany({ where: { key: "worldEndedAt" } })]);
    return getWorldStatus(db);
  }
  const cur = await getWorldStatus(db);
  const failures = cur.failures + 1;
  await set(db, "worldFailures", String(failures));
  if (cur.status === "active" && failures >= (opts.threshold ?? DEFAULT_END_FAILURES)) await set(db, "worldEndedAt", now.toISOString());
  return getWorldStatus(db);
}

/**
 * Neue Spielwelt starten: weltbezogene Daten (Karte, Statistik, Ereignisse, Spieler-Verknüpfungen, Dörfer-Profile/-Zustände,
 * Screenshots-Zeilen, Allianz-Typen, Einladungen) werden geleert. Konten, Rollen, Rechte, Chat (Kanäle, Tags, Nachrichten) und
 * Task-Forces bleiben. Normale Member verlieren die Verifizierung (→ GUEST) und müssen neu verknüpft werden; Moderatoren/Admins bleiben.
 * VORHER Backup ziehen (scripts/backup.sh).
 */
export async function startNewWorld(db: PrismaClient): Promise<{ guestsDemoted: number }> {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'TRUNCATE "Snapshot","VillageSnapshot","Player","Village","Alliance","PlayerDailyStat","Event","PlayerLink","Invite","AllianceClassification","VillageProfile","VillageState","Screenshot" RESTART IDENTITY CASCADE',
    );
    const demoted = await tx.user.updateMany({ where: { role: "MEMBER" }, data: { role: "GUEST" } });
    await tx.setting.deleteMany({ where: { key: { in: ["worldFailures", "worldLastSuccess", "worldEndedAt", "allianceId"] } } });
    await tx.auditLog.create({ data: { actorId: "system", action: "world.reset", target: "world", after: { guestsDemoted: demoted.count } } });
    return { guestsDemoted: demoted.count };
  });
}
