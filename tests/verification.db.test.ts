import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/permissions";
import { seedPermissions } from "@/lib/services/admin";
import type { Actor } from "@/lib/services/context";
import {
  approveLink, assignPlayer, checkClaims, createInvite, findOpenInvite, INVITE_TTL_MS, inviteMessage, redeemInvite, rejectLink, revokeInvite,
  startClaim, VerificationError,
} from "@/lib/services/verification";

const db = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL! } } });
const mod: Actor = { id: "mod", role: "MODERATOR" };
const member: Actor = { id: "m", role: "MEMBER" };
const t0 = new Date("2026-10-14T10:00:00Z");

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","Invite","PlayerLink","AuditLog","AllianceClassification","Setting","Player","Village","RolePermission","PlayerRole" RESTART IDENTITY CASCADE`;
  await seedPermissions(db);
  await db.setting.create({ data: { key: "allianceId", value: "36" } });
  await db.allianceClassification.create({ data: { allianceId: 7, relation: "ALLIED" } });
  const base = { tribe: 1, population: 10, villageCount: 1, status: "active", noGrowthDays: 0, firstSeen: t0 };
  await db.player.createMany({
    data: [
      { id: 1, name: "Alpha", allianceId: 36, ...base },
      { id: 2, name: "Beta", allianceId: 7, ...base }, // verbündete Allianz = eigene Gruppe
      { id: 3, name: "Gamma", allianceId: 9, ...base }, // fremd
    ],
  });
  await db.user.createMany({ data: [{ id: "u1", name: "u1", email: "u1@x.de", role: "GUEST" }, { id: "u2", name: "u2", email: "u2@x.de", role: "GUEST" }, { id: "mod", name: "mod", email: "mod@x.de", role: "MODERATOR" }] });
});
afterAll(() => db.$disconnect());

describe("Einladungslink", () => {
  it("Moderator erzeugt Link für Spieler der eigenen Gruppe (auch verbündete Allianz); nur Hash gespeichert", async () => {
    const { token, invite } = await createInvite(db, mod, 2, t0);
    expect(invite.tokenHash).not.toContain(token);
    expect(invite.tokenHash).toHaveLength(64);
    expect(invite.expiresAt.getTime() - t0.getTime()).toBe(INVITE_TTL_MS);
    expect(await db.invite.count({ where: { tokenHash: token } })).toBe(0);
  });
  it("fremde Allianz und fehlendes Recht werden abgelehnt", async () => {
    await expect(createInvite(db, mod, 3, t0)).rejects.toBeInstanceOf(VerificationError);
    await expect(createInvite(db, member, 1, t0)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("Einlösen: verified + MEMBER; zweites Einlösen scheitert (einmalig)", async () => {
    const { token } = await createInvite(db, mod, 1, t0);
    expect(await redeemInvite(db, token, "u1", t0)).toBe(1);
    expect(await db.playerLink.findFirst({ where: { userId: "u1" } })).toMatchObject({ status: "verified", method: "invite", travianPlayerId: 1 });
    expect((await db.user.findUnique({ where: { id: "u1" } }))?.role).toBe("MEMBER");
    await expect(redeemInvite(db, token, "u2", t0)).rejects.toBeInstanceOf(VerificationError);
  });
  it("Vorab vergebene Spieler-Rolle (Admin) wird beim Einlösen übernommen", async () => {
    await db.playerRole.create({ data: { travianPlayerId: 1, role: "ADMIN", setBy: "x" } });
    const { token } = await createInvite(db, mod, 1, t0);
    await redeemInvite(db, token, "u1", t0);
    expect((await db.user.findUnique({ where: { id: "u1" } }))?.role).toBe("ADMIN");
  });
  it("abgelaufen und widerrufen", async () => {
    const a = await createInvite(db, mod, 1, t0);
    await expect(redeemInvite(db, a.token, "u1", new Date(t0.getTime() + INVITE_TTL_MS + 1))).rejects.toBeInstanceOf(VerificationError);
    const b = await createInvite(db, mod, 1, t0);
    await revokeInvite(db, mod, b.invite.id, t0);
    expect(await findOpenInvite(db, b.token, t0)).toBeNull();
  });
  it("verlässt der Spieler die Gruppe vor dem Einlösen, scheitert es", async () => {
    const { token } = await createInvite(db, mod, 1, t0);
    await db.player.update({ where: { id: 1 }, data: { allianceId: 9 } });
    await expect(redeemInvite(db, token, "u1", t0)).rejects.toBeInstanceOf(VerificationError);
  });
  it("Moderatoren-Rolle wird durch Einlösen nicht herabgestuft", async () => {
    const { token } = await createInvite(db, mod, 1, t0);
    await db.user.update({ where: { id: "u1" }, data: { role: "MODERATOR" } });
    await redeemInvite(db, token, "u1", t0);
    expect((await db.user.findUnique({ where: { id: "u1" } }))?.role).toBe("MODERATOR");
  });
  it("IGM-Text enthält Namen und Link", () => {
    const text = inviteMessage({ playerName: "Alpha", token: "abc", appUrl: "https://humans-travian.com/" });
    expect(text).toContain("Alpha");
    expect(text).toContain("https://humans-travian.com/invite/abc");
  });
  it("mehrere User pro Spieler (Duals) erlaubt", async () => {
    const a = await createInvite(db, mod, 1, t0);
    const b = await createInvite(db, mod, 1, t0);
    await redeemInvite(db, a.token, "u1", t0);
    await redeemInvite(db, b.token, "u2", t0);
    expect(await db.playerLink.count({ where: { travianPlayerId: 1, status: "verified" } })).toBe(2);
  });
});

describe("Dorf-Umbenennungs-Beweis", () => {
  it("Code erscheint als Dorfname → verifiziert und MEMBER", async () => {
    const link = await startClaim(db, "u1", 2);
    expect(link.claimCode).toMatch(/^ALLY-[A-Z2-9]{4}$/);
    expect(await checkClaims(db, t0)).toBe(0);
    await db.village.create({ data: { id: 5, fieldId: 1, x: 0, y: 0, name: `mein ${link.claimCode!.toLowerCase()} dorf`, playerId: 2, population: 5, extra: {} } });
    expect(await checkClaims(db, t0)).toBe(1);
    expect(await db.playerLink.findUnique({ where: { id: link.id } })).toMatchObject({ status: "verified", verifiedBy: "system" });
    expect((await db.user.findUnique({ where: { id: "u1" } }))?.role).toBe("MEMBER");
  });
  it("Code im Dorf eines anderen Spielers zählt nicht", async () => {
    const link = await startClaim(db, "u1", 1);
    await db.village.create({ data: { id: 6, fieldId: 1, x: 0, y: 0, name: link.claimCode!, playerId: 2, population: 5, extra: {} } });
    expect(await checkClaims(db, t0)).toBe(0);
  });
  it("nur für Spieler der eigenen Gruppe; Spieler, der die Gruppe verlässt, wird nicht verifiziert", async () => {
    await expect(startClaim(db, "u1", 3)).rejects.toBeInstanceOf(VerificationError);
    const link = await startClaim(db, "u1", 1);
    await db.village.create({ data: { id: 7, fieldId: 1, x: 0, y: 0, name: link.claimCode!, playerId: 1, population: 5, extra: {} } });
    await db.player.update({ where: { id: 1 }, data: { allianceId: 9 } });
    expect(await checkClaims(db, t0)).toBe(0);
  });
  it("neuer Claim vergibt neuen Code; bereits verifiziert → Fehler", async () => {
    const a = await startClaim(db, "u1", 1);
    const b = await startClaim(db, "u1", 1);
    expect(b.id).toBe(a.id);
    expect(b.claimCode).not.toBe(a.claimCode);
    await approveLink(db, mod, a.id, t0);
    await expect(startClaim(db, "u1", 1)).rejects.toBeInstanceOf(VerificationError);
  });
});

describe("Manuelle Freigabe", () => {
  it("Moderator bestätigt/lehnt ab; Member darf nicht", async () => {
    const a = await startClaim(db, "u1", 1);
    await expect(approveLink(db, member, a.id, t0)).rejects.toBeInstanceOf(ForbiddenError);
    await approveLink(db, mod, a.id, t0);
    expect(await db.playerLink.findUnique({ where: { id: a.id } })).toMatchObject({ status: "verified", method: "admin", verifiedBy: "mod" });
    const b = await startClaim(db, "u2", 2);
    await rejectLink(db, mod, b.id);
    expect((await db.playerLink.findUnique({ where: { id: b.id } }))?.status).toBe("rejected");
    expect((await db.user.findUnique({ where: { id: "u2" } }))?.role).toBe("GUEST");
    expect(await db.auditLog.count()).toBeGreaterThanOrEqual(2);
  });
});

describe("assignPlayer (direkte Zuordnung)", () => {
  it("Moderator ordnet Gast einem Gruppen-Spieler zu → verifiziert, Mitglied", async () => {
    await assignPlayer(db, mod, "u1", 1, t0);
    expect((await db.playerLink.findFirstOrThrow({ where: { userId: "u1" } })).status).toBe("verified");
    expect((await db.user.findUniqueOrThrow({ where: { id: "u1" } })).role).toBe("MEMBER");
    expect(await db.auditLog.count({ where: { action: "link.assign" } })).toBe(1);
  });
  it("überschreibt eine offene Beanspruchung, lehnt Fremde und fehlende Rechte ab", async () => {
    await startClaim(db, "u1", 1);
    await assignPlayer(db, mod, "u1", 1, t0);
    expect(await db.playerLink.count({ where: { userId: "u1", status: "verified" } })).toBe(1);
    await expect(assignPlayer(db, mod, "u2", 3, t0)).rejects.toBeInstanceOf(VerificationError);
    await expect(assignPlayer(db, member, "u2", 1, t0)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("Enge Bündnispartner und „Verlinkung nachweisen“", () => {
  it("Spieler enger Bündnispartner sind verifizierbar, Feinde nicht; Code im Dorfnamen schaltet das Konto frei", async () => {
    const { proveLink } = await import("@/lib/services/verification");
    await db.player.createMany({ data: [
      { id: 50, name: "Freund", tribe: 1, allianceId: 88, population: 1, villageCount: 1, status: "active", noGrowthDays: 0, firstSeen: new Date() },
      { id: 51, name: "Feind", tribe: 1, allianceId: 77, population: 1, villageCount: 1, status: "active", noGrowthDays: 0, firstSeen: new Date() },
    ], skipDuplicates: true });
    await db.allianceClassification.createMany({ data: [{ allianceId: 88, relation: "CLOSE_ALLY" }, { allianceId: 77, relation: "ENEMY" }], skipDuplicates: true });
    await expect(startClaim(db, "u1", 51)).rejects.toMatchObject({ key: "err.verify.playerNotEligible" });
    const link = await startClaim(db, "u1", 50);
    expect(link.claimCode).toMatch(/^ALLY-/);
    await db.village.create({ data: { id: 9050, fieldId: 1, x: 0, y: 0, name: "Hof", playerId: 50, population: 5, extra: {} } });
    // 1) Code noch nicht im Dorfnamen, Datei unverändert → „unchanged“
    let calls = 0;
    const same = async () => { calls++; return "unchanged" as const; };
    expect(await proveLink(db, "u1", { fetchAndImport: same, now: () => 1_000_000 })).toBe("unchanged");
    // 2) Zweiter Knopfdruck kurz danach → gedrosselt, kein weiterer Abruf
    expect(await proveLink(db, "u1", { fetchAndImport: same, now: () => 1_000_500 })).toBe("throttled");
    expect(calls).toBe(1);
    // 3) Neue Datei enthält den Code → verifiziert, Rolle MEMBER
    await db.village.updateMany({ where: { playerId: 50 }, data: { name: `Hof ${link.claimCode}` } });
    expect(await proveLink(db, "u1", { fetchAndImport: same, now: () => 9_000_000 })).toBe("verified");
    expect(await db.user.findUnique({ where: { id: "u1" } })).toMatchObject({ role: "GUEST" }); // enger Bündnispartner bleibt Gast (verifiziert)
    expect(await proveLink(db, "u1")).toBe("no_claim");
  });
});

describe("Rolle mit Verifizierung", () => {
  it("Gast ohne verifizierte Zuordnung ist UNVERIFIED, mit Zuordnung GUEST; Mitglieder und Notzugang unverändert", async () => {
    const { actorRole } = await import("@/lib/services/context");
    await db.user.upsert({ where: { id: "ar1" }, create: { id: "ar1", name: "ar1", email: "ar1@x.de", role: "GUEST" }, update: { role: "GUEST" } });
    const u = { id: "ar1", email: "ar1@x.de", role: "GUEST" };
    expect(await actorRole(db, u, [])).toBe("UNVERIFIED");
    expect(await actorRole(db, u, ["ar1@x.de"])).toBe("ADMIN");
    await db.playerLink.create({ data: { userId: "ar1", travianPlayerId: 4242, status: "verified", method: "admin" } });
    expect(await actorRole(db, u, [])).toBe("GUEST");
    expect(await actorRole(db, { ...u, role: "MEMBER" }, [])).toBe("MEMBER");
  });
});

