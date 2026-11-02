import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Gedächtnis für Lagebild und Verlaufssuche (Postgres-Volltextsuche, `MemoryDoc`).
 * Sicherheit in zwei Schichten, beide immer aktiv:
 *  1. Jede Abfrage filtert selbst: `("ownerId" = $user OR "scope" = 'global')` – geklammert, in derselben Abfrage VOR `LIMIT`.
 *  2. Row-Level Security: Alles läuft in `withUserScope` unter der Rolle `ally_memory` mit `app.user_id` = Nutzer der Sitzung.
 *     Vergisst eine Abfrage den Filter, liefert die Datenbank trotzdem nur eigene und globale Einträge.
 * Die Nutzer-ID kommt immer vom Aufrufer (Sitzung), nie aus KI-Antworten oder Formulareingaben.
 */
export async function withUserScope<T>(db: PrismaClient, userId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  if (!userId) throw new Error("withUserScope: userId fehlt");
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE ally_memory"); // konstanter Text, kein Nutzerinput
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    return fn(tx);
  });
}

export type MemoryHit = { id: number; sourceType: string; sourceId: number | null; title: string; body: string; updatedAt: Date; rank: number };
export const MAX_HITS = 10;

/** Einen eigenen Eintrag anlegen oder ersetzen (Schlüssel: Quelle). */
export async function upsertMemory(db: PrismaClient, userId: string, doc: { sourceType: "incident" | "recommendation"; sourceId: number; title: string; body: string }) {
  await withUserScope(db, userId, (tx) => tx.$executeRaw`
    INSERT INTO "MemoryDoc" ("ownerId", "scope", "sourceType", "sourceId", "title", "body", "updatedAt")
    VALUES (${userId}, 'user', ${doc.sourceType}, ${doc.sourceId}, ${doc.title.slice(0, 300)}, ${doc.body.slice(0, 4000)}, now())
    ON CONFLICT ("sourceType", "sourceId") DO UPDATE SET "title" = EXCLUDED."title", "body" = EXCLUDED."body", "updatedAt" = now()
    WHERE "MemoryDoc"."ownerId" = ${userId}`);
}

/** Volltextsuche (websearch-Syntax, ohne Stemming wegen gemischter Sprachen) über eigene und globale Einträge. */
export async function searchMemory(db: PrismaClient, userId: string, query: string, limit = MAX_HITS): Promise<MemoryHit[]> {
  const q = query.trim().slice(0, 200);
  if (!q) return [];
  const k = Math.max(1, Math.min(MAX_HITS, Math.floor(limit)));
  return withUserScope(db, userId, (tx) => tx.$queryRaw<MemoryHit[]>`
    SELECT d."id", d."sourceType", d."sourceId", d."title", d."body", d."updatedAt", ts_rank(d."tsv", q.query)::float8 AS "rank"
    FROM "MemoryDoc" d, websearch_to_tsquery('simple', ${q}) AS q(query)
    WHERE (d."ownerId" = ${userId} OR d."scope" = 'global')
      AND d."tsv" @@ q.query
    ORDER BY "rank" DESC, d."updatedAt" DESC
    LIMIT ${k}`);
}

/** Mehrere Begriffe als ODER-Suche (z. B. Angreifernamen fürs Lagebild); Sonderzeichen werden entfernt. */
export function orQuery(terms: string[]): string {
  return [...new Set(terms.map((t) => t.replace(/["'\\()|&!:<>-]/g, " ").trim()).filter((t) => t.length >= 2))].slice(0, 8).map((t) => `"${t}"`).join(" or ");
}
