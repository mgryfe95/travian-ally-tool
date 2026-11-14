"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";

type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Chrome/Edge/Samsung: Installations-Dialog direkt auslösen (erscheint nur, wenn der Browser es anbietet). */
export function InstallButton() {
  const t = useT();
  const [evt, setEvt] = useState<Prompt | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
    const on = (e: Event) => { e.preventDefault(); setEvt(e as Prompt); };
    const done = () => { setInstalled(true); setEvt(null); };
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", on); window.removeEventListener("appinstalled", done); };
  }, []);
  if (installed) return <p className="pill p-ok" role="status">{t("install.installed")}</p>;
  if (!evt) return null;
  return <button className="btn" onClick={async () => { await evt.prompt(); const c = await evt.userChoice; if (c.outcome === "accepted") setInstalled(true); setEvt(null); }}>{t("install.button")}</button>;
}
