"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HelpFlow, type FlowLabels } from "@/components/HelpFlow";
import { useT } from "@/lib/i18n/client";

export type HelpItemView = { id: string; title: string; body: string; links: { href: string; label: string }[] };
export type HelpSectionView = { id: string; title: string; intro: string; video: string | null; flow?: boolean; items: HelpItemView[] };

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
export function HelpBrowser({ sections, signedIn, flow }: { sections: HelpSectionView[]; signedIn: boolean; flow: FlowLabels }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  /** Gewählter Bereich (Kachel): nur dieser wird angezeigt; null = alle */
  const [sec, setSec] = useState<string | null>(null);
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const s = sections.find((x) => `sec-${x.id}` === id || x.items.some((i) => i.id === id));
    if (s) setSec(s.id);
    setOpen((o) => new Set(o).add(id));
  }, [sections]);
  const pick = (id: string | null) => {
    setSec(id);
    history.replaceState(null, "", id ? `#sec-${id}` : location.pathname);
  };
  const needle = q.trim().toLowerCase();
  // Suche gilt immer über alle Bereiche; ohne Suche zeigt eine gewählte Kachel nur ihren Bereich
  const visible = useMemo(() => sections
    .filter((s) => needle || !sec || s.id === sec)
    .map((s) => ({ ...s, items: needle ? s.items.filter((i) => `${i.title} ${i.body} ${s.title}`.toLowerCase().includes(needle)) : s.items })), [sections, needle, sec]);
  const all = sections.flatMap((s) => s.items.map((i) => i.id));
  const toggle = (id: string, on: boolean) => setOpen((o) => { const n = new Set(o); if (on) n.add(id); else n.delete(id); return n; });
  const empty = visible.every((s) => s.items.length === 0);

  return (
    <>
      <nav className="helptiles" aria-label={t("help.title")}>
        <button type="button" className="helptile" aria-pressed={!sec} onClick={() => pick(null)}>
          <b>{t("help.all")}</b><span>{t("help.all.sub", { n: sections.reduce((a, s) => a + s.items.length, 0) })}</span>
        </button>
        {sections.map((s) => (
          <button key={s.id} type="button" className="helptile" aria-pressed={sec === s.id} onClick={() => pick(s.id)}>
            <b>{s.title}</b><span>{s.items.length === 1 ? t("help.all.subOne") : t("help.all.sub", { n: s.items.length })}</span>
          </button>
        ))}
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
          {s.flow && !needle && <HelpFlow l={flow} />}
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
