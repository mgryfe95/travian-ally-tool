/** @-Erwähnungen: `@Name`, Leerzeichen im Namen werden zu `_` (z. B. `@MG.RYFE`, `@Max_Mustermann`). */
export const MENTION_RE = /(?<![\p{L}\p{N}_@])@([\p{L}\p{N}_](?:[\p{L}\p{N}_.\-]*[\p{L}\p{N}_])?)/gu;

export const mentionHandle = (name: string) => name.trim().replace(/\s+/g, "_").toLowerCase();

/** Alle erwähnten Handles (klein geschrieben, eindeutig). */
export function extractMentions(body: string): string[] {
  return [...new Set([...body.matchAll(MENTION_RE)].map((m) => (m[1] as string).toLowerCase()))];
}
