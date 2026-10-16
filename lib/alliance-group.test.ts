import { describe, expect, it } from "vitest";
import { compareMembers, effectiveRelations, isOwnGroup, ownGroupIds, type GroupPlayer, type LinkRow } from "./alliance-group";

describe("Allianz-Gruppe", () => {
  it("OWN und ALLIED gehören zur eigenen Gruppe, der Rest nicht", () => {
    expect(["OWN", "ALLIED"].every((r) => isOwnGroup(r as "OWN"))).toBe(true);
    expect(["NAP", "NEUTRAL", "ENEMY"].some((r) => isOwnGroup(r as "NAP"))).toBe(false);
    expect(isOwnGroup(undefined)).toBe(false);
  });
  it("mehrere konfigurierte Haupt-Allianzen sind alle implizit OWN", () => {
    expect(ownGroupIds(effectiveRelations([], [36, 12, 5]))).toEqual(new Set([36, 12, 5]));
  });
  it("konfigurierte Haupt-Allianz ist implizit OWN, expliziter Eintrag gewinnt", () => {
    expect(ownGroupIds(effectiveRelations([{ allianceId: 7, relation: "ALLIED" }, { allianceId: 8, relation: "ENEMY" }], [36]))).toEqual(new Set([36, 7]));
    expect(ownGroupIds(effectiveRelations([{ allianceId: 36, relation: "ENEMY" }], [36])).size).toBe(0);
  });
});

const P = (id: number, allianceId = 36): GroupPlayer => ({ id, name: `p${id}`, allianceId, population: 100 });
const L = (userId: string, playerId: number, status: LinkRow["status"] = "verified"): LinkRow => ({ userId, playerId, status });

describe("compareMembers", () => {
  const group = [P(1), P(2), P(3, 7)];
  const links = [L("a", 1), L("b", 1), L("c", 2, "pending"), L("d", 99), L("e", 3, "rejected")];
  const r = compareMembers(group, links);
  it("zählt Mitglieder mit/ohne verifizierten Account (Duals erlaubt)", () => {
    expect(r.members.find((m) => m.id === 1)?.userIds).toEqual(["a", "b"]);
    expect(r.members.find((m) => m.id === 2)).toMatchObject({ userIds: [], pendingUserIds: ["c"] });
    expect(r.withoutAccount.map((p) => p.id)).toEqual([2, 3]);
  });
  it("markiert verifizierte Accounts ohne Gruppenzugehörigkeit", () => {
    expect(r.orphanLinks).toEqual([L("d", 99)]);
    expect(r.summary).toEqual({ groupPlayers: 3, withAccount: 1, withoutAccount: 2, orphanLinks: 1 });
  });
  it("leere Eingaben", () => {
    expect(compareMembers([], []).summary).toEqual({ groupPlayers: 0, withAccount: 0, withoutAccount: 0, orphanLinks: 0 });
  });
});
