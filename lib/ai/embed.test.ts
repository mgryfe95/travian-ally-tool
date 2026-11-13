import { describe, expect, it } from "vitest";
import { cosine, fuse } from "./embed";

describe("Vektor-Helfer", () => {
  it("Kosinus", () => {
    expect(cosine([1, 0], [1, 0])).toBe(1);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([1, 0], [1])).toBe(0);
  });
  it("RRF: in beiden Listen vorne gewinnt", () => {
    const a = { id: 1 }, b = { id: 2 }, c = { id: 3 };
    expect(fuse([[a, b], [b, c]]).map((x) => x.id)).toEqual([2, 1, 3]);
  });
});
