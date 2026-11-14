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
  // Hover (Bild oder Tabellenzeile) geht vor der festgehaltenen Marke – das Popup folgt immer der aktuellen Zeile
  const open = hoverKey ?? pinKey;
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
            {/* Hohler Ring statt gefülltem Punkt, damit die Zahl im Bild sichtbar bleibt; beim Hover wird er fast durchsichtig. Kleine Nummer oben rechts. */}
            <button type="button" aria-label={t("shot.marker", { n: m.label })} aria-pressed={pinKey === m.key} onClick={() => onPin(pinKey === m.key ? null : m.key)}
              style={{ position: "relative", width: 20, height: 20, borderRadius: 10, padding: 0, cursor: "pointer", background: "transparent", border: `2px solid ${m.tone === "bld" ? "#4f8be8" : "#f0b43c"}`, opacity: shown ? 0.35 : 0.9, boxShadow: "0 0 0 1px rgba(0,0,0,.55)", transition: "opacity .15s" }}>
              <span aria-hidden="true" style={{ position: "absolute", top: -9, right: -11, minWidth: 13, height: 13, padding: "0 2px", borderRadius: 7, fontSize: 9, lineHeight: "13px", fontWeight: 700, background: m.tone === "bld" ? "#1e3556" : "#c8962e", color: m.tone === "bld" ? "#fff" : "#14253e", opacity: shown ? 0.4 : 0.85 }}>{m.label}</span>
            </button>
            {shown && (
              <div role="dialog" aria-label={t("shot.marker", { n: m.label })}
                style={{ position: "absolute", top: 26, [x > 0.55 ? "right" : "left"]: -6, minWidth: 230, padding: 10, background: "var(--bg, #fbf6e9)", color: "var(--text, #2b2318)", border: "1px solid var(--line, #d9c9a3)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.35)" }}>
                {renderEditor(m.key)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
