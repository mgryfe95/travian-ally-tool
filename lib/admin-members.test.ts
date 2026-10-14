import { describe, expect, it } from "vitest";
import { buildMemberRows, maskEmail, type LinkInfo } from "./admin-members";

const P = (id: number) => ({ id, name: `p${id}`, allianceId: 36, population: 10 });
const L = (o: Partial<LinkInfo> & { id: number; playerId: number }): LinkInfo => ({
  userId: `u${o.id}`, userName: `n${o.id}`, email: `m${o.id}@x.de`, status: "verified", method: "invite", claimCode: null, ...o,
});
const now = new Date("2026-10-14T00:00:00Z");

describe("buildMemberRows", () => {
  const rows = buildMemberRows(
    [P(1), P(2), P(3), P(4), P(5)],
    [L({ id: 1, playerId: 1 }), L({ id: 2, playerId: 1, method: "admin" }), L({ id: 3, playerId: 2, status: "pending", method: "village_rename", claimCode: "ALLY-7K2Q" }), L({ id: 4, playerId: 5, status: "rejected" })],
    [{ id: 9, playerId: 3, expiresAt: new Date(now.getTime() + 5 * 86_400_000) }, { id: 8, playerId: 4, expiresAt: new Date(now.getTime() - 1000) }],
    now,
  );
  it("verifiziert (mit Duals)", () => {
    expect(rows[0]).toMatchObject({ state: "verified", via: "invite", extraAccounts: 1, user: { id: "u1" } });
  });
  it("ausstehender Claim zeigt Code", () => {
    expect(rows[1]).toMatchObject({ state: "claim_pending", claimCode: "ALLY-7K2Q" });
  });
  it("offene Einladung mit Resttagen, abgelaufene zählt nicht", () => {
    expect(rows[2]).toMatchObject({ state: "invite_open", inviteDaysLeft: 5 });
    expect(rows[3]?.state).toBe("none");
  });
  it("abgelehnter Link zählt als nicht verknüpft", () => {
    expect(rows[4]?.state).toBe("none");
  });
  it("E-Mail wird gekürzt", () => {
    expect(maskEmail("maximilian@example.com")).toBe("maximi@…");
  });
});
