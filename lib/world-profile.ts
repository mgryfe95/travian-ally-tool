/**
 * Profil der eigenen Spielwelt – Vertrags-Invariante für Spieldaten: Es werden ausschließlich Werte übernommen, die für
 * genau diese Welt gelten (Host, Spielversion, Server-Geschwindigkeit). Nichts wird umgerechnet oder aus anderen Welten ergänzt.
 */
export type WorldProfile = { host: string; version: string; speed: number | null };

/** Host ohne `www.`/Protokoll, klein: `https://ts12.x1.europe.travian.com` → `ts12.x1.europe.travian.com` */
export const worldHost = (serverUrl: string) => new URL(serverUrl).hostname.toLowerCase();

/** Geschwindigkeit aus dem Host (`x1`, `x2`, `x3` …) – oder null, wenn der Host sie nicht nennt (dann GAME_SPEED setzen). */
export function speedFromHost(host: string): number | null {
  for (const label of host.split(".")) {
    const m = label.match(/^x(\d{1,4})$/);
    if (m) return Number(m[1]);
  }
  return null;
}

export function worldProfile(serverUrl: string, opts: { version?: string; speed?: number } = {}): WorldProfile {
  const host = worldHost(serverUrl);
  return { host, version: (opts.version ?? "legends").toLowerCase(), speed: opts.speed ?? speedFromHost(host) };
}

/** Prüft, ob eine Spieldaten-Datei zu dieser Welt gehört; liefert die Abweichungen (leer = passt). */
export function worldMismatches(file: { world: { host: string; gameVersion: string }; serverSpeed: number }, p: WorldProfile): string[] {
  const out: string[] = [];
  if (file.world.host.trim().toLowerCase() !== p.host) out.push(`Welt: Datei „${file.world.host}“ ≠ eigene Welt „${p.host}“`);
  if (file.world.gameVersion.trim().toLowerCase() !== p.version) out.push(`Spielversion: Datei „${file.world.gameVersion}“ ≠ eigene Version „${p.version}“`);
  if (p.speed === null) out.push("Server-Geschwindigkeit der eigenen Welt unbekannt – GAME_SPEED in der .env setzen");
  else if (file.serverSpeed !== p.speed) out.push(`Server-Geschwindigkeit: Datei x${file.serverSpeed} ≠ eigene Welt x${p.speed}`);
  return out;
}
