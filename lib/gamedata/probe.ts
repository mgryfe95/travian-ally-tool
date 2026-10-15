/** Auswertung einer Seite der Wissensdatenbank: wo kommen die Tabellen her (eingebettetes JSON, API-Endpunkte, Unterseiten)? */
export type PageAnalysis = {
  title: string;
  scripts: string[];
  links: string[];
  dataUrls: string[];
  embeddedJson: { source: string; bytes: number }[];
  tables: number;
  /** Erste Zeile der ersten Tabelle (Spaltenköpfe), sofern vorhanden */
  firstTableHeader: string[];
  /** Sichtbarer Text (Tags entfernt), gekürzt – zeigt, ob die Seite serverseitig gerendert ist */
  textSample: string;
};

const abs = (href: string, base: string) => {
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
};
const uniq = <T>(a: T[]) => [...new Set(a)];

export function analyzeHtml(html: string, baseUrl: string): PageAnalysis {
  const attr = (re: RegExp) => uniq([...html.matchAll(re)].map((m) => abs(m[1] as string, baseUrl)).filter((u): u is string => !!u));
  const embedded: PageAnalysis["embeddedJson"] = [];
  for (const m of html.matchAll(/<script[^>]*id="(__NEXT_DATA__|__NUXT_DATA__)"[^>]*>([\s\S]*?)<\/script>/g)) embedded.push({ source: m[1] as string, bytes: (m[2] as string).length });
  for (const m of html.matchAll(/<script(?![^>]*\bid=")[^>]*type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g)) embedded.push({ source: "application/json", bytes: (m[1] as string).length });
  const links = attr(/<a[^>]+href="([^"#]+)"/g);
  const scripts = attr(/<script[^>]+src="([^"]+)"/g);
  const inlineUrls = [...html.matchAll(/["'`](https?:\/\/[^"'`\s]+|\/[A-Za-z0-9_\-./]*(?:api|graphql|\.json|_next\/data)[^"'`\s]*)["'`]/g)].map((m) => abs(m[1] as string, baseUrl)).filter((u): u is string => !!u);
  const dataUrls = uniq([...links, ...scripts, ...inlineUrls].filter((u) => /(\.json(\?|$)|\/api\/|graphql|_next\/data)/i.test(u)));
  const body = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ");
  const firstTable = /<table[\s\S]*?<\/table>/i.exec(body)?.[0] ?? "";
  const firstRow = /<tr[\s\S]*?<\/tr>/i.exec(firstTable)?.[0] ?? "";
  const clean = (t: string) => t.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return {
    firstTableHeader: [...firstRow.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) => clean(m[1] as string)).slice(0, 20),
    textSample: clean(body).slice(0, 600),
    title: /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? "",
    scripts, links, dataUrls, embeddedJson: embedded, tables: (html.match(/<table[\s>]/gi) ?? []).length,
  };
}

/** Minimaler robots.txt-Check für `User-agent: *` (Disallow-Präfixe). */
export function allowedByRobots(robotsTxt: string, path: string): boolean {
  let applies = false;
  const disallow: string[] = [];
  for (const raw of robotsTxt.split("\n")) {
    const line = raw.replace(/#.*/, "").trim();
    const [k, ...v] = line.split(":");
    const val = v.join(":").trim();
    if (/^user-agent$/i.test(k ?? "")) applies = val === "*";
    else if (applies && /^disallow$/i.test(k ?? "") && val) disallow.push(val);
  }
  return !disallow.some((d) => path.startsWith(d));
}
