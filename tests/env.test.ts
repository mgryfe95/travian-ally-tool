import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const base = { DATABASE_URL: "postgresql://x", AUTH_SECRET: "s", TRAVIAN_SERVER_URL: "https://ts12.x1.europe.travian.com/" };

describe("parseEnv", () => {
  it("applies defaults and normalizes values", () => {
    const e = parseEnv({ ...base, SYSTEMADMIN_EMAILS: " A@x.de, b@x.de ,", TRAVIAN_ALLIANCE_ID: "" });
    expect(e.TRAVIAN_SERVER_URL).toBe("https://ts12.x1.europe.travian.com");
    expect(e.SYSTEMADMIN_EMAILS).toEqual(["a@x.de", "b@x.de"]);
    expect(e.TRAVIAN_ALLIANCE_IDS).toEqual([]);
    expect(e.INACTIVE_DAYS).toBe(3);
    expect(e.IMPORT_CRON).toBe("15 * * * *");
  });
  it("parst mehrere Allianz-IDs (kommagetrennt, ungültige/doppelte verworfen)", () => {
    expect(parseEnv({ ...base, TRAVIAN_ALLIANCE_ID: "36, 7;12 abc 36 -4" }).TRAVIAN_ALLIANCE_IDS).toEqual([36, 7, 12]);
  });
  it("Produktion verlangt S3 für Screenshots (außer ALLOW_LOCAL_SCREENSHOTS)", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "production" })).toThrow(/S3/);
    expect(() => parseEnv({ ...base, NODE_ENV: "production", S3_BUCKET_SCREENSHOTS: "b", S3_ACCESS_KEY_ID: "k" })).toThrow(/S3/);
    expect(parseEnv({ ...base, NODE_ENV: "production", S3_BUCKET_SCREENSHOTS: "b", S3_ACCESS_KEY_ID: "k", S3_SECRET_ACCESS_KEY: "s" }).S3_BUCKET_SCREENSHOTS).toBe("b");
    expect(parseEnv({ ...base, NODE_ENV: "production", ALLOW_LOCAL_SCREENSHOTS: "true" }).ALLOW_LOCAL_SCREENSHOTS).toBe(true);
    expect(parseEnv({ ...base }).USER_QUOTA_MB).toBe(50);
  });
  it("rejects missing required values", () => {
    expect(() => parseEnv({})).toThrow();
  });
});
