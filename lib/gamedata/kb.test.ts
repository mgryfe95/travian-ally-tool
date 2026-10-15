import { describe, expect, it } from "vitest";
import { worldProfile } from "../world-profile";
import { KbError, kbToGameData, parseKnowledgeBase, parseLiteral } from "./kb";

// Synthetische Struktur nach dem Muster der Seite – keine echten Spielwerte.
const lvl = (n: number, t: number) => `${n}:{level:${n},resourceCost:{r1:${n * 10},r2:${n * 20},r3:${n * 30},r4:${n * 40}},buildingTime:${t},culturePoints:${n},population:${n + 1},supply:${n + 1},effects:{buildingTime:.5}}`;
const bld = (gid: number, extra = "") => `{gid:${gid},maxLevel:2,category:"Infrastructure",prerequisites:[${extra}],levelData:{${lvl(1, 2e3)},${lvl(2, 2625.5)}}}`;
const names = (gid: number, en: string, de: string) => `${gid}:{"en-US":"${en}","de-DE":"${de}"}`;
const js = (extraBuilding = "") =>
  `var q=1;const Y=[${Array.from({ length: 10 }, (_, i) => bld(i + 1)).join(",")}${extraBuilding ? `,${extraBuilding}` : ""}];function f(){return Y}` +
  `const Z={},_={${[...Array(10)].map((_, i) => names(i + 1, `Thing ${i + 1}`, `Ding ${i + 1}`)).join(",")}${extraBuilding ? `,${names(11, "Stonemason&#39;s Lodge", "Steinmetz")}` : ""}},$={tribe_vid1:{"en-US":"Romans","de-DE":"Römer"},tribe_vid2:{"en-US":"Teutons","de-DE":"Germanen"}};`;

describe("parseLiteral", () => {
  it("liest JS-Literale (unquotierte Schlüssel, Exponent, .5, !0, Escapes)", () => {
    expect(parseLiteral(`{a:2e3,b:.964,c:!0,d:!1,e:"x\\"y",1:[1,{k:null}],"f-G":'z'}`, 0)[0]).toEqual({ a: 2000, b: 0.964, c: true, d: false, e: 'x"y', 1: [1, { k: null }], "f-G": "z" });
  });
  it("führt nichts aus: Funktionsaufrufe/Variablen werden abgelehnt", () => {
    expect(() => parseLiteral(`{a:alert(1)}`, 0)).toThrow(KbError);
    expect(() => parseLiteral(`{a:foo}`, 0)).toThrow(KbError);
    expect(() => parseLiteral(`[1,2`, 0)).toThrow();
  });
});

describe("Wissensdatenbank → Spieldaten", () => {
  const world1 = worldProfile("https://ts12.x1.europe.travian.com");
  it("findet Gebäude, Namen (inkl. HTML-Entities) und Völker", () => {
    const kb = parseKnowledgeBase(js(bld(11, '{type:"Tribe",vid:[2]}')));
    expect(kb.buildings).toHaveLength(11);
    expect(kb.names[11]).toEqual({ en: "Stonemason's Lodge", de: "Steinmetz" });
    expect(kb.tribes[2]).toEqual({ en: "Teutons", de: "Germanen" });
  });
  it("wandelt Werte 1:1 und rechnet Bauzeiten mit der Formel der Quelle auf den Speed der Welt", () => {
    const kb = parseKnowledgeBase(js(bld(11, '{type:"Tribe",vid:[2]}')));
    const d1 = kbToGameData(kb, world1, "src (test)");
    const b = d1.buildings.find((x) => x.gid === 11)!;
    expect(b).toMatchObject({ key: "stonemasons_lodge", name: "Steinmetz", category: "infrastructure", tribeRestriction: "teutons" });
    expect(b.levels[0]).toMatchObject({ costWood: 10, costClay: 20, costIron: 30, costCrop: 40, upkeep: 2, buildTimeSec: 2000, culturePoints: 1 });
    expect(b.levels[1]!.buildTimeSec).toBe(2630); // 10·round(2625.5/10)
    const d2 = kbToGameData(kb, worldProfile("https://ts5.x2.europe.travian.com"), "src");
    expect(d2.serverSpeed).toBe(2);
    expect(d2.buildings[0]!.levels[0]!.buildTimeSec).toBe(1000);
    expect(d2.world.host).toBe("ts5.x2.europe.travian.com");
  });
  it("Mehr-Völker-Voraussetzung bleibt in prerequisites, keine Einzelbeschränkung", () => {
    const d = kbToGameData(parseKnowledgeBase(js(bld(11, '{type:"Tribe",vid:[1,2]}'))), world1, "s");
    expect(d.buildings.find((x) => x.gid === 11)!.tribeRestriction).toBeNull();
    expect(d.buildings.find((x) => x.gid === 11)!.prerequisites).toEqual([{ type: "Tribe", vid: [1, 2] }]);
  });
  it("lehnt veränderte Seitenstruktur und unbekannte Geschwindigkeit ab", () => {
    expect(() => parseKnowledgeBase("nichts hier")).toThrow(/nicht gefunden/);
    expect(() => kbToGameData(parseKnowledgeBase(js()), worldProfile("https://ts9.europe.travian.com"), "s")).toThrow(/Geschwindigkeit/);
  });
});
