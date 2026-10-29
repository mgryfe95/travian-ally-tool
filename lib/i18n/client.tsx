"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { translate, type Locale, type MessageKey, type Params, type T } from "./index";

const Ctx = createContext<{ locale: Locale; messages: Record<string, string> } | null>(null);

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Record<string, string>; children: ReactNode }) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale(): Locale {
  const c = useContext(Ctx);
  if (!c) throw new Error("I18nProvider fehlt");
  return c.locale;
}

export function useT(): T {
  const c = useContext(Ctx);
  if (!c) throw new Error("I18nProvider fehlt");
  const { locale, messages } = c;
  return (key: MessageKey, params?: Params) => {
    const s = messages[key];
    return s === undefined ? translate(locale, key, params) : params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s;
  };
}
