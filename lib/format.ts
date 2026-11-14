import { INTL_TAG, type Locale } from "./i18n";

export const fmt = (n: number | null | undefined, locale: Locale) => (n === null || n === undefined ? "–" : n.toLocaleString(INTL_TAG[locale]));
export const delta = (n: number | null | undefined, locale: Locale) => (n === null || n === undefined ? "–" : `${n > 0 ? "+" : ""}${n.toLocaleString(INTL_TAG[locale])}`);
/** Datum/Zeit in der Spielzeit des Servers (Europe/Berlin), Format nach UI-Sprache. */
export const fmtDate = (d: Date, locale: Locale, opts: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" }) =>
  new Intl.DateTimeFormat(INTL_TAG[locale], { timeZone: "Europe/Berlin", ...opts }).format(d);
