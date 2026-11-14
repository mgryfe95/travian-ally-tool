import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, type Role } from "@/lib/permissions";
import { seedPermissions } from "@/lib/services/admin";
import { ChatError } from "@/lib/services/chat";
import { canFeedback, createFeedback, listFeedback, replyFeedback, setBetaTester, setFeedbackStatus } from "@/lib/services/feedback";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
const who = (id: string, role: Role) => ({ id, role });
const admin = who("adm", "ADMIN"), tester = who("t1", "MEMBER"), other = who("m2", "MEMBER");
const f = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);
const target = { path: "/villages/1", selector: "#trp > table", label: "<table> Troops" };

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","RolePermission","AuditLog","FeedbackThread","FeedbackComment" RESTART IDENTITY CASCADE`;
  await seedPermissions(db);
  await db.user.createMany({ data: [{ id: "adm", name: "Admin", email: "a@x.de", role: "ADMIN" }, { id: "t1", name: "Tess", email: "t@x.de", role: "MEMBER" }, { id: "m2", name: "Max", email: "m@x.de", role: "MEMBER" }] });
});
afterAll(() => db.$disconnect());

describe("Beta-Feedback", () => {
  it("nur Beta-Tester und Admins; Kennzeichen setzen nur mit roles.assign", async () => {
    expect(await canFeedback(db, admin)).toBe(true);
    expect(await canFeedback(db, tester)).toBe(false);
    expect(await f(createFeedback(db, tester, { ...target, body: "x" }))).toBeInstanceOf(ForbiddenError);
    expect(await f(setBetaTester(db, other, "t1", true))).toBeInstanceOf(ForbiddenError);
    await setBetaTester(db, admin, "t1", true);
    expect(await canFeedback(db, tester)).toBe(true);
    expect(await f(listFeedback(db, other))).toBeInstanceOf(ForbiddenError);
  });
  it("Thread zu einem Element, Unterhaltung, schließen/öffnen, Filter nach Status und Seite", async () => {
    await setBetaTester(db, admin, "t1", true);
    expect(await f(createFeedback(db, tester, { ...target, body: "  " }))).toBeInstanceOf(ChatError);
    expect(await f(createFeedback(db, tester, { ...target, path: "javascript:x", body: "x" }))).toBeInstanceOf(ChatError);
    const a = await createFeedback(db, tester, { ...target, body: "Spalte „Away“ ist unklar" });
    await replyFeedback(db, admin, a.id, "Gemeint sind Truppen unterwegs – Text wird angepasst.");
    const b = await createFeedback(db, admin, { path: "/chat", selector: "#msg", body: "Platzhalter zu lang" });
    await setFeedbackStatus(db, tester, b.id, "closed", new Date("2026-11-11T10:00:00Z"));
    const all = await listFeedback(db, tester);
    expect(all.map((x) => x.id)).toEqual([b.id, a.id]);
    expect(all[1]).toMatchObject({ path: "/villages/1", selector: "#trp > table", label: "<table> Troops", status: "open", createdBy: { name: "Tess" } });
    expect(all[1]!.comments.map((c) => c.author.name)).toEqual(["Tess", "Admin"]);
    expect(all[0]).toMatchObject({ status: "closed", closedBy: { name: "Tess" }, closedAt: "2026-11-11T10:00:00.000Z" });
    expect((await listFeedback(db, tester, { status: "open" })).map((x) => x.id)).toEqual([a.id]);
    expect((await listFeedback(db, tester, { status: "closed" })).map((x) => x.id)).toEqual([b.id]);
    expect((await listFeedback(db, tester, { path: "/chat" })).map((x) => x.id)).toEqual([b.id]);
    await setFeedbackStatus(db, admin, b.id, "open");
    expect((await listFeedback(db, admin, { status: "open" })).length).toBe(2);
    expect(await f(replyFeedback(db, admin, 999, "x"))).toBeInstanceOf(ChatError);
  });
});
