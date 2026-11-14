import { describe, expect, it } from "vitest";
import { speedFromHost, worldMismatches, worldProfile } from "./world-profile";

describe("worldProfile", () => {
  it("liest die Geschwindigkeit aus dem Host", () => {
    expect(speedFromHost("ts12.x1.europe.travian.com")).toBe(1);
    expect(speedFromHost("ts3.x3.international.travian.com")).toBe(3);
    expect(speedFromHost("ts9.europe.travian.com")).toBeNull();
    expect(worldProfile("https://TS12.x1.europe.travian.com/", {})).toEqual({ host: "ts12.x1.europe.travian.com", version: "legends", speed: 1 });
    expect(worldProfile("https://ts9.europe.travian.com", { speed: 2 }).speed).toBe(2);
  });
  it("worldMismatches nennt jede Abweichung", () => {
    const p = worldProfile("https://ts12.x1.europe.travian.com");
    expect(worldMismatches({ world: { host: "ts12.x1.europe.travian.com", gameVersion: "Legends" }, serverSpeed: 1 }, p)).toEqual([]);
    expect(worldMismatches({ world: { host: "x", gameVersion: "y" }, serverSpeed: 2 }, p)).toHaveLength(3);
  });
});
