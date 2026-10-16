import { describe, expect, it } from "vitest";
import { igmWriteUrl } from "./igm";

describe("igmWriteUrl", () => {
  it("Standard: Spieler-ID, wie im Beispiel …/messages/write?to=1422", () => {
    expect(igmWriteUrl("https://ts12.x1.europe.travian.com/", { id: 1422, name: "Max" })).toBe("https://ts12.x1.europe.travian.com/messages/write?to=1422");
  });
  it("Vorlage mit Namen wird URL-kodiert", () => {
    expect(igmWriteUrl("https://s", { id: 1, name: "Max & Moritz" }, "{server}/x/{name}/y")).toBe("https://s/x/Max%20%26%20Moritz/y");
  });
});
