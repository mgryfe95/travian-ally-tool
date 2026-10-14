import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/permissions";
import { classifyAlliance, deleteUser, seedPermissions, setRolePermission, setUserBanned, setUserRole } from "@/lib/services/admin";
import type { Actor } from "@/lib/services/context";

const db = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL! } } });
const SYS = ["boss@example.com"];
const admin: Actor = { id: "admin", role: "ADMIN" };
const sysadmin: Actor = { id: "boss", role: "SYSTEMADMIN" };

const mk = (id: string, email: string, role = "MEMBER") =>
  db.user.create({ data: { id, name: id, email, role } });

async function expect403(p: Promise<unknown>) {
  await expect(p).rejects.toBeInstanceOf(ForbiddenError);
}

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","RolePermission","AuditLog","AllianceClassification" RESTART IDENTITY CASCADE`;
  await seedPermissions(db);
  await mk("boss", "boss@example.com", "GUEST"); // DB-Rolle egal: ENV macht ihn zum SYSTEMADMIN
  await mk("admin", "admin@example.com", "ADMIN");
  await mk("admin2", "admin2@example.com", "ADMIN");
  await mk("mod", "mod@example.com", "MODERATOR");
  await mk("m1", "m1@example.com");
});
afterAll(() => db.$disconnect());

describe("SYSTEMADMIN-Schutz (ADMIN versucht Änderungen → 403)", () => {
  it("ändern/degradieren", async () => {
    await expect403(setUserRole(db, admin, "boss", "MEMBER", SYS));
    await expect403(setUserRole(db, admin, "boss", "GUEST", SYS));
  });
  it("sperren und löschen", async () => {
    await expect403(setUserBanned(db, admin, "boss", true, SYS));
    await expect403(deleteUser(db, admin, "boss", SYS));
    expect((await db.user.findUnique({ where: { id: "boss" } }))?.banned).toBe(false);
  });
  it("niemanden zum SYSTEMADMIN machen", async () => {
    await expect403(setUserRole(db, admin, "m1", "SYSTEMADMIN", SYS));
    await expect403(setUserRole(db, sysadmin, "m1", "SYSTEMADMIN", SYS));
    expect((await db.user.findUnique({ where: { id: "m1" } }))?.role).toBe("MEMBER");
  });
  it("Rechte der Rolle SYSTEMADMIN nicht änderbar", async () => {
    await expect403(setRolePermission(db, admin, "SYSTEMADMIN", "chat.read", false));
    await expect403(setRolePermission(db, sysadmin, "SYSTEMADMIN", "chat.read", false));
  });
  it("auch ein Account mit DB-Rolle SYSTEMADMIN wird nicht zum SYSTEMADMIN", async () => {
    await db.user.update({ where: { id: "m1" }, data: { role: "SYSTEMADMIN" } });
    await expect403(setUserRole(db, { id: "m1", role: "MEMBER" }, "mod", "GUEST", SYS));
  });
});

describe("Rollenvergabe", () => {
  it("ADMIN befördert Member zum Moderator, schreibt Audit-Log", async () => {
    await setUserRole(db, admin, "m1", "MODERATOR", SYS);
    expect((await db.user.findUnique({ where: { id: "m1" } }))?.role).toBe("MODERATOR");
    expect(await db.auditLog.findFirst({ where: { action: "user.role", actorId: "admin" } })).toMatchObject({ target: "user:m1", after: { role: "MODERATOR" } });
  });
  it("ADMIN kann weder ADMINs ändern noch ernennen; SYSTEMADMIN schon", async () => {
    await expect403(setUserRole(db, admin, "admin2", "MEMBER", SYS));
    await expect403(setUserRole(db, admin, "m1", "ADMIN", SYS));
    await setUserRole(db, sysadmin, "m1", "ADMIN", SYS);
    await setUserRole(db, sysadmin, "admin2", "MEMBER", SYS);
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
