/** Einfacher Fixed-Window-Limiter im Speicher (eine App-Instanz). `now` ist injizierbar für Tests. */
export function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    /** true = erlaubt. */
    check(key: string, now = Date.now()): boolean {
      const h = hits.get(key);
      if (!h || h.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
        return true;
      }
      h.count++;
      return h.count <= max;
    },
  };
}
