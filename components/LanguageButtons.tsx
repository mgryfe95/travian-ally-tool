"use client";

import { useTransition } from "react";
import { setLocaleAction } from "@/app/actions/locale";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";

/** Gut sichtbare Sprachwahl (EN · DE · FR) für öffentliche Seiten wie die Hilfe. */
export function LanguageButtons() {
  const locale = useLocale();
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label={t("common.language")} className="langbtns">
      {LOCALES.map((l) => (
        <button key={l} type="button" lang={l} title={LOCALE_NAMES[l]} aria-pressed={l === locale} disabled={pending} onClick={() => start(() => setLocaleAction(l))}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
