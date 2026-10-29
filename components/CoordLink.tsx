"use client";

import { createContext, useContext, type ReactNode } from "react";
import { mapUrl } from "@/lib/coords";

const Ctx = createContext<string>("");

/** Stellt die Spielserver-URL bereit, damit jede Koordinate zum Direktlink auf die Travian-Karte werden kann. */
export function MapBaseProvider({ serverUrl, children }: { serverUrl: string; children: ReactNode }) {
  return <Ctx.Provider value={serverUrl}>{children}</Ctx.Provider>;
}

/** Zeigt die Koordinaten wie gehabt an (`(x|y)` bzw. eigener Text) und hinterlegt den Link zur Karte (neuer Tab). */
export function CoordLink({ x, y, text, className = "mono" }: { x: number; y: number; text?: string; className?: string }) {
  const base = useContext(Ctx);
  const label = text ?? `(${x}|${y})`;
  if (!base) return <span className={className}>{label}</span>;
  return <a className={className} href={mapUrl(base, x, y)} target="_blank" rel="noopener noreferrer">{label}</a>;
}
