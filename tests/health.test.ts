import { describe, expect, it } from "vitest";
import { checkHealth } from "@/lib/health";

describe("checkHealth", () => {
  it("is ok when the DB answers", async () => {
    expect(await checkHealth(async () => 1)).toMatchObject({ status: "ok", db: true });
  });
  it("is degraded when the DB fails", async () => {
    const r = await checkHealth(async () => {
      throw new Error("down");
    });
    expect(r).toMatchObject({ status: "degraded", db: false });
  });
});
