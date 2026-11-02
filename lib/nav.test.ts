import { describe, expect, it } from "vitest";
import { activeChild } from "@/components/SideNav";

const loc = (url: string) => {
  const u = new URL(url, "http://x");
  return { path: u.pathname, sp: u.searchParams };
};
const admin = [{ href: "/admin?tab=members", label: "M" }, { href: "/admin?tab=rights", label: "R" }, { href: "/schedule", label: "S" }];
const chat = [{ href: "/chat?c=all", label: "A" }, { href: "/chat?c=3", label: "#3" }];

describe("Seitenleiste: aktives Untermenü", () => {
  it("Query-Kinder: exakter Treffer, sonst erstes Kind als Standard", () => {
    expect(activeChild(admin, loc("/admin?tab=rights"))?.label).toBe("R");
    expect(activeChild(admin, loc("/admin"))?.label).toBe("M");
    expect(activeChild(chat, loc("/chat?c=3&m=9"))?.label).toBe("#3");
    expect(activeChild(chat, loc("/chat"))?.label).toBe("A");
    expect(activeChild(chat, loc("/chat?c=99"))).toBeUndefined();
  });
  it("Pfad-Kinder per Präfix; fremde Pfade öffnen nichts", () => {
    expect(activeChild(admin, loc("/schedule"))?.label).toBe("S");
    expect(activeChild([{ href: "/villages/5", label: "V" }], loc("/villages/5"))?.label).toBe("V");
    expect(activeChild(admin, loc("/messages"))).toBeUndefined();
  });
});
