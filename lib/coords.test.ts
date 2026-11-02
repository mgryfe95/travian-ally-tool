import { describe, expect, it } from "vitest";
import { mapUrl } from "./coords";

describe("mapUrl", () => {
  it("entspricht dem Beispiel der Travian-Karte", () => {
    expect(mapUrl("https://ts12.x1.europe.travian.com/", -3, -81)).toBe("https://ts12.x1.europe.travian.com/karte.php?zoom=1&x=-3&y=-81");
  });
});
