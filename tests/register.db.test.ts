import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { seedPermissions } from "@/lib/services/admin";
import { registerUser, RegisterError } from "@/lib/services/register";
import { createInvite } from "@/lib/services/verification";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
const PW = "correct-horse-battery";

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","Invite","PlayerLink","AuditLog","Setting","Player","RolePermission" RESTART IDENTITY CASCADE`;
  await seedPermissions(db);
  await db.setting.create({ data: { key: "allianceId", value: "36" } });
  await db.player.create({ data: { id: 1, name: "Alpha", tribe: 1, allianceId: 36, population: 1, villageCount: 1, status: "active", noGrowthDays: 0, firstSeen: new Date() } });
  await db.user.create({ data: { id: "mod", name: "mod", email: "mod@x.de", role: "MODERATOR" } });
});
afterAll(() => db.$disconnect());

describe("Registrierung", () => {
  it("ohne Einladung → GUEST, Passwort argon2-gehasht, Session-Cookie", async () => {
    const r = await registerUser({ email: "New@X.de", name: "Neu", password: PW });
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
  it("Gast-Registrierung ohne Namen scheitert", async () => {
    await expect(registerUser({ email: "q@x.de", password: PW })).rejects.toBeInstanceOf(RegisterError);
  });
  it("ungültige Einladung verhindert die Registrierung", async () => {
    await expect(registerUser({ email: "a@x.de", name: "Alpha", password: PW, inviteToken: "nope-nope-nope" })).rejects.toBeInstanceOf(RegisterError);
    expect(await db.user.count({ where: { email: "a@x.de" } })).toBe(0);
  });
  it("doppelte E-Mail und zu kurzes Passwort scheitern", async () => {
    await registerUser({ email: "a@x.de", name: "Alpha", password: PW });
    await expect(registerUser({ email: "a@x.de", name: "Alpha", password: PW })).rejects.toBeInstanceOf(RegisterError);
    await expect(registerUser({ email: "b@x.de", name: "Beta", password: "short" })).rejects.toBeInstanceOf(RegisterError);
  });
  it("Client kann Rolle nicht per Body setzen und den Better-Auth-Sign-up nicht direkt benutzen", async () => {
    await expect(auth.api.signUpEmail({ body: { email: "h@x.de", name: "Hax", password: PW, role: "ADMIN" } as never })).rejects.toThrow();
    expect(await db.user.count({ where: { email: "h@x.de" } })).toBe(0);
    const r = await registerUser({ email: "h2@x.de", name: "Hax", password: PW, role: "ADMIN" });
    expect((await db.user.findUnique({ where: { id: r.userId } }))?.role).toBe("GUEST");
  });
  it("SYSTEMADMIN-Adresse nur mit Setup-Code (Default AUTH_SECRET)", async () => {
    await expect(registerUser({ email: "boss@example.com", name: "Boss", password: PW })).rejects.toMatchObject({ status: 403 });
    await expect(registerUser({ email: "boss@example.com", name: "Boss", password: PW, setupCode: "falsch" })).rejects.toMatchObject({ status: 403 });
    const r = await registerUser({ email: "boss@example.com", name: "Boss", password: PW, setupCode: "test-secret-test-secret" });
    expect(r.userId).toBeTruthy();
  });
  it("Anmeldung per Better Auth klappt, gesperrter Nutzer bekommt keine Session", async () => {
    const r = await registerUser({ email: "c@x.de", name: "Cee", password: PW });
    await db.session.deleteMany();
    await expect(auth.api.signInEmail({ body: { email: "c@x.de", password: PW } })).resolves.toBeTruthy();
    await db.session.deleteMany();
    await db.user.update({ where: { id: r.userId }, data: { banned: true } });
    await expect(auth.api.signInEmail({ body: { email: "c@x.de", password: PW } })).rejects.toThrow();
    expect(await db.session.count()).toBe(0);
  });
});
