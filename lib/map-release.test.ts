import { describe, expect, it } from "vitest";
import { nextRelease, parseReleaseTime, releaseCrons, renameDeadline } from "./map-release";

describe("map-release", () => {
  it("Cron-Ausdrücke und Stichtag", () => {
    expect(releaseCrons("00:05")).toEqual(["5 0 * * *", "10 0 * * *", "20 0 * * *"]);
    expect(releaseCrons("23:55")).toEqual(["55 23 * * *", "0 0 * * *", "10 0 * * *"]);
    expect(renameDeadline("00:05")).toBe("23:55");
    expect(() => parseReleaseTime("25:00")).toThrow();
  });
  it("nächster Release in Serverzeit (Sommer-/Winterzeit)", () => {
    // 15.10.2026 22:00 UTC = 16.10. 00:00 Berlin (MESZ) → nächster Release 16.10. 00:05 Berlin = 15.10. 22:05 UTC
    expect(nextRelease(new Date("2026-10-15T22:00:00Z"), "Europe/Berlin", "00:05").toISOString()).toBe("2026-10-15T22:05:00.000Z");
    // kurz danach → erst am Folgetag
    expect(nextRelease(new Date("2026-10-15T22:06:00Z"), "Europe/Berlin", "00:05").toISOString()).toBe("2026-10-16T22:05:00.000Z");
    // Winterzeit (MEZ, UTC+1)
    expect(nextRelease(new Date("2026-12-10T12:00:00Z"), "Europe/Berlin", "00:05").toISOString()).toBe("2026-12-10T23:05:00.000Z");
  });
});
