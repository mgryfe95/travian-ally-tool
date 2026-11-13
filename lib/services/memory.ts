import type { Prisma, PrismaClient } from "@prisma/client";
import { cosine, fuse, getEmbedder } from "../ai/embed";
import { recordUsage } from "../ai/usage";

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

export type MemorySource = "incident" | "recommendation" | "chat";

/** Einen eigenen Eintrag anlegen oder ersetzen (Schlüssel: Quelle) und – falls ein Embedder eingerichtet ist – einbetten. Gibt die id zurück. */
export async function upsertMemory(db: PrismaClient, userId: string, doc: { sourceType: MemorySource; sourceId: number; title: string; body: string }, opts: { embed?: boolean } = {}): Promise<number | null> {
  const rows = await withUserScope(db, userId, (tx) => tx.$queryRaw<{ id: number }[]>`
    INSERT INTO "MemoryDoc" ("ownerId", "scope", "sourceType", "sourceId", "title", "body", "updatedAt")
    VALUES (${userId}, 'user', ${doc.sourceType}, ${doc.sourceId}, ${doc.title.slice(0, 300)}, ${doc.body.slice(0, 4000)}, now())
    ON CONFLICT ("sourceType", "sourceId") DO UPDATE SET "title" = EXCLUDED."title", "body" = EXCLUDED."body", "updatedAt" = now(), "embedding" = NULL, "embedModel" = NULL, "embeddedAt" = NULL
    WHERE "MemoryDoc"."ownerId" = ${userId}
    RETURNING "id"`);
  const id = rows[0]?.id ?? null;
  if (id !== null && opts.embed !== false) await embedMemory(db, userId, [id]).catch((e) => console.error("[memory] Einbetten fehlgeschlagen", e));
  return id;
}

/** Bettet eigene Einträge ein (null = alle eigenen). Ohne Embedder: 0. Gibt die Zahl eingebetteter Einträge zurück. */
export async function embedMemory(db: PrismaClient, userId: string, ids: number[] | null): Promise<number> {
  const embedder = getEmbedder();
  if (!embedder) return 0;
  const docs = await withUserScope(db, userId, (tx) => ids
    ? tx.$queryRaw<{ id: number; title: string; body: string }[]>`SELECT "id", "title", "body" FROM "MemoryDoc" WHERE "ownerId" = ${userId} AND "id" = ANY(${ids}::int[])`
    : tx.$queryRaw<{ id: number; title: string; body: string }[]>`SELECT "id", "title", "body" FROM "MemoryDoc" WHERE "ownerId" = ${userId} ORDER BY "id" LIMIT 1000`);
  let n = 0;
  for (let i = 0; i < docs.length; i += 64) {
    const batch = docs.slice(i, i + 64);
    const r = await embedder.embed(batch.map((d) => `${d.title}\n${d.body}`), "document");
    await recordUsage(db, { userId, feature: "embed", model: r.model, usage: { input_tokens: r.tokens, output_tokens: 0 } });
    await withUserScope(db, userId, async (tx) => {
      for (const [j, d] of batch.entries()) {
        const v = r.vectors[j];
        if (!v?.length) continue;
        await tx.$executeRaw`UPDATE "MemoryDoc" SET "embedding" = ${v}::float8[], "embedModel" = ${r.model}, "embeddedAt" = now() WHERE "id" = ${d.id} AND "ownerId" = ${userId}`;
        n++;
      }
    });
  }
  return n;
}

export type MemoryRow = { id: number; scope: string; sourceType: string; sourceId: number | null; title: string; body: string; updatedAt: Date; embedModel: string | null; embeddedAt: Date | null; dims: number | null };

/** RAG-Einträge für den Reiter im KI-Bereich: eigene und globale, neueste zuerst. */
export async function listMemory(db: PrismaClient, userId: string, opts: { sourceType?: string; take?: number } = {}): Promise<MemoryRow[]> {
  const take = Math.max(1, Math.min(500, opts.take ?? 200));
  const st = opts.sourceType ?? null;
  return withUserScope(db, userId, (tx) => tx.$queryRaw<MemoryRow[]>`
    SELECT "id", "scope", "sourceType", "sourceId", "title", "body", "updatedAt", "embedModel", "embeddedAt", array_length("embedding", 1) AS "dims"
    FROM "MemoryDoc"
    WHERE ("ownerId" = ${userId} OR "scope" = 'global') AND (${st}::text IS NULL OR "sourceType" = ${st})
    ORDER BY "updatedAt" DESC
    LIMIT ${take}`);
}

/** Eigenen Eintrag löschen (globale nie). */
export async function deleteMemory(db: PrismaClient, userId: string, id: number): Promise<boolean> {
  const n = await withUserScope(db, userId, (tx) => tx.$executeRaw`DELETE FROM "MemoryDoc" WHERE "id" = ${id} AND "ownerId" = ${userId}`);
  return n > 0;
}

/**
 * Hybride Suche für Chat und Klärung: Volltext + (falls eingerichtet) Vektor-Ähnlichkeit, per Reciprocal Rank Fusion verbunden.
 * Vektor-Kandidaten: höchstens 2000 eigene/globale Einträge mit Embedding desselben Modells.
 */
export async function searchMemoryHybrid(db: PrismaClient, userId: string, query: string, limit = 5, opts: { userIdForUsage?: string } = {}): Promise<(MemoryHit & { similarity?: number })[]> {
  const q = query.trim().slice(0, 1000);
  if (!q) return [];
  const k = Math.max(1, Math.min(MAX_HITS, Math.floor(limit)));
  const words = q.split(/\s+/).filter((w) => w.length >= 3).slice(0, 12);
  const text = words.length ? await searchMemory(db, userId, orQuery(words), k).catch(() => []) : [];
  const embedder = getEmbedder();
  if (!embedder) return text;
  let qv: number[] | undefined;
  let model = "";
  try {
    const r = await embedder.embed([q], "query");
    qv = r.vectors[0];
    model = r.model;
    await recordUsage(db, { userId: opts.userIdForUsage ?? userId, feature: "embed", model: r.model, usage: { input_tokens: r.tokens, output_tokens: 0 } });
  } catch (e) {
    console.error("[memory] Query-Embedding fehlgeschlagen", e);
  }
  if (!qv?.length) return text;
  const cands = await withUserScope(db, userId, (tx) => tx.$queryRaw<(MemoryHit & { embedding: number[] })[]>`
    SELECT "id", "sourceType", "sourceId", "title", "body", "updatedAt", 0::float8 AS "rank", "embedding"
    FROM "MemoryDoc"
    WHERE ("ownerId" = ${userId} OR "scope" = 'global') AND "embedding" IS NOT NULL AND "embedModel" = ${model}
    ORDER BY "updatedAt" DESC
    LIMIT 2000`);
  const vec = cands.map(({ embedding, ...h }) => ({ ...h, similarity: cosine(qv!, embedding) })).filter((h) => h.similarity >= 0.3).sort((a, b) => b.similarity - a.similarity).slice(0, k);
  return fuse<MemoryHit & { similarity?: number }>([vec, text]).slice(0, k);
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
