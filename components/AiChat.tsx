"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Md } from "@/components/Md";
import { useLocale, useT } from "@/lib/i18n/client";
import { INTL_TAG, type MessageKey } from "@/lib/i18n";

const CMDS = ["tips", "open", "search", "incident", "help"] as const;
export type ChatMsg = { id: number | string; role: string; content: string; createdAt: string };

/** Chat-Verlauf + Eingabe mit Streaming (NDJSON von /api/ai/chat); „/“ zeigt die Befehle. */
export function AiChat({ chatId, incident, initial }: { chatId: number; incident: boolean; initial: ChatMsg[] }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [msgs, setMsgs] = useState<ChatMsg[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<string | null>(null);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { setMsgs(initial); }, [initial]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length, busy]);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(INTL_TAG[locale], { hour: "2-digit", minute: "2-digit" });

  async function send() {
    const q = text.trim();
    if (!q || busy) return;
    setText("");
    setError("");
    setBusy(true);
    const now = new Date().toISOString();
    setMsgs((m) => [...m, { id: `u${Date.now()}`, role: "user", content: q, createdAt: now }, { id: "live", role: "assistant", content: "", createdAt: now }]);
    const append = (v: string) => setMsgs((m) => m.map((x) => (x.id === "live" ? { ...x, content: x.content + v } : x)));
    try {
      const res = await fetch("/api/ai/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chatId, text: q }) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? String(res.status));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as { t: string; v?: string };
          if (ev.t === "text") { setTool(null); append(ev.v ?? ""); }
          else if (ev.t === "tool") setTool(ev.v ?? "");
          else if (ev.t === "error") setError(ev.v ?? "");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTool(null);
      setBusy(false);
      router.refresh(); // gespeicherte Nachrichten, Titel, Incident-Status übernehmen
    }
  }

  const showCmds = !incident && text.startsWith("/") && !text.includes(" ");
  const matches = CMDS.filter((c) => `/${c}`.startsWith(text.toLowerCase()));
  return (
    <>
      <ol aria-live="polite" style={{ listStyle: "none", padding: 0, margin: "12px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.filter((m) => !(m.id === "live" && !m.content && !busy)).map((m) => (
          <li key={m.id} className={m.role === "user" ? "" : "card soft"} style={{ padding: m.role === "user" ? "0 4px" : 10, margin: 0 }}>
            <div className="sub" style={{ fontSize: 12, fontWeight: 700 }} suppressHydrationWarning>{m.role === "user" ? t("aichat.you") : t("aichat.ai")} · {time(m.createdAt)}</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.content ? <Md text={m.content} /> : <span className="sub">{tool ? t(`aichat.tool.${tool}` as MessageKey) : t("aichat.thinking")}</span>}</div>
            {m.id === "live" && m.content && tool && <div className="sub" style={{ fontSize: 12 }}>{t(`aichat.tool.${tool}` as MessageKey)}</div>}
          </li>
        ))}
      </ol>
      <div ref={end} id="end" />
      {error && <p className="errtext" role="alert">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} style={{ display: "grid", gap: 8, position: "relative" }}>
        {showCmds && matches.length > 0 && (
          <ul role="listbox" aria-label={t("aichat.cmds")} className="card" style={{ listStyle: "none", margin: 0, padding: 6, position: "absolute", bottom: "100%", left: 0, right: 0, zIndex: 5 }}>
            {matches.map((c) => (
              <li key={c}><button type="button" className="listbtn" style={{ width: "100%", textAlign: "left" }} onClick={() => setText(`/${c} `)}><b>/{c}</b> <span className="sub">– {t(`aichat.cmd.desc.${c}` as MessageKey)}</span></button></li>
            ))}
          </ul>
        )}
        <textarea name="text" rows={3} className="field" maxLength={4000} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={t(incident ? "aichat.placeholderIncident" : "aichat.placeholder")} aria-label={t("aichat.send")}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <button className="btn" disabled={busy || !text.trim()}>{t("aichat.send")}</button>
          {busy && <span className="sub" role="status">{tool ? t(`aichat.tool.${tool}` as MessageKey) : t("aichat.thinking")}</span>}
        </div>
      </form>
    </>
  );
}
