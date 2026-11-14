import { describe, expect, it } from "vitest";
import { createLimiter } from "./ratelimit";

describe("createLimiter", () => {
  it("erlaubt max Aufrufe pro Fenster, danach Reset", () => {
    const l = createLimiter(2, 1000);
    expect([l.check("a", 0), l.check("a", 1), l.check("a", 2)]).toEqual([true, true, false]);
    expect(l.check("b", 2)).toBe(true);
    expect(l.check("a", 1001)).toBe(true);
  });
});
