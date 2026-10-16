import { describe, expect, it } from "vitest";
import { extractCoords, parseMarkdown } from "./markdown";

describe("parseMarkdown", () => {
  it("fett, kursiv, code, Zeilenumbruch", () => {
    expect(parseMarkdown("a **b** *c* `d`\nz")).toEqual([
      { t: "text", v: "a " }, { t: "bold", c: [{ t: "text", v: "b" }] }, { t: "text", v: " " },
      { t: "italic", c: [{ t: "text", v: "c" }] }, { t: "text", v: " " }, { t: "code", v: "d" }, { t: "br" }, { t: "text", v: "z" },
    ]);
  });
  it("Koordinaten werden erkannt, ungültige nicht", () => {
    expect(extractCoords("Ziel (12|-34) und ( -5 | 7 ), nicht (999|1) oder (1|2|3)")).toEqual([{ x: 12, y: -34 }, { x: -5, y: 7 }]);
  });
  it("HTML und Skripte bleiben reiner Text", () => {
    const n = parseMarkdown('<img src=x onerror=alert(1)><script>alert(1)</script>');
    expect(n).toEqual([{ t: "text", v: '<img src=x onerror=alert(1)><script>alert(1)</script>' }]);
  });
  it("nur http(s)-Links; javascript: und data: werden nicht zu Links", () => {
    expect(parseMarkdown("[x](javascript:alert(1))").some((n) => n.t === "link")).toBe(false);
    expect(parseMarkdown("[x](data:text/html;base64,AAAA)").some((n) => n.t === "link")).toBe(false);
    expect(parseMarkdown("[x](https://example.com/a)")).toEqual([{ t: "link", href: "https://example.com/a", c: [{ t: "text", v: "x" }] }]);
    expect(parseMarkdown("siehe https://example.com/x?y=1 ok").some((n) => n.t === "link")).toBe(true);
  });
  it("Verschachtelung und Koordinate in Fett", () => {
    expect(extractCoords("**Ziel (1|2)**")).toEqual([{ x: 1, y: 2 }]);
  });
  it("leer", () => {
    expect(parseMarkdown("")).toEqual([]);
  });
});

describe("Koordinaten", () => {
  it("erkennt (x|y) auch mit Unicode-Minus und Leerzeichen als coord-Knoten", () => {
    const nodes = parseMarkdown("Angriff auf (−3|−81) und ( 12 | -4 )");
    expect(nodes.filter((n) => n.t === "coord")).toEqual([
      { t: "coord", x: -3, y: -81, v: "(−3|−81)" },
      { t: "coord", x: 12, y: -4, v: "( 12 | -4 )" },
    ]);
  });
});
