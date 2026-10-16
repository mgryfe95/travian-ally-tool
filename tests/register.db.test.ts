import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { seedPermissions } from "@/lib/services/admin";
import { registerUser, RegisterError } from "@/lib/services/register";
import { createInvite } from "@/lib/services/verification";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
const PW = "correct-horse-battery";

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","Invite","PlayerLink","AuditLog","Setting","Player","RolePermission","AllianceClassification" RESTART IDENTITY CASCADE`;
  await seedPermissions(db);
  await db.setting.create({ data: { key: "allianceId", value: "36" } });
  await db.player.create({ data: { id: 1, name: "Alpha", tribe: 1, allianceId: 36, population: 1, villageCount: 1, status: "active", noGrowthDays: 0, firstSeen: new Date() } });
  await db.user.create({ data: { id: "mod", name: "mod", email: "mod@x.de", role: "MODERATOR" } });
});
afterAll(() => db.$disconnect());

describe("Registrierung", () => {
  it("ohne Einladung → GUEST, Passwort argon2-gehasht, Session-Cookie", async () => {
    const r = await registerUser({ email: "New@X.de", name: "Neu", password: PW, playerName: "Alpha" });
    const u = await db.user.findUnique({ where: { id: r.userId } });
    expect(u).toMatchObject({ email: "new@x.de", role: "GUEST", banned: false });
    expect((await db.account.findFirst({ where: { userId: r.userId } }))?.password).toMatch(/^\$argon2id\$/);
    expect(r.setCookie.length).toBeGreaterThan(0);
    expect(await db.session.count({ where: { userId: r.userId } })).toBe(1);
  });
  it("mit Einladung → MEMBER + verifizierter Link", async () => {
    const { token } = await createInvite(db, { id: "mod", role: "MODERATOR" }, 1);
    const r = await registerUser({ email: "a@x.de", name: "Alpha", password: PW, inviteToken: token });
    expect(r.verified).toBe(true);
    expect((await db.user.findUnique({ where: { id: r.userId } }))?.role).toBe("MEMBER");
    expect(await db.playerLink.findFirst({ where: { userId: r.userId } })).toMatchObject({ status: "verified", travianPlayerId: 1 });
  });
  it("Einladung ohne Namen übernimmt den Spielernamen", async () => {
    const { token } = await createInvite(db, { id: "mod", role: "MODERATOR" }, 1);
    const r = await registerUser({ email: "z@x.de", password: PW, inviteToken: token });
    expect((await db.user.findUnique({ where: { id: r.userId } }))?.name).toBe("Alpha");
  });
  it("Registrierung ohne Einladung braucht einen Spielernamen", async () => {
    await expect(registerUser({ email: "q@x.de", password: PW })).rejects.toMatchObject({ key: "err.register.playerRequired" });
    await expect(registerUser({ email: "q@x.de", name: "Qq", password: PW })).rejects.toMatchObject({ key: "err.register.playerRequired" });
  });
  it("Spieler muss existieren, eindeutig sein und einer eigenen oder engen Bündnispartner-Allianz angehören", async () => {
    await db.player.createMany({ data: [
      { id: 2, name: "Feind", tribe: 1, allianceId: 77, population: 1, villageCount: 1, status: "active", noGrowthDays: 0, firstSeen: new Date() },
      { id: 3, name: "Freund", tribe: 1, allianceId: 88, population: 1, villageCount: 1, status: "active", noGrowthDays: 0, firstSeen: new Date() },
    ] });
    await db.allianceClassification.createMany({ data: [{ allianceId: 77, relation: "ENEMY" }, { allianceId: 88, relation: "CLOSE_ALLY" }] });
    await expect(registerUser({ email: "x1@x.de", password: PW, name: "Xx", playerName: "Gibtsnicht" })).rejects.toMatchObject({ key: "err.register.playerUnknown" });
    await expect(registerUser({ email: "x2@x.de", password: PW, name: "Xx", playerName: "Feind" })).rejects.toMatchObject({ key: "err.register.notEligible" });
    expect(await db.user.count({ where: { email: "x2@x.de" } })).toBe(0);
    const r = await registerUser({ email: "x3@x.de", password: PW, playerName: "freund" }); // Groß-/Kleinschreibung egal, Name = Spielername
    expect(await db.user.findUnique({ where: { id: r.userId } })).toMatchObject({ name: "Freund", role: "GUEST" });
    expect(await db.playerLink.findFirst({ where: { userId: r.userId } })).toMatchObject({ travianPlayerId: 3, status: "pending", method: "village_rename" });
  });
  it("ungültige Einladung verhindert die Registrierung", async () => {
    await expect(registerUser({ email: "a@x.de", name: "Alpha", password: PW, inviteToken: "nope-nope-nope" })).rejects.toBeInstanceOf(RegisterError);
    expect(await db.user.count({ where: { email: "a@x.de" } })).toBe(0);
  });
  it("doppelte E-Mail und zu kurzes Passwort scheitern", async () => {
    await registerUser({ email: "a@x.de", name: "Alpha", password: PW, playerName: "Alpha" });
    await expect(registerUser({ email: "a@x.de", name: "Alpha", password: PW, playerName: "Alpha" })).rejects.toBeInstanceOf(RegisterError);
    await expect(registerUser({ email: "b@x.de", name: "Beta", password: "short", playerName: "Alpha" })).rejects.toBeInstanceOf(RegisterError);
  });
  it("Client kann Rolle nicht per Body setzen und den Better-Auth-Sign-up nicht direkt benutzen", async () => {
    await expect(auth.api.signUpEmail({ body: { email: "h@x.de", name: "Hax", password: PW, role: "ADMIN" } as never })).rejects.toThrow();
    expect(await db.user.count({ where: { email: "h@x.de" } })).toBe(0);
    const r = await registerUser({ email: "h2@x.de", name: "Hax", password: PW, role: "ADMIN", playerName: "Alpha" });
    expect((await db.user.findUnique({ where: { id: r.userId } }))?.role).toBe("GUEST");
  });
  it("SYSTEMADMIN-Adresse nur mit Setup-Code (Default AUTH_SECRET)", async () => {
    await expect(registerUser({ email: "boss@example.com", name: "Boss", password: PW })).rejects.toMatchObject({ status: 403 });
    await expect(registerUser({ email: "boss@example.com", name: "Boss", password: PW, setupCode: "falsch" })).rejects.toMatchObject({ status: 403 });
    const r = await registerUser({ email: "boss@example.com", name: "Boss", password: PW, setupCode: "test-secret-test-secret" });
    expect(r.userId).toBeTruthy();
  });
  it("Anmeldung per Better Auth klappt, gesperrter Nutzer bekommt keine Session", async () => {
    const r = await registerUser({ email: "c@x.de", name: "Cee", password: PW, playerName: "Alpha" });
    await db.session.deleteMany();
    await expect(auth.api.signInEmail({ body: { email: "c@x.de", password: PW } })).resolves.toBeTruthy();
    await db.session.deleteMany();
    await db.user.update({ where: { id: r.userId }, data: { banned: true } });
    await expect(auth.api.signInEmail({ body: { email: "c@x.de", password: PW } })).rejects.toThrow();
    expect(await db.session.count()).toBe(0);
  });
});

describe("Spielerliste der Registrierung", () => {
  it("alphabetisch, nur Gruppe/enge Bündnispartner, ohne bereits verknüpfte Spieler; verknüpfte werden auch serverseitig abgelehnt", async () => {
    const { loadRegistrablePlayers } = await import("@/lib/alliance-group");
    const mk = (id: number, name: string, allianceId: number) => ({ id, name, tribe: 1, allianceId, population: 1, villageCount: 1, status: "active", noGrowthDays: 0, firstSeen: new Date() });
    await db.player.createMany({ data: [mk(2, "zebra", 36), mk(3, "Berta", 36), mk(4, "Frei", 88), mk(5, "Fremd", 99)] });
    await db.allianceClassification.create({ data: { allianceId: 88, relation: "CLOSE_ALLY" } });
    expect((await loadRegistrablePlayers(db)).map((p) => p.name)).toEqual(["Alpha", "Berta", "Frei", "zebra"]);
    await registerUser({ email: "t1@x.de", password: PW, playerName: "Berta" });
    // erst nach Verifizierung verschwindet der Spieler aus der Liste
    await db.playerLink.updateMany({ where: { travianPlayerId: 3 }, data: { status: "verified" } });
    expect((await loadRegistrablePlayers(db)).map((p) => p.name)).toEqual(["Alpha", "Frei", "zebra"]);
    await expect(registerUser({ email: "t2@x.de", password: PW, playerName: "Berta" })).rejects.toMatchObject({ key: "err.register.playerTaken" });
  });
});
