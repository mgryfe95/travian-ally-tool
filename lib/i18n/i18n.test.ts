import { describe, expect, it } from "vitest";
import { de } from "./de";
import { en } from "./en";
import { matchLocale, translate } from "./index";

const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

describe("i18n", () => {
  it("de und en haben dieselben Schlüssel und Platzhalter", () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(ph((de as Record<string, string>)[k] ?? ""), k).toBe(ph(en[k]));
  });
  it("Schlüssel beginnen mit ihrem Namensraum und Texte sind nicht leer", () => {
    for (const [k, v] of Object.entries(en)) {
      expect(k).toMatch(/^[a-z][a-zA-Z]*\.[\w.]+$/);
      expect(v.trim().length, k).toBeGreaterThan(0);
    }
  });
  it("Accept-Language und Platzhalter", () => {
    expect(matchLocale("de-AT,de;q=0.9,en;q=0.8")).toBe("de");
    expect(matchLocale("fr-FR,en;q=0.5")).toBe("en");
    expect(matchLocale(null)).toBe("en");
    expect(translate("de", "common.language")).toBe("Sprache");
    expect(translate("en", "nope.missing {x}", { x: 1 })).toBe("nope.missing 1");
  });
});
