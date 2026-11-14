"use client";

import { useTransition } from "react";
import { setLocaleAction } from "@/app/actions/locale";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";

export function LanguageSelect() {
  const locale = useLocale();
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <select aria-label={t("common.language")} value={locale} disabled={pending} onChange={(e) => start(() => setLocaleAction(e.target.value))} style={{ fontSize: 12 }}>
      {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
    </select>
  );
}
