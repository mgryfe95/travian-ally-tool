import { describe, expect, it } from "vitest";
import { de } from "./de";
import { en } from "./en";
import { fr } from "./fr";
import { matchLocale, translate } from "./index";

const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

describe("i18n", () => {
  it("de und fr haben dieselben Schlüssel und Platzhalter wie en", () => {
    for (const dict of [de, fr] as Record<string, string>[]) {
      expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
      // Beispieltexte für Call-Vorlagen zeigen Vorlagen-Variablen in der jeweiligen Sprache (keine Übersetzungs-Platzhalter)
      for (const k of (Object.keys(en) as (keyof typeof en)[]).filter((x) => x !== "schedule.tpl.newBodyPh")) expect(ph(dict[k] ?? ""), k).toBe(ph(en[k]));
    }
  });
  it("Schlüssel beginnen mit ihrem Namensraum und Texte sind nicht leer", () => {
    for (const [k, v] of Object.entries(en)) {
      expect(k).toMatch(/^[a-z][a-zA-Z]*\.[\w.]+$/);
      expect(v.trim().length, k).toBeGreaterThan(0);
    }
  });
  it("Accept-Language und Platzhalter", () => {
    expect(matchLocale("de-AT,de;q=0.9,en;q=0.8")).toBe("de");
    expect(matchLocale("fr-FR,en;q=0.5")).toBe("fr");
    expect(matchLocale("es-ES,it;q=0.5")).toBe("en");
    expect(matchLocale(null)).toBe("en");
    expect(translate("de", "common.language")).toBe("Sprache");
    expect(translate("en", "nope.missing {x}", { x: 1 })).toBe("nope.missing 1");
  });
});
