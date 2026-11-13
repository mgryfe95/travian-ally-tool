import { describe, expect, it } from "vitest";
import { defaultOn, effective, isNotifyKey, preview } from "./prefs";

describe("Benachrichtigungs-Standards", () => {
  it("allgemein an, Allianz-Kanal aus, Task-Force an", () => {
    expect(defaultOn("dm")).toBe(true);
    expect(defaultOn("alert")).toBe(true);
    expect(defaultOn("ch:3", "ALLY")).toBe(false);
    expect(defaultOn("ch:3", "TASKFORCE")).toBe(true);
    expect(defaultOn("other")).toBe(false);
  });
  it("gespeicherter Wert schlägt Standard", () => {
    expect(effective(new Map([["ch:3", true]]), "ch:3", "ALLY")).toBe(true);
    expect(effective(new Map([["dm", false]]), "dm")).toBe(false);
  });
  it("Schlüssel prüfen", () => {
    expect(isNotifyKey("mention")).toBe(true);
    expect(isNotifyKey("ch:12")).toBe(true);
    expect(isNotifyKey("ch:x")).toBe(false);
    expect(isNotifyKey("foo")).toBe(false);
  });
  it("Vorschau kürzt und entfernt Markdown", () => {
    expect(preview("**Angriff** auf [12|3](http://x)")).toBe("Angriff auf 12|3");
    expect(preview("a".repeat(200), 10)).toBe("aaaaaaaaa…");
  });
});
