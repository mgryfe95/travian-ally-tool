import { translate, type Locale, type MessageKey, type Params } from "./index";

/**
 * Fehler mit Übersetzungsschlüssel (`err.*` in lib/i18n/en/errors.ts). `message` ist immer die englische Fassung
 * (Logs, Tests); für die Anzeige übersetzt `localizeError` in die Sprache des Nutzers.
 */
export class AppError extends Error {
  constructor(readonly key: MessageKey, readonly params?: Params) {
    super(translate("en", key, params));
  }
}

export const localizeError = (e: unknown, locale: Locale, fallbackKey: MessageKey = "err.generic" as MessageKey): string =>
  e instanceof AppError ? translate(locale, e.key, e.params) : translate(locale, fallbackKey);
