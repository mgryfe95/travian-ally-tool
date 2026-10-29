"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

const MAX = 200;
const PASTE = /([-−–]?\d{1,3})\s*[|,;/:\s]\s*([-−–]?\d{1,3})/;
const norm = (s: string) => s.replace(/[−–]/g, "-");
const num = (s: string): number | null => (/^-?\d{1,3}$/.test(s) && Math.abs(Number(s)) <= MAX ? Number(s) : null);
const initial = (v: string): [string, string] => {
  const m = PASTE.exec(v);
  return m ? [norm(m[1]!), norm(m[2]!)] : ["", ""];
};

/**
 * Koordinaten-Eingabe ohne Formatfehler: je ein Feld für X und Y mit −/+ und Vorzeichen-Taste (±); Einfügen von „(12|-34)“, „12,-34“ usw.
 * füllt beide Felder. Gesendet wird ein einziges Feld `name` im Format `x|y` (leer, solange die Eingabe unvollständig oder ungültig ist).
 */
export function CoordInput({ name, defaultValue = "", required = false, idPrefix = "coord" }: { name: string; defaultValue?: string; required?: boolean; idPrefix?: string }) {
  const t = useT();
  const [init] = useState(() => initial(defaultValue));
  const [xy, setXy] = useState<[string, string]>(init);
  const set = (i: 0 | 1, v: string) => setXy((cur) => (i === 0 ? [v, cur[1]] : [cur[0], v]));
  const clamp = (n: number) => Math.max(-MAX, Math.min(MAX, n));
  const step = (i: 0 | 1, d: number) => set(i, String(clamp((num(xy[i]) ?? 0) + d)));
  const flip = (i: 0 | 1) => { const n = num(xy[i]); if (n !== null) set(i, String(-n)); else if (xy[i] === "-") set(i, ""); else set(i, "-"); };
  const x = num(xy[0]), y = num(xy[1]);
  const field = (i: 0 | 1, axis: "X" | "Y") => (
    <div className="coordaxis" role="group" aria-label={axis}>
      <span className="lbl" style={{ margin: 0 }} aria-hidden="true">{axis}</span>
      <button type="button" className="btn ghost sm" aria-label={t("common.coord.minus", { axis })} onClick={() => step(i, -1)}>−</button>
      <input
        id={`${idPrefix}-${axis.toLowerCase()}`} className="field mono" inputMode="numeric" autoComplete="off" aria-label={axis} style={{ width: 76, textAlign: "center" }} required={required}
        value={xy[i]} placeholder="0"
        onChange={(e) => { const v = norm(e.target.value); if (/^-?\d{0,3}$/.test(v)) set(i, v); }}
        onPaste={(e) => {
          const m = PASTE.exec(e.clipboardData.getData("text"));
          if (m) { e.preventDefault(); setXy([norm(m[1]!), norm(m[2]!)]); }
        }}
      />
      <button type="button" className="btn ghost sm" aria-label={t("common.coord.plus", { axis })} onClick={() => step(i, 1)}>+</button>
      <button type="button" className="btn ghost sm" aria-label={t("common.coord.sign", { axis })} onClick={() => flip(i)}>±</button>
    </div>
  );
  return (
    <div className="coordinput">
      {field(0, "X")}
      {field(1, "Y")}
      <input type="hidden" name={name} value={x !== null && y !== null ? `${x}|${y}` : ""} />
      <span className="sub" style={{ fontSize: 12, flexBasis: "100%" }}>{t("common.coord.hint")}</span>
    </div>
  );
}
