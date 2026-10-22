/**
 * Travian veröffentlicht map.sql täglich zwischen 23:55 und 0:05 (Serverzeit). Der Worker holt die Datei kurz danach
 * (`MAP_RELEASE_TIME`, Standard 00:10) und versucht es zweimal nach; wer sich verifiziert, benennt ein Dorf bis zum Stichtag um.
 */
export const parseReleaseTime = (s: string): { h: number; m: number } => {
  const x = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  const h = x ? Number(x[1]) : NaN, m = x ? Number(x[2]) : NaN;
  if (!x || h > 23 || m > 59) throw new Error(`Invalid MAP_RELEASE_TIME: ${s} (expected HH:MM)`);
  return { h, m };
};

const plus = ({ h, m }: { h: number; m: number }, add: number) => {
  const t = h * 60 + m + add;
  return { h: Math.floor(t / 60) % 24, m: t % 60 };
};

/** Cron-Ausdrücke: Release-Zeit sowie +5 und +15 Minuten (falls Travian spät dran ist; ein unveränderter Hash kostet nichts). */
export const releaseCrons = (time: string): string[] => {
  const t = parseReleaseTime(time);
  return [0, 5, 15].map((a) => { const p = plus(t, a); return `${p.m} ${p.h} * * *`; });
};

/** Abgabeschluss fürs Umbenennen: 10 Minuten vor der Release-Zeit (Standard 23:55). */
export const renameDeadline = (time: string): string => {
  const p = plus(parseReleaseTime(time), -10 + 24 * 60);
  return `${String(p.h).padStart(2, "0")}:${String(p.m).padStart(2, "0")}`;
};

function offsetMs(tz: string, at: number): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(at)).map((p) => [p.type, Number(p.value)]));
  return Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!) - at;
}

/** Nächster Zeitpunkt (UTC-Instant), an dem es in `tz` gerade `time` ist. */
export function nextRelease(now: Date, tz: string, time: string): Date {
  const { h, m } = parseReleaseTime(time);
  const local = new Date(now.getTime() + offsetMs(tz, now.getTime()));
  for (let d = 0; d <= 2; d++) {
    const wall = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + d, h, m);
    const guess = wall - offsetMs(tz, wall - offsetMs(tz, now.getTime()));
    if (guess > now.getTime()) return new Date(guess);
  }
  return new Date(now.getTime() + 86_400_000);
}
