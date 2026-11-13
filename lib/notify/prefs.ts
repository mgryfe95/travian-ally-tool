/** Benachrichtigungs-Schlüssel und Standardwerte (ohne gespeicherten Eintrag). */
export const GENERAL_KEYS = ["dm", "mention", "broadcast", "alert"] as const;
export type GeneralKey = (typeof GENERAL_KEYS)[number];
export type NotifyKey = GeneralKey | `ch:${number}`;

export const channelKey = (channelId: number): NotifyKey => `ch:${channelId}`;

/**
 * Standard: Direktnachrichten, Erwähnungen, Rundnachrichten und „Angriff melden“ an;
 * Task-Force-Kanäle an (kleine Gruppen); Allianz-Kanäle aus (sonst zu viel Lärm).
 */
export function defaultOn(key: string, channelTree?: "ALLY" | "TASKFORCE"): boolean {
  if (key.startsWith("ch:")) return channelTree === "TASKFORCE";
  return (GENERAL_KEYS as readonly string[]).includes(key);
}

export function isNotifyKey(key: string): key is NotifyKey {
  return (GENERAL_KEYS as readonly string[]).includes(key) || /^ch:\d{1,9}$/.test(key);
}

/** Effektiver Wert: gespeichert vor Standard. */
export function effective(saved: ReadonlyMap<string, boolean>, key: string, channelTree?: "ALLY" | "TASKFORCE"): boolean {
  return saved.get(key) ?? defaultOn(key, channelTree);
}

/** Kurzer Vorschautext ohne Markdown-Zeichen, max. `max` Zeichen. */
export function preview(body: string, max = 140): string {
  const flat = body.replace(/[*_`>#~]|\[|\]\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
