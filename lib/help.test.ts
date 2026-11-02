import { describe, expect, it } from "vitest";
import { de } from "./i18n/de";
import { HELP, helpHref, helpKey, safeNext } from "./help";

describe("Hilfe", () => {
  it("jeder Punkt hat Titel und Text in beiden Sprachen; IDs eindeutig", () => {
    const ids = HELP.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(Object.keys(de)).toContain(helpKey(id, "t"));
      expect(Object.keys(de)).toContain(helpKey(id, "b"));
    }
  });
  it("Quicklinks ohne Login über die Anmeldung, nur interne Rücksprünge", () => {
    expect(helpHref("/admin?tab=members", false)).toBe("/login?next=%2Fadmin%3Ftab%3Dmembers");
    expect(helpHref("/chat", true)).toBe("/chat");
    expect(safeNext("/admin?tab=users")).toBe("/admin?tab=users");
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "", null]) expect(safeNext(bad)).toBeNull();
  });
});
