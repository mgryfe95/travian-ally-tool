import { describe, expect, it } from "vitest";
import { nextHourlyRun } from "./cron-label";

describe("nextHourlyRun", () => {
  it("nächste Stunde, wenn die Minute vorbei ist", () => {
    expect(nextHourlyRun("15 * * * *", new Date("2026-10-14T10:20:00"))?.getHours()).toBe(11);
    expect(nextHourlyRun("15 * * * *", new Date("2026-10-14T10:10:00"))?.getHours()).toBe(10);
  });
  it("unbekannte Zeitpläne → undefined", () => {
    expect(nextHourlyRun("*/5 * * * *")).toBeUndefined();
    expect(nextHourlyRun("0 2 * * *")).toBeUndefined();
  });
});
