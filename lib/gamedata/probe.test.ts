import { describe, expect, it } from "vitest";
import { allowedByRobots, analyzeHtml } from "./probe";

const html = `<html><head><title> Gebäude </title><script src="/_next/static/app.js"></script><script id="__NEXT_DATA__" type="application/json">{"props":{}}</script></head>
<body><a href="/en-US/buildings/main-building">HG</a><a href="#x">x</a><table><tr><td>1</td></tr></table>
<script>fetch("/api/v1/buildings?lang=en")</script></body></html>`;

describe("analyzeHtml", () => {
  const r = analyzeHtml(html, "https://example.invalid/en-US/buildings");
  it("Titel, Links, Skripte, Tabellen", () => {
    expect(r.title).toBe("Gebäude");
    expect(r.links).toEqual(["https://example.invalid/en-US/buildings/main-building"]);
    expect(r.scripts).toEqual(["https://example.invalid/_next/static/app.js"]);
    expect(r.tables).toBe(1);
  });
  it("findet eingebettetes JSON und Daten-Endpunkte", () => {
    expect(r.embeddedJson).toEqual([{ source: "__NEXT_DATA__", bytes: 12 }]);
    expect(r.dataUrls).toContain("https://example.invalid/api/v1/buildings?lang=en");
  });
});

describe("allowedByRobots", () => {
  it("beachtet Disallow für *", () => {
    const txt = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin\n";
    expect(allowedByRobots(txt, "/en-US/buildings")).toBe(true);
    expect(allowedByRobots(txt, "/admin/x")).toBe(false);
    expect(allowedByRobots("", "/x")).toBe(true);
  });
});
