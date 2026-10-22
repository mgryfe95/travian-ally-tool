import { de } from "./de";
import { en } from "./en";

export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";
/** Sprachnamen immer in der eigenen Sprache. */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", de: "Deutsch" };
/** Intl-Tag je Sprache (Zahlen/Datum). */
export const INTL_TAG: Record<Locale, string> = { en: "en-GB", de: "de-DE" };

export type MessageKey = keyof typeof en;
export type Params = Record<string, string | number>;

const DICTS: Record<Locale, Record<string, string>> = { en, de };

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** `Accept-Language` → erste unterstützte Sprache (Basis-Tag), sonst Standard. */
export function matchLocale(header: string | null | undefined): Locale {
  for (const part of (header ?? "").split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase().split("-")[0];
    if (isLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}

export function messagesFor(locale: Locale): Record<string, string> {
  return DICTS[locale];
}

/** `{name}` wird durch Parameter ersetzt; fehlende Schlüssel fallen auf Englisch, dann auf den Schlüssel zurück. */
export function translate(locale: Locale, key: string, params?: Params): string {
  const s = DICTS[locale][key] ?? en[key as MessageKey] ?? key;
  return params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s;
}

export type T = (key: MessageKey, params?: Params) => string;
export const makeT = (locale: Locale): T => (key, params) => translate(locale, key, params);
