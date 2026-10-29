"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";

export type HelpItemView = { id: string; title: string; body: string; links: { href: string; label: string }[] };
export type HelpSectionView = { id: string; title: string; intro: string; video: string | null; items: HelpItemView[] };

/** Text mit Absätzen (Leerzeile) und Listenzeilen („• “). */
function Body({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\n+/).map((block, i) => {
        const lines = block.split("\n");
        const bullets = lines.filter((l) => l.startsWith("• "));
        const head = lines.filter((l) => !l.startsWith("• "));
        return (
          <div key={i} style={{ marginTop: i ? 10 : 0 }}>
            {head.length > 0 && <p style={{ margin: 0 }}>{head.join(" ")}</p>}
            {bullets.length > 0 && <ul style={{ margin: "6px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>{bullets.map((b, j) => <li key={j}>{b.slice(2)}</li>)}</ul>}
          </div>
        );
      })}
    </>
  );
}

/** Interaktive Hilfe: Bereiche als Sprungleiste, Volltextfilter, alle auf/zu, Direktlink per #id öffnet den Punkt. */
export function HelpBrowser({ sections, signedIn }: { sections: HelpSectionView[]; signedIn: boolean }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) setOpen((o) => new Set(o).add(id));
  }, []);
  const needle = q.trim().toLowerCase();
  const visible = useMemo(() => sections.map((s) => ({ ...s, items: needle ? s.items.filter((i) => `${i.title} ${i.body} ${s.title}`.toLowerCase().includes(needle)) : s.items })), [sections, needle]);
  const all = sections.flatMap((s) => s.items.map((i) => i.id));
  const toggle = (id: string, on: boolean) => setOpen((o) => { const n = new Set(o); if (on) n.add(id); else n.delete(id); return n; });
  const empty = visible.every((s) => s.items.length === 0);

  return (
    <>
      <nav className="helptabs" aria-label={t("help.title")}>
        {sections.map((s) => <a key={s.id} href={`#sec-${s.id}`} className="tab">{s.title}</a>)}
      </nav>
      <div className="row" style={{ gap: 10, flexWrap: "wrap", margin: "14px 0" }} role="search">
        <input className="field" style={{ flex: "1 1 260px" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("help.filter.ph")} aria-label={t("help.filter")} />
        <button type="button" className="btn ghost sm" onClick={() => setOpen(new Set(all))}>{t("help.openAll")}</button>
        <button type="button" className="btn ghost sm" onClick={() => setOpen(new Set())}>{t("help.closeAll")}</button>
      </div>
      {empty && <p className="sub" role="status">{t("help.noMatch")}</p>}
      {visible.map((s) => s.items.length === 0 ? null : (
        <section key={s.id} id={`sec-${s.id}`} className="card" aria-labelledby={`h-${s.id}`} style={{ scrollMarginTop: 90 }}>
          <h2 id={`h-${s.id}`}>{s.title}</h2>
          <p className="sub" style={{ margin: "4px 0 12px" }}>{s.intro}</p>
          {s.video && !needle && (
            <details className="helpitem" open={open.has(`video-${s.id}`)} onToggle={(e) => toggle(`video-${s.id}`, (e.currentTarget as HTMLDetailsElement).open)}>
              <summary>▶ {t("help.video")}</summary>
              <video src={s.video} controls muted playsInline preload="none" style={{ width: "100%", maxWidth: 900, borderRadius: 8, border: "1px solid var(--line)", marginTop: 8 }} />
              <div className="sub" style={{ fontSize: 12 }}>{t("help.videoNote")}</div>
            </details>
          )}
          {s.items.map((i) => (
            <details key={i.id} id={i.id} className="helpitem" open={!!needle || open.has(i.id)} onToggle={(e) => { if (!needle) toggle(i.id, (e.currentTarget as HTMLDetailsElement).open); }}>
              <summary>{i.title}</summary>
              <div style={{ marginTop: 8 }}><Body text={i.body} /></div>
              {i.links.length > 0 && (
                <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {i.links.map((l) => <Link key={l.href + l.label} className="btn ghost sm" href={l.href}>{l.label}{!signedIn && <span className="sub" style={{ marginLeft: 6, fontSize: 12 }}>🔒 {t("help.loginToOpen")}</span>}</Link>)}
                </div>
              )}
            </details>
          ))}
        </section>
      ))}
    </>
  );
}
