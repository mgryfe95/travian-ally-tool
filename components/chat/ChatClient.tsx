"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from "react";
import { mentionHandle } from "@/lib/chat/mentions";
import { useT } from "@/lib/i18n/client";
import type { ChannelView, MessageView, TagTypeView } from "@/lib/services/chat";
import { Lightbox, type LightboxImage } from "./Lightbox";
import { MessageItem } from "./Message";
import { getSocket } from "./socket";

type Pending = { key: string; id?: number; name: string; preview?: string; kind?: string; error?: string };

export type ChatProps = {
  me: { id: string; role: string };
  channels: ChannelView[];
  tagTypes: TagTypeView[];
  current: number | "all";
  initial: { messages: MessageView[]; nextBefore: number | null };
  focusId?: number;
  people: { id: string; name: string }[];
  caps: { canUpload: boolean; canModerate: boolean; canCreateTf: boolean };
  limits: { maxFiles: number; maxImageMb: number; maxFileMb: number };
};

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf,.txt,.csv,.log";

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(url, init);
  return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as T & { error?: string } };
}

export function ChatClient(props: ChatProps) {
  const { me, channels, tagTypes, current, caps, limits } = props;
  const router = useRouter();
  const t = useT();
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
  const [replyTo, setReplyTo] = useState<MessageView | null>(null);
  const [focus, setFocus] = useState(props.focusId);
  const [picked, setPicked] = useState<Record<number, number[]>>({});
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
  const sendTree = channels.find((c) => c.id === sendChannel)?.tree;
  // Typen, die im Zielkanal angeboten werden
  const offered = useMemo(() => tagTypes.filter((t) => (sendChannel !== undefined && t.channelIds.includes(sendChannel)) || (sendTree === "TASKFORCE" && t.forTaskforces)), [tagTypes, sendChannel, sendTree]);
  const togglePick = (t: TagTypeView, id: number) =>
    setPicked((p) => {
      const cur = p[t.id] ?? [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : t.multi ? [...cur, id] : [id];
      return { ...p, [t.id]: next };
    });

  const mentionQuery = /(?:^|\s)@([\p{L}\p{N}_.\-]*)$/u.exec(body)?.[1]?.toLowerCase();
  const suggestions = mentionQuery === undefined ? [] : props.people.filter((p) => p.id !== me.id && mentionHandle(p.name).startsWith(mentionQuery)).slice(0, 6);

  const scrollDown = () => requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
  useEffect(() => {
    if (props.focusId) {
      requestAnimationFrame(() => document.getElementById(`msg-${props.focusId}`)?.scrollIntoView({ block: "center" }));
      const timer = setTimeout(() => setFocus(undefined), 4000);
      return () => clearTimeout(timer);
    }
    scrollDown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setError(t("chat.upload.max", { n: limits.maxFiles }));
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
        if (!r.ok) return [{ ...x, error: r.data.error ?? t("chat.upload.failed") }];
        const a = r.data.attachments[idx];
        return a ? [{ ...x, id: a.id, kind: a.kind }] : [];
      }),
    );
    if (!r.ok) setError(r.data.error ?? t("chat.upload.failed"));
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
    if (pending.some((p) => !p.id && !p.error)) return setError(t("chat.upload.pending"));
    if (!body.trim() && ready.length === 0) return;
    const missing = offered.find((t) => t.required && !(picked[t.id]?.length));
    if (missing) return setError(t("chat.tag.required", { name: missing.name }));
    setBusy(true);
    setError(undefined);
    const r = await api<MessageView>("/api/chat/messages", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ channelId: sendChannel, body, tagIds: offered.flatMap((t) => picked[t.id] ?? []), attachmentIds: ready.map((p) => p.id), replyToId: replyTo?.id }),
    });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? t("chat.send.failed"));
    setBody("");
    setReplyTo(null);
    setPending([]);
    setPicked({});
    if (tagFilter === null && !q.trim()) setMessages((list) => (list.some((x) => x.id === r.data.id) ? list : [...list, r.data]));
    scrollDown();
  }

  const editMsg = async (id: number, text: string) => {
    const r = await api<MessageView>(`/api/chat/messages/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: text }) });
    if (!r.ok) return r.data.error ?? t("chat.action.failed");
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
  const title = isAll ? t("chat.title.all") : cur ? (cur.tree === "ALLY" ? `# ${cur.name}` : cur.name) : t("chat.title.chat");
  const subtitle = isAll ? t("chat.subtitle.all") : cur?.tree === "TASKFORCE" ? t("chat.subtitle.taskforce") : t("chat.subtitle.ally");
  const hasFilter = tagFilter !== null || q.trim() !== "";

  return (
    <div className="chat">
      <aside className="chat-aside" aria-label={t("chat.aside.label")}>
        <div className="sect">{t("chat.aside.alliance")}</div>
        <Link className={`listbtn ${isAll ? "on" : ""}`} href="/chat?c=all" aria-current={isAll ? "page" : undefined}>
          <span>{t("chat.aside.all")}</span>{allUnread ? <span className="badge mono">{allUnread}</span> : null}
        </Link>
        {ally.map((c) => chBtn(c, `# ${c.name}`))}
        <div className="sect">
          {t("chat.aside.taskforces")}
          {caps.canCreateTf && <Link href="/chat/tf/new" aria-label={t("chat.aside.newTf")} className="btn ghost sm" style={{ minHeight: 28, width: 28, padding: 0 }}>+</Link>}
        </div>
        {tfs.map((c) => chBtn(c, c.name))}
        {tfs.length === 0 && <p className="sub" style={{ padding: "0 10px", fontSize: 12 }}>{t("chat.aside.noTf")}</p>}
      </aside>

      <section className="chat-main" onDragOver={(e) => { if (caps.canUpload) { e.preventDefault(); setDrag(true); } }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
        style={drag ? { outline: "2px dashed var(--accent)", outlineOffset: -6 } : undefined}>
        <header className="row between" style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)" }}>
          <div>
            <div className="chat-mobile-only">
              <label className="lbl" htmlFor="mch" style={{ margin: 0 }}>{t("chat.channel")}</label>
              <select id="mch" value={String(current)} onChange={(e) => router.push(`/chat?c=${e.target.value}`)} style={{ minHeight: 44, background: "transparent", color: "var(--text)", border: 0, fontWeight: 600, fontSize: 18, padding: 0 }}>
                <option value="all">{t("chat.aside.all")}</option>
                {ally.map((c) => <option key={c.id} value={c.id}># {c.name}{unread[c.id] ? ` (${unread[c.id]})` : ""}</option>)}
                {tfs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <h1 style={{ fontSize: 19, margin: 0 }} className="chat-title">{title}</h1>
            <div className="sub" style={{ fontSize: 12 }}>{subtitle}{cur?.tree === "TASKFORCE" && cur.taskforceId ? <> · <Link href={`/chat/tf/${cur.taskforceId}`}>{t("chat.manage")}</Link></> : null}</div>
          </div>
          <div className="row" role="group" aria-label={t("chat.filter.label")} style={{ gap: 8 }}>
            <label className="sr" htmlFor="chat-q">{t("chat.search")}</label>
            <input id="chat-q" className="field" placeholder={t("chat.search.placeholder")} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 150, minHeight: 32 }} />
            <button type="button" className={`filterchip ${tagFilter === null ? "on" : ""}`} onClick={() => setTagFilter(null)}>{t("chat.filter.allTags")}</button>
            {tagTypes.filter((tt) => tt.tags.length > 0).map((tt) => (
              <span key={tt.id} className="row" role="group" aria-label={tt.name} style={{ gap: 4, alignItems: "center" }}>
                <span className="sub" style={{ fontSize: 11 }}>{tt.name}:</span>
                {tt.tags.map((g) => <button key={g.id} type="button" className={`filterchip ${tagFilter === g.id ? "on" : ""}`} onClick={() => setTagFilter(tagFilter === g.id ? null : g.id)}>{g.name}</button>)}
              </span>
            ))}
          </div>
        </header>

        <div className="chat-msgs" ref={listRef} aria-live="polite" aria-label={t("chat.messages")}>
          {nextBefore && <button type="button" className="btn ghost sm" style={{ alignSelf: "center" }} onClick={loadOlder}>{t("chat.loadOlder")}</button>}
          {messages.length === 0 && <div className="sub" style={{ padding: "40px 0", textAlign: "center" }}>{hasFilter ? t("chat.noMatches") : t("chat.empty")}</div>}
          {messages.map((m) => (
            <MessageItem key={m.id} m={m} showChannel={isAll} focused={focus === m.id} onReply={canWriteHere ? (x) => { setReplyTo(x); document.getElementById("msg")?.focus(); } : undefined} canEdit={m.author.id === me.id} canDelete={m.author.id === me.id || caps.canModerate}
              onEdit={editMsg} onDelete={delMsg} onOpenImage={(images, start) => setLightbox({ images, start })} />
          ))}
        </div>

        {canWriteHere ? (
          <form onSubmit={send} style={{ borderTop: "1px solid var(--line)", padding: "14px 24px" }}>
            {pending.length > 0 && (
              <div className="row" style={{ marginBottom: 10, gap: 10 }} aria-label={t("chat.attachments.label")}>
                {pending.map((p) => (
                  <div key={p.key} style={{ position: "relative" }}>
                    <div style={{ width: 64, height: 64, borderRadius: 8, border: `1px solid ${p.error ? "var(--warn)" : "var(--line)"}`, overflow: "hidden", background: "var(--soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- lokale Blob-URL */}
                      {p.preview ? <img src={p.preview} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: p.id ? 1 : 0.5 }} /> : <span>{p.kind ?? "…"}</span>}
                    </div>
                    <button type="button" aria-label={t("chat.attachments.remove", { name: p.name })} onClick={() => setPending((l) => l.filter((x) => x.key !== p.key))}
                      style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24, borderRadius: 12, border: 0, background: "var(--field-line)", color: "var(--text)", cursor: "pointer" }}>×</button>
                    <div className="sub" style={{ fontSize: 10, maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.error ?? p.name}</div>
                  </div>
                ))}
              </div>
            )}
            {replyTo && (
              <div className="row" style={{ marginBottom: 8, gap: 8 }}>
                <span className="sub" style={{ fontSize: 13 }}>{t("chat.reply.to", { name: replyTo.author.name })}: {replyTo.body.slice(0, 80)}</span>
                <button type="button" className="btn ghost sm" style={{ minHeight: 28 }} onClick={() => setReplyTo(null)}>{t("chat.reply.cancel")}</button>
              </div>
            )}
            <div className="row" style={{ alignItems: "flex-end", gap: 8 }}>
              {isAll && (
                <div>
                  <label className="lbl" htmlFor="chs">{t("chat.channel")}</label>
                  <select id="chs" className="field" style={{ width: "auto" }} value={target} onChange={(e) => setTarget(Number(e.target.value))}>
                    {writable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {offered.map((tt) =>
                tt.multi ? (
                  <fieldset key={tt.id} style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="lbl">{tt.name}{tt.required ? " *" : ""}</legend>
                    <div className="row" style={{ gap: 6 }}>
                      {tt.tags.map((g) => (
                        <button key={g.id} type="button" aria-pressed={(picked[tt.id] ?? []).includes(g.id)} className={`filterchip ${(picked[tt.id] ?? []).includes(g.id) ? "on" : ""}`} onClick={() => togglePick(tt, g.id)}>{g.name}</button>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  <div key={tt.id}>
                    <label className="lbl" htmlFor={`tt-${tt.id}`}>{tt.name}{tt.required ? " *" : ""}</label>
                    <select id={`tt-${tt.id}`} aria-label={tt.name} className="field" style={{ width: "auto" }} value={picked[tt.id]?.[0] ?? ""} onChange={(e) => setPicked((p) => ({ ...p, [tt.id]: e.target.value ? [Number(e.target.value)] : [] }))}>
                      <option value="">— {tt.required ? t("chat.tag.pick") : t("chat.tag.none")} —</option>
                      {tt.tags.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                ),
              )}
              {caps.canUpload && (
                <>
                  <label className="btn ghost" style={{ padding: "0 12px" }} aria-label={t("chat.attach.label")} title={t("chat.attach.title", { files: limits.maxFiles, image: limits.maxImageMb, file: limits.maxFileMb })}>
                    📎<input type="file" multiple accept={ACCEPT} className="sr" onChange={(e) => { void upload([...(e.target.files ?? [])]); e.target.value = ""; }} />
                  </label>
                </>
              )}
              <div style={{ flex: "1 1 260px" }}>
                <label className="lbl" htmlFor="msg">{t("chat.message")}</label>
                <input id="msg" className="field" value={body} onChange={(e) => setBody(e.target.value)} onPaste={onPaste} maxLength={4000} autoComplete="off" placeholder={t("chat.message.placeholder")} />
                {suggestions.length > 0 && (
                  <ul role="listbox" aria-label={t("chat.mention.suggest")} style={{ listStyle: "none", margin: "4px 0 0", padding: 4, border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg)" }}>
                    {suggestions.map((p) => (
                      <li key={p.id} role="option" aria-selected="false"><button type="button" className="btn ghost sm" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => setBody(body.replace(/@([\p{L}\p{N}_.\-]*)$/u, `@${p.name.trim().replace(/\s+/g, "_")} `))}>@{p.name}</button></li>
                    ))}
                  </ul>
                )}
              </div>
              <button className="btn" disabled={busy || !sendChannel}>{t("chat.send")}</button>
            </div>
            {error && <p className="errtext" role="alert" style={{ marginTop: 6 }}>{error}</p>}
          </form>
        ) : (
          <div className="sub" style={{ borderTop: "1px solid var(--line)", padding: "14px 24px" }}>{isAll ? t("chat.pickChannel") : t("chat.readOnly")}</div>
        )}
      </section>
      {lightbox && <Lightbox images={lightbox.images} start={lightbox.start} onClose={() => setLightbox(undefined)} />}
    </div>
  );
}
