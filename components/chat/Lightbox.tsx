"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";

export type LightboxImage = { id: number; name: string };

/** Vollbild-Ansicht: Blättern (‹ ›, Pfeiltasten), Zoom (Klick / Mausrad), Download, Esc schließt. */
export function Lightbox({ images, start, onClose }: { images: LightboxImage[]; start: number; onClose: () => void }) {
  const t = useT();
  const [i, setI] = useState(start);
  const [zoom, setZoom] = useState(1);
  const closeRef = useRef<HTMLButtonElement>(null);
  const img = images[i] as LightboxImage;
  const go = (d: number) => {
    setZoom(1);
    setI((x) => (x + d + images.length) % images.length);
  };
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={t("chat.lightbox.label")} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        style={{ width: "min(92vw, 1100px)", height: "min(72vh, 700px)", overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}
        onWheel={(e) => setZoom((z) => Math.min(4, Math.max(1, z - e.deltaY / 500)))}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- geschützter Endpoint, keine Next-Bildoptimierung */}
        <img
          src={`/api/attachments/${img.id}?v=web`} alt={img.name} onClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
          style={{ maxWidth: zoom === 1 ? "100%" : "none", maxHeight: zoom === 1 ? "100%" : "none", width: zoom === 1 ? undefined : `${zoom * 100}%`, cursor: zoom > 1 ? "zoom-out" : "zoom-in", borderRadius: 8 }}
        />
      </div>
      <div className="sub">{img.name} · {i + 1} / {images.length}</div>
      <div className="row">
        {images.length > 1 && <button type="button" className="btn ghost" onClick={() => go(-1)}>{t("chat.lightbox.prev")}</button>}
        <a className="btn ghost" href={`/api/attachments/${img.id}?v=dl`} download={img.name}>{t("chat.lightbox.download")}</a>
        {images.length > 1 && <button type="button" className="btn ghost" onClick={() => go(1)}>{t("chat.lightbox.next")}</button>}
        <button ref={closeRef} type="button" className="btn" onClick={onClose}>{t("chat.lightbox.close")}</button>
      </div>
    </div>
  );
}
