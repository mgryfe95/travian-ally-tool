/**
 * Kleiner, sicherer Markdown-Teil für Chat-Nachrichten. Es entsteht ein Knotenbaum, kein HTML:
 * React rendert Text immer escaped, Links nur für http(s). **fett**, *kursiv*, `code`, [Text](https://…),
 * nackte URLs, Zeilenumbrüche und Koordinaten wie (12|-34).
 */
export type MdNode =
  | { t: "text"; v: string }
  | { t: "bold" | "italic"; c: MdNode[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: MdNode[] }
  | { t: "coord"; x: number; y: number; v: string }
  | { t: "br" };

const SAFE_URL = /^https?:\/\/[^\s<>"']+$/i;
export const COORD_RE = /\(\s*([-−–]?\d{1,3})\s*\|\s*([-−–]?\d{1,3})\s*\)/;
const num = (s: string) => Number(s.replace(/[−–]/g, "-"));

const INLINE: { re: RegExp; make: (m: RegExpExecArray, parse: (s: string) => MdNode[]) => MdNode | null }[] = [
  { re: /`([^`\n]+)`/, make: (m) => ({ t: "code", v: m[1] as string }) },
  { re: /\*\*([^*\n]+)\*\*/, make: (m, p) => ({ t: "bold", c: p(m[1] as string) }) },
  { re: /(?<![*\w])\*([^*\n]+)\*(?![*\w])/, make: (m, p) => ({ t: "italic", c: p(m[1] as string) }) },
  { re: /\[([^\]\n]+)\]\(([^)\s]+)\)/, make: (m, p) => (SAFE_URL.test(m[2] as string) ? { t: "link", href: m[2] as string, c: p(m[1] as string) } : null) },
  { re: /https?:\/\/[^\s<>"'()]+/i, make: (m) => ({ t: "link", href: m[0], c: [{ t: "text", v: m[0] }] }) },
  {
    re: new RegExp(COORD_RE.source),
    make: (m) => {
      const x = num(m[1] as string);
      const y = num(m[2] as string);
      return Math.abs(x) <= 200 && Math.abs(y) <= 200 ? { t: "coord", x, y, v: m[0] } : null;
    },
  },
];

function parseInline(src: string): MdNode[] {
  const out: MdNode[] = [];
  let rest = src;
  while (rest.length) {
    let best: { idx: number; len: number; node: MdNode } | undefined;
    for (const rule of INLINE) {
      const m = rule.re.exec(rest);
      if (!m || (best && m.index >= best.idx)) continue;
      const node = rule.make(m, parseInline);
      if (node) best = { idx: m.index, len: m[0].length, node };
    }
    if (!best) {
      out.push({ t: "text", v: rest });
      break;
    }
    if (best.idx > 0) out.push({ t: "text", v: rest.slice(0, best.idx) });
    out.push(best.node);
    rest = rest.slice(best.idx + best.len);
  }
  return out;
}

export function parseMarkdown(src: string): MdNode[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: MdNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push({ t: "br" });
    out.push(...parseInline(line));
  });
  return out;
}

/** Alle gültigen Koordinaten eines Textes (für Verlinkung/Tests). */
export function extractCoords(src: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const walk = (nodes: MdNode[]) => {
    for (const n of nodes) {
      if (n.t === "coord") out.push({ x: n.x, y: n.y });
      else if ("c" in n) walk(n.c);
    }
  };
  walk(parseMarkdown(src));
  return out;
}
