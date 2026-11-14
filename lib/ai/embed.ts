import { env } from "../env";

export type EmbedKind = "document" | "query";
export type EmbedResult = { vectors: number[][]; model: string; tokens: number };
export interface Embedder {
  embed(texts: string[], kind: EmbedKind): Promise<EmbedResult>;
}

/** Voyage AI (von Anthropic empfohlener Embedding-Anbieter), mehrsprachig. */
export class VoyageEmbedder implements Embedder {
  constructor(private readonly apiKey: string, readonly model: string) {}
  async embed(texts: string[], kind: EmbedKind): Promise<EmbedResult> {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ input: texts, model: this.model, input_type: kind }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Voyage ${res.status}`);
    const j = (await res.json()) as { data: { embedding: number[]; index: number }[]; usage?: { total_tokens?: number } };
    const vectors = [...j.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
    return { vectors, model: this.model, tokens: j.usage?.total_tokens ?? 0 };
  }
}

type G = typeof globalThis & { __embedder?: Embedder | null };

/** Echter Embedder nur mit VOYAGE_API_KEY; Tests setzen mit `setEmbedder` einen eigenen. */
export function getEmbedder(): Embedder | null {
  const g = globalThis as G;
  if (g.__embedder !== undefined) return g.__embedder;
  const e = env();
  return e.VOYAGE_API_KEY ? new VoyageEmbedder(e.VOYAGE_API_KEY, e.EMBED_MODEL) : null;
}
export function setEmbedder(e: Embedder | null | undefined) {
  (globalThis as G).__embedder = e;
}

export function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Reciprocal Rank Fusion: verbindet Volltext- und Vektor-Rangfolgen. */
export function fuse<T extends { id: number }>(lists: T[][], k = 60): T[] {
  const score = new Map<number, number>();
  const item = new Map<number, T>();
  for (const list of lists) list.forEach((x, i) => { score.set(x.id, (score.get(x.id) ?? 0) + 1 / (k + i + 1)); if (!item.has(x.id)) item.set(x.id, x); });
  return [...score].sort((a, b) => b[1] - a[1]).map(([id]) => item.get(id)!);
}
