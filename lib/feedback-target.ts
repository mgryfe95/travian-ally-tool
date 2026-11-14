/** Ziel eines Beta-Kommentars: Seite + stabiler CSS-Pfad + lesbare Beschreibung des Elements. */

/** Query-Parameter, die die Seite bestimmen (Tabs, Kanal, Unterhaltung); alles andere (Fehler, Rückmeldungen) fällt weg. */
const KEEP = ["tab", "c", "t", "b", "fx", "u", "tribe"];

export function feedbackPath(loc: { pathname: string; search: string }): string {
  const q = new URLSearchParams(loc.search);
  const kept = new URLSearchParams();
  for (const k of KEEP) { const v = q.get(k); if (v) kept.set(k, v); }
  const s = kept.toString();
  return loc.pathname + (s ? `?${s}` : "");
}

/** React-/Zufalls-IDs (":r1:", lange Hashes) taugen nicht als Anker. */
const stableId = (id: string) => !!id && !id.includes(":") && !/^[a-f0-9]{16,}$/i.test(id);

/** CSS-Pfad bis zum nächsten eindeutigen, stabilen `id` (sonst bis <body>), mit :nth-of-type wo nötig. */
export function elementSelector(el: Element): string {
  const parts: string[] = [];
  let n: Element | null = el;
  while (n && n.nodeType === 1 && n.tagName !== "BODY" && n.tagName !== "HTML") {
    if (stableId(n.id) && n.ownerDocument.querySelectorAll(`#${CSS.escape(n.id)}`).length === 1) {
      parts.unshift(`#${CSS.escape(n.id)}`);
      return parts.join(" > ");
    }
    let s = n.tagName.toLowerCase();
    const p: Element | null = n.parentElement;
    if (p) {
      const same = [...p.children].filter((c) => c.tagName === n!.tagName);
      if (same.length > 1) s += `:nth-of-type(${same.indexOf(n) + 1})`;
    }
    parts.unshift(s);
    n = p;
  }
  return parts.join(" > ");
}

/** Kurz und lesbar: Tag, Label/Überschrift/Text (max. 80 Zeichen). */
export function elementLabel(el: Element): string {
  const h = el as HTMLElement;
  const text = (h.getAttribute("aria-label") || h.getAttribute("placeholder") || h.getAttribute("title") || h.textContent || "").replace(/\s+/g, " ").trim();
  return `<${el.tagName.toLowerCase()}>${text ? ` ${text.slice(0, 80)}${text.length > 80 ? "…" : ""}` : ""}`;
}
