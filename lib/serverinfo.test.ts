import { describe, expect, it } from "vitest";
import { serverLabel } from "./serverinfo";

describe("serverLabel", () => {
  it("leitet Server und Region aus der URL ab", () => {
    expect(serverLabel("https://ts12.x1.europe.travian.com")).toBe("ts12 · Europe");
    expect(serverLabel("https://ts1.travian.com")).toBe("ts1");
  });
});
