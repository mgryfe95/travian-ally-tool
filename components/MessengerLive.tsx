"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FormatBar } from "./FormatBar";
import { useT } from "@/lib/i18n/client";
import { getSocket } from "./chat/socket";

/** Lädt die Seite bei `messenger:new` (persönlicher Socket-Raum) neu – Unterhaltungen und Zähler bleiben aktuell. */
export function MessengerLive() {
  const router = useRouter();
  useEffect(() => {
    const s = getSocket();
    const on = () => router.refresh();
    s.on("messenger:new", on);
    return () => void s.off("messenger:new", on);
  }, [router]);
  return null;
}

export function DmComposer({ threadId, canUpload = false }: { threadId: number; canUpload?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<{ id?: number; name: string; error?: string }[]>([]);
  const input = useRef<HTMLTextAreaElement>(null);

  async function upload(list: File[]) {
    if (!canUpload || list.length === 0) return;
    const form = new FormData();
    list.forEach((f) => form.append("file", f));
    setFiles((p) => [...p, ...list.map((f) => ({ name: f.name }))]);
    const res = await fetch("/api/chat/upload", { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as { attachments?: { id: number; name: string }[]; error?: string };
    setFiles((p) => {
      const rest = p.filter((x) => x.id !== undefined || x.error);
      return res.ok && data.attachments ? [...rest, ...data.attachments.map((a) => ({ id: a.id, name: a.name }))] : [...rest, ...list.map((f) => ({ name: f.name, error: data.error ?? t("messenger.dm.failed") }))];
    });
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const ready = files.filter((f) => f.id !== undefined).map((f) => f.id!);
    if (busy || (!body.trim() && ready.length === 0)) return;
    setBusy(true);
    setError(undefined);
    const res = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ threadId, body, attachmentIds: ready }) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setError(data.error ?? t("messenger.dm.failed"));
    setBody("");
    setFiles([]);
    router.refresh();
    input.current?.focus();
  }

  return (
    <form onSubmit={send} onPaste={(e) => { const f = [...e.clipboardData.files]; if (f.length) void upload(f); }} style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
      <div className="row between" style={{ marginBottom: 6 }}>
        <FormatBar target={input} value={body} onChange={setBody} />
        {canUpload && (
          <label className="btn ghost sm" style={{ minHeight: 28 }} aria-label={t("chat.attach.label")}>
            📎<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.txt,.csv,.log" className="sr" onChange={(e) => { void upload([...(e.target.files ?? [])]); e.target.value = ""; }} />
          </label>
        )}
      </div>
      {files.length > 0 && (
        <div className="row" style={{ gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
          {files.map((f, i) => (
            <span key={i} className={`pill ${f.error ? "p-wait" : "p-none"}`} style={{ fontSize: 12 }}>
              {f.id === undefined && !f.error ? "… " : ""}{f.name}{f.error ? ` – ${f.error}` : ""}
              <button type="button" aria-label={t("chat.attachments.remove", { name: f.name })} onClick={() => setFiles((p) => p.filter((_, k) => k !== i))} style={{ border: 0, background: "transparent", cursor: "pointer", marginLeft: 4 }}>×</button>
            </span>
          ))}
        </div>
      )}
      <label className="sr" htmlFor="dm-body">{t("messenger.dm.label")}</label>
      <textarea id="dm-body" ref={input} className="field" rows={2} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) void send(e as unknown as FormEvent); }} placeholder={t("messenger.dm.placeholder")} style={{ width: "100%" }} />
      <div className="row" style={{ marginTop: 8 }}><button className="btn" disabled={busy}>{t("messenger.dm.send")}</button>{error && <span className="errtext" role="alert">{error}</span>}</div>
    </form>
  );
}
