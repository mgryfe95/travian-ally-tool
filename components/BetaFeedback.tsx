"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FeedbackView } from "@/lib/services/feedback";
import { feedbackPath, elementLabel, elementSelector } from "@/lib/feedback-target";
import { useT } from "@/lib/i18n/client";

type Target = { selector: string; label: string; x: number; y: number };
const RC_KEY = "beta.rightClick";
const UI = "data-beta-ui";

/**
 * Beta-Feedback: Rechtsklick auf ein Element zeigt dessen Kommentare (Unterhaltung, schließen/öffnen, neuer Kommentar).
 * Elemente mit offenen Kommentaren tragen eine Zahl. Das Panel (Knopf unten rechts) listet alles mit Filter, Kopieren und Export als JSON.
 * Umschalt+Rechtsklick öffnet weiterhin das normale Kontextmenü.
 */
export function BetaFeedback({ me }: { me: string }) {
  const t = useT();
  const [threads, setThreads] = useState<FeedbackView[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [panel, setPanel] = useState(false);
  const [status, setStatus] = useState<"open" | "closed" | "all">("open");
  const [scope, setScope] = useState<"page" | "all">("page");
  const [rc, setRc] = useState(true);
  const [path, setPath] = useState("");
  const [msg, setMsg] = useState<string>();
  const [, tick] = useState(0);
  const hl = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/feedback?status=all", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setThreads(((await r.json()) as { threads: FeedbackView[] }).threads);
  }, []);

  useEffect(() => {
    try { setRc(localStorage.getItem(RC_KEY) !== "0"); } catch { /* ohne Speicher: an */ }
    setPath(feedbackPath(location));
    void load();
    // Seitenwechsel (Client-Navigation) und Layout-Änderungen: Pfad und Marken regelmäßig nachziehen
    const id = setInterval(() => { setPath(feedbackPath(location)); tick((n) => n + 1); }, 1000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!rc) return;
    const onContext = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.shiftKey || !el || el.closest(`[${UI}]`)) return;
      e.preventDefault();
      setTarget({ selector: elementSelector(el), label: elementLabel(el), x: e.clientX, y: e.clientY });
      void load();
    };
    document.addEventListener("contextmenu", onContext, true);
    return () => document.removeEventListener("contextmenu", onContext, true);
  }, [rc, load]);

  // Markiertes Element (geöffnetes Popover) hervorheben
  useEffect(() => {
    hl.current?.style.removeProperty("outline");
    hl.current = null;
    if (!target) return;
    const el = safeQuery(target.selector);
    if (el) { el.style.outline = "3px solid #d9a441"; hl.current = el; }
  }, [target]);

  const here = useMemo(() => threads.filter((th) => th.path === path), [threads, path]);
  const forTarget = target ? here.filter((th) => th.selector === target.selector) : [];
  const listed = threads.filter((th) => (status === "all" || th.status === status) && (scope === "all" || th.path === path));
  const openCount = threads.filter((th) => th.status === "open").length;

  async function call(url: string, method: string, body: unknown) {
    setMsg(undefined);
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { setMsg(((await r.json().catch(() => ({}))) as { error?: string }).error ?? t("beta.failed")); return false; }
    await load();
    return true;
  }
  const exportUrl = `/api/feedback?status=${status}${scope === "page" ? `&path=${encodeURIComponent(path)}` : ""}&download=1`;
  async function copyJson() {
    const data = JSON.stringify({ exportedAt: new Date().toISOString(), status, scope: scope === "page" ? path : "all", threads: listed }, null, 2);
    try { await navigator.clipboard.writeText(data); setMsg(t("beta.copied", { n: listed.length })); } catch { setMsg(t("beta.copyFailed")); }
  }
  function show(th: FeedbackView) {
    if (th.path !== path) { location.href = th.path; return; }
    const el = safeQuery(th.selector);
    el?.scrollIntoView({ block: "center" });
    const r = el?.getBoundingClientRect();
    setTarget({ selector: th.selector, label: th.label, x: r ? r.left + 20 : 120, y: r ? r.top + 20 : 120 });
  }

  return (
    <div {...{ [UI]: "" }}>
      {/* Zahl an Elementen mit offenen Kommentaren */}
      {Object.entries(groupOpen(here)).map(([sel, n]) => {
        const el = safeQuery(sel);
        const r = el?.getBoundingClientRect();
        if (!r || (r.width === 0 && r.height === 0)) return null;
        return (
          <button key={sel} type="button" className="beta-pin" aria-label={t("beta.pinLabel", { n })} title={t("beta.pinLabel", { n })}
            style={{ top: Math.max(4, r.top - 9), left: Math.min(innerWidth - 30, r.right - 12) }}
            onClick={() => setTarget({ selector: sel, label: el ? elementLabel(el) : "", x: r.right - 12, y: r.top + 12 })}>{n}</button>
        );
      })}

      {target && (
        <section className="beta-pop card" role="dialog" aria-label={t("beta.popTitle")} style={popPos(target)}>
          <div className="row between" style={{ alignItems: "baseline", gap: 8 }}>
            <b style={{ fontSize: 14 }}>{t("beta.popTitle")}</b>
            <button type="button" className="btn ghost sm" onClick={() => setTarget(null)} aria-label={t("beta.close")}>×</button>
          </div>
          <div className="sub mono" style={{ fontSize: 11, margin: "4px 0 8px", wordBreak: "break-all" }} title={target.selector}>{target.label}</div>
          {forTarget.length === 0 && <p className="sub" style={{ fontSize: 13 }}>{t("beta.none")}</p>}
          {forTarget.map((th) => <Thread key={th.id} th={th} me={me} onReply={(b) => call(`/api/feedback/${th.id}`, "POST", { body: b })} onStatus={(s) => void call(`/api/feedback/${th.id}`, "PATCH", { status: s })} />)}
          <Composer label={t("beta.new")} button={t("beta.add")} onSend={(b) => call("/api/feedback", "POST", { path, selector: target.selector, label: target.label, body: b })} />
          {msg && <p className="sub" role="status" style={{ fontSize: 12, marginTop: 6 }}>{msg}</p>}
        </section>
      )}

      {panel && (
        <section className="beta-panel card" aria-label={t("beta.panelTitle")}>
          <div className="row between" style={{ alignItems: "baseline" }}>
            <b>{t("beta.panelTitle")}</b>
            <button type="button" className="btn ghost sm" onClick={() => setPanel(false)} aria-label={t("beta.close")}>×</button>
          </div>
          <p className="sub" style={{ fontSize: 12, margin: "4px 0 8px" }}>{t("beta.howto")}</p>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <select className="field" style={{ width: "auto", minHeight: 32 }} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label={t("beta.filterStatus")}>
              <option value="open">{t("beta.open")}</option><option value="closed">{t("beta.closed")}</option><option value="all">{t("beta.all")}</option>
            </select>
            <select className="field" style={{ width: "auto", minHeight: 32 }} value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} aria-label={t("beta.filterScope")}>
              <option value="page">{t("beta.thisPage")}</option><option value="all">{t("beta.allPages")}</option>
            </select>
            <button type="button" className="btn ghost sm" onClick={() => void copyJson()}>{t("beta.copyJson")}</button>
            <a className="btn ghost sm" href={exportUrl} download>{t("beta.exportJson")}</a>
          </div>
          <label className="sub" style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center", margin: "8px 0" }}>
            <input type="checkbox" checked={rc} onChange={(e) => { setRc(e.target.checked); try { localStorage.setItem(RC_KEY, e.target.checked ? "1" : "0"); } catch { /* egal */ } }} /> {t("beta.rightClick")}
          </label>
          {msg && <p className="sub" role="status" style={{ fontSize: 12 }}>{msg}</p>}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            {listed.length === 0 && <li className="sub" style={{ fontSize: 13 }}>{t("beta.empty")}</li>}
            {listed.map((th) => (
              <li key={th.id}>
                <button type="button" className="beta-item" onClick={() => show(th)}>
                  <span className={`pill ${th.status === "open" ? "p-wait" : "p-ok"}`}>{th.status === "open" ? t("beta.open") : t("beta.closed")}</span>{" "}
                  <span className="mono sub" style={{ fontSize: 11 }}>{th.path}</span>
                  <span style={{ display: "block", fontSize: 13, marginTop: 2 }}>{th.comments[0]?.body.slice(0, 120)}</span>
                  <span className="sub" style={{ fontSize: 11 }}>{th.label} · {th.createdBy.name} · {t("beta.replies", { n: th.comments.length - 1 })}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button type="button" className="beta-fab" onClick={() => { setPanel((p) => !p); void load(); }} aria-expanded={panel}>
        {t("beta.fab", { n: openCount })}
      </button>
    </div>
  );
}

function Thread({ th, me, onReply, onStatus }: { th: FeedbackView; me: string; onReply: (b: string) => Promise<boolean>; onStatus: (s: "open" | "closed") => void }) {
  const t = useT();
  return (
    <div className="beta-thread" style={{ opacity: th.status === "closed" ? 0.75 : 1 }}>
      <div className="row between" style={{ gap: 6 }}>
        <span className={`pill ${th.status === "open" ? "p-wait" : "p-ok"}`}>{th.status === "open" ? t("beta.open") : t("beta.closed")}</span>
        <button type="button" className="btn ghost sm" onClick={() => onStatus(th.status === "open" ? "closed" : "open")}>{th.status === "open" ? t("beta.doClose") : t("beta.reopen")}</button>
      </div>
      {th.comments.map((c) => (
        <div key={c.id} className={`dm-bubble ${c.author.id === me ? "mine" : ""}`} style={{ marginTop: 6, fontSize: 13, whiteSpace: "pre-wrap" }}>
          <b style={{ fontSize: 12 }}>{c.author.name}</b> <span className="sub" style={{ fontSize: 11 }}>{new Date(c.createdAt).toLocaleString()}</span>
          <div>{c.body}</div>
        </div>
      ))}
      <Composer label={t("beta.reply")} button={t("beta.send")} onSend={onReply} small />
    </div>
  );
}

function Composer({ label, button, onSend, small = false }: { label: string; button: string; onSend: (b: string) => Promise<boolean>; small?: boolean }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form style={{ marginTop: 8, display: "grid", gap: 6 }} onSubmit={async (e) => { e.preventDefault(); if (!v.trim()) return; setBusy(true); if (await onSend(v)) setV(""); setBusy(false); }}>
      <textarea className="field" rows={small ? 2 : 3} value={v} onChange={(e) => setV(e.target.value)} aria-label={label} placeholder={label} maxLength={2000} />
      <div><button className={`btn sm ${small ? "ghost" : ""}`} disabled={busy || !v.trim()}>{button}</button></div>
    </form>
  );
}

function safeQuery(sel: string): HTMLElement | null {
  try {
    return document.querySelector<HTMLElement>(sel);
  } catch {
    return null;
  }
}
const groupOpen = (list: FeedbackView[]) => list.filter((th) => th.status === "open").reduce<Record<string, number>>((m, th) => ({ ...m, [th.selector]: (m[th.selector] ?? 0) + 1 }), {});
/** Popover neben dem Klickpunkt, innerhalb des Fensters. */
function popPos(tg: Target): React.CSSProperties {
  const w = 360;
  const left = Math.max(8, Math.min(tg.x + 12, (typeof innerWidth === "number" ? innerWidth : 1200) - w - 8));
  const top = Math.max(8, Math.min(tg.y + 12, (typeof innerHeight === "number" ? innerHeight : 800) - 420));
  return { left, top, width: w };
}
