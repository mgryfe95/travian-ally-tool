"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";

type State = "loading" | "unsupported" | "serverOff" | "denied" | "off" | "on";

const b64ToBytes = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** Gerät für Push an-/abmelden und Testnachricht senden. Der Service Worker liegt unter /sw.js. */
export function PushDevice() {
  const t = useT();
  const [state, setState] = useState<State>("loading");
  const [key, setKey] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      const { publicKey } = (await fetch("/api/push").then((r) => r.json()).catch(() => ({ publicKey: null }))) as { publicKey: string | null };
      if (!publicKey) return setState("serverOff");
      setKey(publicKey);
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    if (!key) return;
    setBusy(true);
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
      const r = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      if (!r.ok) throw new Error(String(r.status));
      setState("on");
      setMsg(t("notify.enabled"));
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ unsubscribe: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
      setMsg("");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const r = (await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ test: true }) }).then((x) => x.json()).catch(() => ({ sent: 0 }))) as { sent: number };
    setMsg(t("notify.testSent", { n: r.sent }));
    setBusy(false);
  }

  if (state === "loading") return <p className="sub">…</p>;
  if (state === "unsupported") return <p className="sub">{t("notify.unsupported")}</p>;
  if (state === "serverOff") return <p className="sub">{t("notify.serverOff")}</p>;
  if (state === "denied") return <p className="errtext">{t("notify.denied")}</p>;
  return (
    <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {state === "off"
        ? <button className="btn sm" onClick={enable} disabled={busy}>{t("notify.enable")}</button>
        : <><span className="pill p-ok">{t("notify.enabled")}</span><button className="btn ghost sm" onClick={disable} disabled={busy}>{t("notify.disable")}</button><button className="btn ghost sm" onClick={test} disabled={busy}>{t("notify.test")}</button></>}
      {msg && <span className="sub" role="status">{msg}</span>}
    </div>
  );
}
