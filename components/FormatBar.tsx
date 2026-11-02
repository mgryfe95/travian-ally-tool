"use client";

import type { RefObject } from "react";
import { useT } from "@/lib/i18n/client";

type Field = HTMLInputElement | HTMLTextAreaElement;

/** Formatierung per Knopf: legt Markdown-Zeichen um die Markierung (fett, kursiv, Code, Link); gerendert wird wie im Chat. */
export function FormatBar({ target, value, onChange }: { target: RefObject<Field | null>; value: string; onChange: (v: string) => void }) {
  const t = useT();
  const wrap = (before: string, after = before, placeholder = "") => {
    const el = target.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const sel = value.slice(start, end) || placeholder;
    onChange(value.slice(0, start) + before + sel + after + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + before.length, start + before.length + sel.length);
    });
  };
  const btn = { minHeight: 28, minWidth: 30, padding: "0 8px" } as const;
  return (
    <div className="row" role="toolbar" aria-label={t("fmt.toolbar")} style={{ gap: 4 }}>
      <button type="button" className="btn ghost sm" style={{ ...btn, fontWeight: 700 }} title={t("fmt.bold")} aria-label={t("fmt.bold")} onClick={() => wrap("**")}>B</button>
      <button type="button" className="btn ghost sm" style={{ ...btn, fontStyle: "italic" }} title={t("fmt.italic")} aria-label={t("fmt.italic")} onClick={() => wrap("*")}>I</button>
      <button type="button" className="btn ghost sm mono" style={btn} title={t("fmt.code")} aria-label={t("fmt.code")} onClick={() => wrap("`")}>{"</>"}</button>
      <button type="button" className="btn ghost sm" style={btn} title={t("fmt.link")} aria-label={t("fmt.link")} onClick={() => wrap("[", "](https://)", t("fmt.linkText"))}>🔗</button>
    </div>
  );
}
