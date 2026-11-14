import { describe, expect, it } from "vitest";
import { parseIdList } from "./ids";

describe("parseIdList", () => {
  it("Trennzeichen, Duplikate, Müll", () => {
    expect(parseIdList("36, 7,12;9 36 x -1 0")).toEqual([36, 7, 12, 9]);
    expect(parseIdList("")).toEqual([]);
    expect(parseIdList(undefined)).toEqual([]);
  });
});
