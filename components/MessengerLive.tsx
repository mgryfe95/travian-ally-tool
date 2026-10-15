"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
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

export function DmComposer({ threadId }: { threadId: number }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (busy || !body.trim()) return;
    setBusy(true);
    setError(undefined);
    const res = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ threadId, body }) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Senden fehlgeschlagen");
    setBody("");
    router.refresh();
    input.current?.focus();
  }

  return (
    <form onSubmit={send} style={{ borderTop: "1px solid #2c271f", paddingTop: 12 }}>
      <label className="sr" htmlFor="dm-body">Nachricht</label>
      <textarea id="dm-body" ref={input} className="field" rows={2} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) void send(e as unknown as FormEvent); }} placeholder="Nachricht schreiben – Enter sendet, Umschalt+Enter neue Zeile" style={{ width: "100%" }} />
      <div className="row" style={{ marginTop: 8 }}><button className="btn" disabled={busy}>Senden</button>{error && <span className="errtext" role="alert">{error}</span>}</div>
    </form>
  );
}
