import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/permissions";
import { classifyAlliance, deleteUser, seedPermissions, setPlayerRole, setRolePermission, setUserBanned, setUserRole } from "@/lib/services/admin";
import type { Actor } from "@/lib/services/context";

const db = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL! } } });
const SYS = ["boss@example.com"];
const admin: Actor = { id: "admin", role: "ADMIN" };

const mk = (id: string, email: string, role = "MEMBER") =>
  db.user.create({ data: { id, name: id, email, role } });

async function expect403(p: Promise<unknown>) {
  await expect(p).rejects.toBeInstanceOf(ForbiddenError);
}

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","RolePermission","AuditLog","AllianceClassification","PlayerRole","PlayerLink" RESTART IDENTITY CASCADE`;
  await seedPermissions(db);
  await mk("boss", "boss@example.com", "GUEST"); // DB-Rolle egal: ENV (Notzugang) macht ihn zum Admin
  await mk("admin", "admin@example.com", "ADMIN");
  await mk("admin2", "admin2@example.com", "ADMIN");
  await mk("mod", "mod@example.com", "MODERATOR");
  await mk("m1", "m1@example.com");
});
afterAll(() => db.$disconnect());

describe("Notzugangs-Konto (ENV) und eigenes Konto", () => {
  it("Notzugangs-Admin ist ein normaler Admin, Rolle/Sperre/Löschen werden aber nur über die Server-Konfiguration bestimmt", async () => {
    await expect403(setUserRole(db, admin, "boss", "MEMBER", SYS));
    await expect403(setUserBanned(db, admin, "boss", true, SYS));
    await expect403(deleteUser(db, admin, "boss", SYS));
    expect((await db.user.findUnique({ where: { id: "boss" } }))?.banned).toBe(false);
  });
  it("niemand sperrt oder löscht das eigene Konto", async () => {
    await expect403(setUserBanned(db, admin, "admin", true, SYS));
    await expect403(deleteUser(db, admin, "admin", SYS));
  });
  it("Rechte der Rolle ADMIN gibt es nicht (Admins haben immer alles)", async () => {
    await expect403(setRolePermission(db, admin, "ADMIN", "chat.read", false));
  });
  it("Alt-Rolle SYSTEMADMIN in der DB zählt als Gast", async () => {
    await db.user.update({ where: { id: "m1" }, data: { role: "SYSTEMADMIN" } });
    await expect403(setUserRole(db, { id: "m1", role: "GUEST" }, "mod", "GUEST", SYS));
  });
});

describe("Rollenvergabe", () => {
  it("ADMIN befördert Member zum Moderator, schreibt Audit-Log", async () => {
    await setUserRole(db, admin, "m1", "MODERATOR", SYS);
    expect((await db.user.findUnique({ where: { id: "m1" } }))?.role).toBe("MODERATOR");
    expect(await db.auditLog.findFirst({ where: { action: "user.role", actorId: "admin" } })).toMatchObject({ target: "user:m1", after: { role: "MODERATOR" } });
  });
  it("Admins können Admins ernennen und ändern, jeder Admin alle Rechte der Matrix", async () => {
    await setUserRole(db, admin, "m1", "ADMIN", SYS);
    await setUserRole(db, admin, "admin2", "MEMBER", SYS);
    await setRolePermission(db, admin, "MEMBER", "troops.view", true);
    expect((await db.rolePermission.count({ where: { role: "MEMBER", permission: "troops.view" } }))).toBe(1);
  });
  it("Moderator darf keine Rollen vergeben", async () => {
    await expect403(setUserRole(db, { id: "mod", role: "MODERATOR" }, "m1", "MEMBER", SYS));
  });
  it("Sperren beendet Sitzungen", async () => {
    await db.session.create({ data: { id: "s", token: "t", expiresAt: new Date(Date.now() + 1e6), userId: "m1" } });
    await setUserBanned(db, admin, "m1", true, SYS);
    expect(await db.session.count({ where: { userId: "m1" } })).toBe(0);
  });
});

describe("Rechte-Matrix", () => {
  it("ADMIN ändert Member-Recht; Änderung greift und wird protokolliert", async () => {
    await setRolePermission(db, admin, "MEMBER", "chat.upload", false);
    expect(await db.rolePermission.count({ where: { role: "MEMBER", permission: "chat.upload" } })).toBe(0);
    await setRolePermission(db, admin, "MEMBER", "chat.upload", true);
    expect(await db.rolePermission.count({ where: { role: "MEMBER", permission: "chat.upload" } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "permission.set" } })).toBe(2);
  });
  it("ADMIN sperrt sich nicht aus", async () => {
    await expect403(setRolePermission(db, admin, "ADMIN", "permissions.edit", false));
  });
  it("Moderator darf die Matrix nicht bearbeiten", async () => {
    await expect403(setRolePermission(db, { id: "mod", role: "MODERATOR" }, "MEMBER", "chat.read", false));
  });
});

describe("Allianz-Typ setzen", () => {
  it("ADMIN darf, MODERATOR nicht", async () => {
    await classifyAlliance(db, admin, 7, "ALLIED");
    expect(await db.allianceClassification.findUnique({ where: { allianceId: 7 } })).toMatchObject({ relation: "ALLIED", updatedBy: "admin" });
    await expect403(classifyAlliance(db, { id: "mod", role: "MODERATOR" }, 8, "OWN"));
    await classifyAlliance(db, admin, 7, "CLEAR");
    expect(await db.allianceClassification.count()).toBe(0);
  });
});

describe("Rolle je Spieler vorab", () => {
  it("speichert Rolle ohne Konto; verifiziertes Konto bekommt sie sofort; Moderator nur Rollen unter sich; leer = automatisch", async () => {
    await setPlayerRole(db, admin, 777, "ADMIN", SYS);
    expect((await db.playerRole.findUniqueOrThrow({ where: { travianPlayerId: 777 } })).role).toBe("ADMIN");
    await mk("pl1", "pl1@x.de", "GUEST");
    await db.playerLink.create({ data: { userId: "pl1", travianPlayerId: 778, status: "verified", method: "admin" } });
    await setPlayerRole(db, admin, 778, "MODERATOR", SYS);
    expect((await db.user.findUniqueOrThrow({ where: { id: "pl1" } })).role).toBe("MODERATOR");
    await expect403(setPlayerRole(db, { id: "mod", role: "MODERATOR" }, 779, "MODERATOR", SYS));
    await setPlayerRole(db, admin, 777, null, SYS);
    expect(await db.playerRole.count({ where: { travianPlayerId: 777 } })).toBe(0);
  });
});

