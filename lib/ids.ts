/** „36, 7,12“ → [36, 7, 12]; ungültige und doppelte Einträge werden verworfen. */
export function parseIdList(input: string | undefined | null): number[] {
  if (!input) return [];
  const out: number[] = [];
  for (const part of input.split(/[,;\s]+/)) {
    const n = Number(part);
    if (part && Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}
