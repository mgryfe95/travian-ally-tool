"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from "react";
import type { ChannelView, MessageView } from "@/lib/services/chat";
import { Lightbox, type LightboxImage } from "./Lightbox";
import { MessageItem } from "./Message";
import { getSocket } from "./socket";

type Tag = { id: number; name: string; color: string };
type Pending = { key: string; id?: number; name: string; preview?: string; kind?: string; error?: string };

export type ChatProps = {
  me: { id: string; role: string };
  channels: ChannelView[];
  tags: Tag[];
  current: number | "all";
  initial: { messages: MessageView[]; nextBefore: number | null };
  caps: { canUpload: boolean; canModerate: boolean; canCreateTf: boolean };
  limits: { maxFiles: number; maxImageMb: number; maxFileMb: number };
};

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf,.txt,.csv,.log";

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(url, init);
  return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as T & { error?: string } };
}

export function ChatClient(props: ChatProps) {
  const { me, channels, tags, current, caps, limits } = props;
  const router = useRouter();
  const ally = useMemo(() => channels.filter((c) => c.tree === "ALLY"), [channels]);
  const tfs = useMemo(() => channels.filter((c) => c.tree === "TASKFORCE"), [channels]);
  const cur = typeof current === "number" ? channels.find((c) => c.id === current) : undefined;
  const isAll = current === "all";

  const [messages, setMessages] = useState(props.initial.messages);
  const [nextBefore, setNextBefore] = useState(props.initial.nextBefore);
  const [unread, setUnread] = useState<Record<number, number>>(() => Object.fromEntries(channels.map((c) => [c.id, c.unread])));
  const [tagFilter, setTagFilter] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [body, setBody] = useState("");
  const [tagId, setTagId] = useState("");
  const writable = ally.filter((c) => c.canWrite);
  const [target, setTarget] = useState<number | undefined>(writable[0]?.id);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; start: number }>();
  const [drag, setDrag] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const live = useRef({ tagFilter, q, current, ally, me });
  live.current = { tagFilter, q, current, ally, me };

  const canWriteHere = isAll ? writable.length > 0 : !!cur?.canWrite;
  const sendChannel = isAll ? target : cur?.id;

  const scrollDown = () => requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
  useEffect(() => {
    scrollDown();
  }, []);

  const markRead = useCallback(async (ids: number[]) => {
    for (const id of ids) await fetch("/api/chat/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channelId: id }) });
    setUnread((u) => ({ ...u, ...Object.fromEntries(ids.map((id) => [id, 0])) }));
  }, []);

  // Beim Öffnen als gelesen markieren.
  useEffect(() => {
    const ids = isAll ? ally.map((c) => c.id) : cur ? [cur.id] : [];
    void markRead(ids.filter((id) => (props.channels.find((c) => c.id === id)?.unread ?? 0) > 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: Räume aller lesbaren Kanäle (Rechteprüfung beim Join serverseitig).
  useEffect(() => {
    const socket = getSocket();
    const joinAll = () => channels.forEach((c) => socket.emit("join", c.id));
    if (socket.connected) joinAll();
    socket.on("connect", joinAll);
    const inView = (channelId: number) => {
      const l = live.current;
      return l.current === "all" ? l.ally.some((c) => c.id === channelId) : l.current === channelId;
    };
    const matches = (m: MessageView) => (live.current.tagFilter === null || m.tags.some((t) => t.id === live.current.tagFilter)) && live.current.q.trim() === "";
    const onNew = (m: MessageView) => {
      if (inView(m.channelId)) {
        if (matches(m)) {
          setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
          scrollDown();
        }
        if (m.author.id !== live.current.me.id) void markRead([m.channelId]);
      } else if (m.author.id !== live.current.me.id) setUnread((u) => ({ ...u, [m.channelId]: (u[m.channelId] ?? 0) + 1 }));
    };
    const onEdit = (m: MessageView) => setMessages((list) => list.map((x) => (x.id === m.id ? m : x)));
    const onDelete = ({ id }: { id: number }) => setMessages((list) => list.filter((x) => x.id !== id));
    socket.on("message:new", onNew);
    socket.on("message:edit", onEdit);
    socket.on("message:delete", onDelete);
    return () => {
      socket.off("connect", joinAll);
      socket.off("message:new", onNew);
      socket.off("message:edit", onEdit);
      socket.off("message:delete", onDelete);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = useCallback(async (opts: { tag: number | null; text: string; before?: number }) => {
    const p = new URLSearchParams({ channel: String(current) });
    if (opts.tag !== null) p.set("tag", String(opts.tag));
    if (opts.text.trim()) p.set("q", opts.text.trim());
    if (opts.before) p.set("before", String(opts.before));
    return api<{ messages: MessageView[]; nextBefore: number | null }>(`/api/chat/messages?${p}`);
  }, [current]);

  // Filter/Suche neu laden (Suche entprellt).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const r = await query({ tag: tagFilter, text: q });
      if (r.ok) {
        setMessages(r.data.messages);
        setNextBefore(r.data.nextBefore);
        scrollDown();
      } else setError(r.data.error);
    }, 250);
    return () => clearTimeout(t);
  }, [tagFilter, q, query]);

  async function loadOlder() {
    if (!nextBefore) return;
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const r = await query({ tag: tagFilter, text: q, before: nextBefore });
    if (!r.ok) return setError(r.data.error);
    setMessages((list) => [...r.data.messages, ...list]);
    setNextBefore(r.data.nextBefore);
    requestAnimationFrame(() => el && (el.scrollTop = el.scrollHeight - prevHeight));
  }

  async function upload(files: File[]) {
    if (!caps.canUpload || files.length === 0) return;
    setError(undefined);
    const room = limits.maxFiles - pending.length;
    if (files.length > room) {
      setError(`Maximal ${limits.maxFiles} Dateien pro Nachricht`);
      files = files.slice(0, Math.max(room, 0));
    }
    const items: Pending[] = files.map((f) => ({ key: `${f.name}-${f.size}-${Math.random()}`, name: f.name, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined }));
    setPending((p) => [...p, ...items]);
    const form = new FormData();
    files.forEach((f) => form.append("file", f));
    const r = await api<{ attachments: { id: number; kind: string; name: string }[] }>("/api/chat/upload", { method: "POST", body: form });
    setPending((p) =>
      p.flatMap((x) => {
        const idx = items.findIndex((i) => i.key === x.key);
        if (idx < 0) return [x];
        if (!r.ok) return [{ ...x, error: r.data.error ?? "Upload fehlgeschlagen" }];
        const a = r.data.attachments[idx];
        return a ? [{ ...x, id: a.id, kind: a.kind }] : [];
      }),
    );
    if (!r.ok) setError(r.data.error ?? "Upload fehlgeschlagen");
  }

  const onPaste = (e: ClipboardEvent) => {
    const files = [...e.clipboardData.files];
    if (files.length) {
      e.preventDefault();
      void upload(files);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void upload([...e.dataTransfer.files]);
  };

  async function send(e: FormEvent) {
    e.preventDefault();
    if (busy || !sendChannel) return;
    const ready = pending.filter((p) => p.id);
    if (pending.some((p) => !p.id && !p.error)) return setError("Upload läuft noch …");
    if (!body.trim() && ready.length === 0) return;
    setBusy(true);
    setError(undefined);
    const r = await api<MessageView>("/api/chat/messages", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ channelId: sendChannel, body, tagIds: tagId ? [Number(tagId)] : [], attachmentIds: ready.map((p) => p.id) }),
    });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "Senden fehlgeschlagen");
    setBody("");
    setPending([]);
    setTagId("");
    if (tagFilter === null && !q.trim()) setMessages((list) => (list.some((x) => x.id === r.data.id) ? list : [...list, r.data]));
    scrollDown();
  }

  const editMsg = async (id: number, text: string) => {
    const r = await api<MessageView>(`/api/chat/messages/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: text }) });
    if (!r.ok) return r.data.error ?? "Fehlgeschlagen";
    setMessages((list) => list.map((x) => (x.id === id ? r.data : x)));
    return undefined;
  };
  const delMsg = async (id: number) => {
    const r = await api<object>(`/api/chat/messages/${id}`, { method: "DELETE" });
    if (r.ok) setMessages((list) => list.filter((x) => x.id !== id));
    else setError(r.data.error);
  };

  const allUnread = ally.reduce((n, c) => n + (unread[c.id] ?? 0), 0);
  const chBtn = (c: ChannelView, label: string) => (
    <Link key={c.id} className={`listbtn ${current === c.id ? "on" : ""}`} href={`/chat?c=${c.id}`} aria-current={current === c.id ? "page" : undefined}>
      <span>{label}</span>
      {unread[c.id] ? <span className="badge mono">{unread[c.id]}</span> : c.tree === "TASKFORCE" ? <span className="sub" style={{ fontSize: 12 }}>{c.memberCount}</span> : null}
    </Link>
  );
  const title = isAll ? "Alle Kanäle" : cur ? (cur.tree === "ALLY" ? `# ${cur.name}` : cur.name) : "Chat";
  const subtitle = isAll ? "Sammelraum: Nachrichten aller Allianz-Kanäle, die du lesen darfst (ohne Task-Forces)" : cur?.tree === "TASKFORCE" ? "Task-Force · nur für Mitglieder sichtbar" : "Allianz-Kanal";
  const hasFilter = tagFilter !== null || q.trim() !== "";

  return (
    <div className="chat">
      <aside className="chat-aside" aria-label="Kanäle">
        <div className="sect">Allianz</div>
        <Link className={`listbtn ${isAll ? "on" : ""}`} href="/chat?c=all" aria-current={isAll ? "page" : undefined}>
          <span>Alle (Sammelraum)</span>{allUnread ? <span className="badge mono">{allUnread}</span> : null}
        </Link>
        {ally.map((c) => chBtn(c, `# ${c.name}`))}
        <div className="sect">
          Task-Forces
          {caps.canCreateTf && <Link href="/chat/tf/new" aria-label="Task-Force anlegen" className="btn ghost sm" style={{ minHeight: 28, width: 28, padding: 0 }}>+</Link>}
        </div>
        {tfs.map((c) => chBtn(c, c.name))}
        {tfs.length === 0 && <p className="sub" style={{ padding: "0 10px", fontSize: 12 }}>Keine Task-Force.</p>}
      </aside>

      <section className="chat-main" onDragOver={(e) => { if (caps.canUpload) { e.preventDefault(); setDrag(true); } }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
        style={drag ? { outline: "2px dashed var(--accent)", outlineOffset: -6 } : undefined}>
        <header className="row between" style={{ padding: "16px 24px", borderBottom: "1px solid #2c271f" }}>
          <div>
            <div className="chat-mobile-only">
              <label className="lbl" htmlFor="mch" style={{ margin: 0 }}>Kanal</label>
              <select id="mch" value={String(current)} onChange={(e) => router.push(`/chat?c=${e.target.value}`)} style={{ minHeight: 44, background: "transparent", color: "var(--text)", border: 0, fontWeight: 600, fontSize: 18, padding: 0 }}>
                <option value="all">Alle (Sammelraum)</option>
                {ally.map((c) => <option key={c.id} value={c.id}># {c.name}{unread[c.id] ? ` (${unread[c.id]})` : ""}</option>)}
                {tfs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <h1 style={{ fontSize: 19, margin: 0 }} className="chat-title">{title}</h1>
            <div className="sub" style={{ fontSize: 12 }}>{subtitle}{cur?.tree === "TASKFORCE" && cur.taskforceId ? <> · <Link href={`/chat/tf/${cur.taskforceId}`}>Verwalten</Link></> : null}</div>
          </div>
          <div className="row" role="group" aria-label="Nach Tag filtern" style={{ gap: 8 }}>
            <label className="sr" htmlFor="chat-q">Suchen</label>
            <input id="chat-q" className="field" placeholder="Suchen …" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 150, minHeight: 32 }} />
            <button type="button" className={`filterchip ${tagFilter === null ? "on" : ""}`} onClick={() => setTagFilter(null)}>Alle Tags</button>
            {tags.map((t) => <button key={t.id} type="button" className={`filterchip ${tagFilter === t.id ? "on" : ""}`} onClick={() => setTagFilter(tagFilter === t.id ? null : t.id)}>{t.name}</button>)}
          </div>
        </header>

        <div className="chat-msgs" ref={listRef} aria-live="polite" aria-label="Nachrichten">
          {nextBefore && <button type="button" className="btn ghost sm" style={{ alignSelf: "center" }} onClick={loadOlder}>Ältere Nachrichten laden</button>}
          {messages.length === 0 && <div className="sub" style={{ padding: "40px 0", textAlign: "center" }}>{hasFilter ? "Keine Treffer." : "Noch keine Nachrichten in diesem Kanal."}</div>}
          {messages.map((m) => (
            <MessageItem key={m.id} m={m} showChannel={isAll} canEdit={m.author.id === me.id} canDelete={m.author.id === me.id || caps.canModerate}
              onEdit={editMsg} onDelete={delMsg} onOpenImage={(images, start) => setLightbox({ images, start })} />
          ))}
        </div>

        {canWriteHere ? (
          <form onSubmit={send} style={{ borderTop: "1px solid #2c271f", padding: "14px 24px" }}>
            {pending.length > 0 && (
              <div className="row" style={{ marginBottom: 10, gap: 10 }} aria-label="Anhänge vor dem Senden">
                {pending.map((p) => (
                  <div key={p.key} style={{ position: "relative" }}>
                    <div style={{ width: 64, height: 64, borderRadius: 8, border: `1px solid ${p.error ? "var(--warn)" : "var(--line)"}`, overflow: "hidden", background: "#221e18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- lokale Blob-URL */}
                      {p.preview ? <img src={p.preview} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: p.id ? 1 : 0.5 }} /> : <span>{p.kind ?? "…"}</span>}
                    </div>
                    <button type="button" aria-label={`Anhang ${p.name} entfernen`} onClick={() => setPending((l) => l.filter((x) => x.key !== p.key))}
                      style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24, borderRadius: 12, border: 0, background: "#403829", color: "var(--text)", cursor: "pointer" }}>×</button>
                    <div className="sub" style={{ fontSize: 10, maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.error ?? p.name}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="row" style={{ alignItems: "flex-end", gap: 8 }}>
              {isAll && (
                <div>
                  <label className="lbl" htmlFor="chs">Kanal</label>
                  <select id="chs" className="field" style={{ width: "auto" }} value={target} onChange={(e) => setTarget(Number(e.target.value))}>
                    {writable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="lbl" htmlFor="tag">Tag</label>
                <select id="tag" className="field" style={{ width: "auto" }} value={tagId} onChange={(e) => setTagId(e.target.value)}>
                  <option value="">— kein Tag —</option>
                  {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {caps.canUpload && (
                <>
                  <label className="btn ghost" style={{ padding: "0 12px" }} aria-label="Datei anhängen" title={`Bis zu ${limits.maxFiles} Dateien (Bild ${limits.maxImageMb} MB, sonst ${limits.maxFileMb} MB) – auch per Drag & Drop oder Strg+V`}>
                    📎<input type="file" multiple accept={ACCEPT} className="sr" onChange={(e) => { void upload([...(e.target.files ?? [])]); e.target.value = ""; }} />
                  </label>
                </>
              )}
              <div style={{ flex: "1 1 260px" }}>
                <label className="lbl" htmlFor="msg">Nachricht</label>
                <input id="msg" className="field" value={body} onChange={(e) => setBody(e.target.value)} onPaste={onPaste} maxLength={4000} autoComplete="off" placeholder="Nachricht schreiben – Koordinaten wie (12|-34) werden verlinkt" />
              </div>
              <button className="btn" disabled={busy || !sendChannel}>Senden</button>
            </div>
            {error && <p className="errtext" role="alert" style={{ marginTop: 6 }}>{error}</p>}
          </form>
        ) : (
          <div className="sub" style={{ borderTop: "1px solid #2c271f", padding: "14px 24px" }}>{isAll ? "Zum Schreiben bitte einen Kanal wählen." : "Du hast hier nur Leserechte."}</div>
        )}
      </section>
      {lightbox && <Lightbox images={lightbox.images} start={lightbox.start} onClose={() => setLightbox(undefined)} />}
    </div>
  );
}
