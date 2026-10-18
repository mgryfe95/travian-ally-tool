"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/client";

export type Marker = { key: string; label: string; x: number | null | undefined; y: number | null | undefined; tone: "bld" | "fld" };

/**
 * Screenshot mit Markierungen an den erkannten Stellen. Hover zeigt die Werte der Marke zum direkten Ändern (Klick hält sie fest);
 * im Platzierungsmodus setzt ein Klick aufs Bild die Position der gewählten Zeile.
 */
export function ShotMarkers({ imageUrl, markers, hoverKey, pinKey, placingKey, onHover, onPin, onPlace, renderEditor }: {
  imageUrl: string; markers: Marker[]; hoverKey: string | null; pinKey: string | null; placingKey: string | null;
  onHover: (key: string | null) => void; onPin: (key: string | null) => void; onPlace: (x: number, y: number) => void; renderEditor: (key: string) => ReactNode;
}) {
  const t = useT();
  const open = pinKey ?? hoverKey;
  return (
    <div style={{ position: "relative", display: "inline-block", maxWidth: "100%", lineHeight: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- geschützter Endpoint */}
      <img src={imageUrl} alt={t("shot.alt")} draggable={false} style={{ display: "block", maxWidth: "100%", maxHeight: 640, borderRadius: 8, cursor: placingKey ? "crosshair" : "default", userSelect: "none" }}
        onClick={(e) => {
          if (!placingKey) return;
          const r = e.currentTarget.getBoundingClientRect();
          onPlace(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
        }} />
      {markers.filter((m) => typeof m.x === "number" && typeof m.y === "number").map((m) => {
        const x = m.x as number, y = m.y as number;
        const shown = open === m.key;
        return (
          <div key={m.key} onMouseEnter={() => onHover(m.key)} onMouseLeave={() => onHover(null)}
            style={{ position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`, transform: "translate(-50%, -50%)", zIndex: shown ? 30 : 10, lineHeight: 1.3, pointerEvents: placingKey ? "none" : "auto" }}>
            <button type="button" aria-label={t("shot.marker", { n: m.label })} aria-pressed={pinKey === m.key} onClick={() => onPin(pinKey === m.key ? null : m.key)}
              style={{ width: 24, height: 24, borderRadius: 12, border: `2px solid ${shown ? "#fff" : "rgba(255,255,255,.85)"}`, background: m.tone === "bld" ? "#1e3556" : "#c8962e", color: m.tone === "bld" ? "#fff" : "#14253e", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0, boxShadow: shown ? "0 0 0 3px rgba(200,150,46,.7)" : "0 1px 3px rgba(0,0,0,.5)" }}>{m.label}</button>
            {shown && (
              <div role="dialog" aria-label={t("shot.marker", { n: m.label })}
                style={{ position: "absolute", top: 30, [x > 0.55 ? "right" : "left"]: -6, minWidth: 230, padding: 10, background: "var(--bg, #fbf6e9)", color: "var(--text, #2b2318)", border: "1px solid var(--line, #d9c9a3)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.35)" }}>
                {renderEditor(m.key)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
