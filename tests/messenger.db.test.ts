import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, type Role } from "@/lib/permissions";
import { seedPermissions } from "@/lib/services/admin";
import { ChatError } from "@/lib/services/chat";
import { capDirectMessages, getOrCreateThread, listInbox, listSent, listThreads, markBroadcastRead, pairKey, readThread, sendBroadcast, sendDm, unreadCounts } from "@/lib/services/messenger";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
const who = (id: string, role: Role) => ({ id, role });
const m1 = who("m1", "MEMBER");
const m2 = who("m2", "MEMBER");
const g1 = who("g1", "GUEST");
const mod = who("mod", "MODERATOR");
const f = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","RolePermission","AuditLog","Taskforce","DmThread","DmRead","Broadcast","Attachment" RESTART IDENTITY CASCADE`;
  await seedPermissions(db);
  for (const [id, role] of [["m1", "MEMBER"], ["m2", "MEMBER"], ["m3", "MEMBER"], ["g1", "GUEST"], ["mod", "MODERATOR"], ["adm", "ADMIN"]] as const) await db.user.create({ data: { id, name: id, email: `${id}@x.de`, role } });
});
afterAll(() => db.$disconnect());

describe("Direktnachrichten", () => {
  it("ein Thread je Paar, Senden, Ungelesen-Zähler, Lesen markiert gelesen", async () => {
    const t = await getOrCreateThread(db, m1, "m2");
    expect((await getOrCreateThread(db, m2, "m1")).id).toBe(t.id); // gleicher Thread aus Gegenrichtung
    expect(t.pairKey).toBe(pairKey("m1", "m2"));
    await sendDm(db, m1, t.id, "Hallo");
    await sendDm(db, m1, t.id, "Bist du da?");
    expect((await listThreads(db, "m2"))[0]).toMatchObject({ unread: 2, other: { id: "m1" } });
    expect((await listThreads(db, "m1"))[0]).toMatchObject({ unread: 0 });
    expect((await unreadCounts(db, "m2")).total).toBe(2);
    const r = await readThread(db, "m2", t.id);
    expect(r.messages.map((m) => m.body)).toEqual(["Hallo", "Bist du da?"]);
    expect((await unreadCounts(db, "m2")).total).toBe(0);
    await sendDm(db, m2, t.id, "Ja!");
    expect((await listThreads(db, "m1"))[0]).toMatchObject({ unread: 1 });
  });
  it("Grenzen: Gast, selbst, Fremde lesen nicht, leer/zu lang, gesperrter Empfänger", async () => {
    expect(await f(getOrCreateThread(db, g1, "m1"))).toBeInstanceOf(ForbiddenError);
    expect(await f(getOrCreateThread(db, m1, "g1"))).toBeInstanceOf(ChatError); // Gäste nicht erreichbar
    expect(await f(getOrCreateThread(db, m1, "m1"))).toBeInstanceOf(ChatError);
    const t = await getOrCreateThread(db, m1, "m2");
    expect(await f(readThread(db, "m3", t.id))).toBeInstanceOf(ChatError);
    expect(await f(sendDm(db, who("m3", "MEMBER"), t.id, "mitlesen"))).toBeInstanceOf(ChatError);
    expect(await f(sendDm(db, m1, t.id, "  "))).toBeInstanceOf(ChatError);
    expect(await f(sendDm(db, m1, t.id, "x".repeat(4001)))).toBeInstanceOf(ChatError);
    await db.user.update({ where: { id: "m2" }, data: { banned: true } });
    expect(await f(sendDm(db, m1, t.id, "hi"))).toBeInstanceOf(ChatError);
  });
});

describe("Rundnachrichten", () => {
  it("nur Moderator+; Zielgruppen alle/Rolle/Task-Force/Auswahl; Absender, Gäste und Gesperrte bekommen nichts", async () => {
    expect(await f(sendBroadcast(db, m1, { subject: "Hi", body: "x", audience: { type: "all" } }))).toBeInstanceOf(ForbiddenError);
    await db.user.update({ where: { id: "m3" }, data: { banned: true } });
    const all = await sendBroadcast(db, mod, { subject: "Angriff morgen", body: "Alle online!", audience: { type: "all" } });
    expect(all.recipients).toBe(3); // m1, m2, adm (nicht mod selbst, g1 Gast, m3 gesperrt)
    expect((await listInbox(db, "m1"))[0]).toMatchObject({ subject: "Angriff morgen", read: false, sender: { id: "mod" } });
    expect(await listInbox(db, "g1")).toEqual([]);
    expect((await sendBroadcast(db, mod, { subject: "Mods", body: "x", audience: { type: "role", role: "MODERATOR" } })).recipients).toBe(1); // adm
    const tf = await db.taskforce.create({ data: { name: "TF Süd", createdBy: "mod", members: { create: [{ userId: "mod", role: "founder" }, { userId: "m2", role: "member" }] } } });
    expect((await sendBroadcast(db, mod, { subject: "TF", body: "x", audience: { type: "taskforce", taskforceId: tf.id } })).recipients).toBe(1);
    expect((await sendBroadcast(db, mod, { subject: "Sel", body: "x", audience: { type: "users", userIds: ["m1", "g1", "mod"] } })).recipients).toBe(1);
    expect(await f(sendBroadcast(db, mod, { subject: "Leer", body: "x", audience: { type: "users", userIds: ["g1"] } }))).toBeInstanceOf(ChatError);
    expect(await f(sendBroadcast(db, mod, { subject: "", body: "x", audience: { type: "all" } }))).toBeInstanceOf(ChatError);
  });
  it("Lesen zählt in der Übersicht des Absenders; Ungelesen-Zähler", async () => {
    const b = await sendBroadcast(db, mod, { subject: "Info", body: "text", audience: { type: "all" } });
    expect((await unreadCounts(db, "m1")).broadcast).toBe(1);
    await markBroadcastRead(db, "m1", b.id);
    expect((await unreadCounts(db, "m1")).broadcast).toBe(0);
    expect((await listSent(db, "mod"))[0]).toMatchObject({ subject: "Info", recipients: 4, read: 1, audience: "All members" });
  });
});

describe("Direktnachrichten: Anhänge und Obergrenze", () => {
  const att = (uploaderId: string) => db.attachment.create({ data: { uploaderId, kind: "image", mime: "image/webp", name: "a.webp", sizeBytes: 3, storageKey: `t/${uploaderId}-${Math.random()}.webp` } });
  it("nur eigene, noch nicht verwendete Uploads; nur Anhang ohne Text erlaubt; Leser sehen Anhänge", async () => {
    const t = await getOrCreateThread(db, m1, "m2");
    const a = await att("m1");
    const foreign = await att("m2");
    expect(await f(sendDm(db, m1, t.id, "x", [foreign.id]))).toBeInstanceOf(ChatError);
    await sendDm(db, m1, t.id, "", [a.id]);
    expect(await f(sendDm(db, m1, t.id, "", [a.id]))).toBeInstanceOf(ChatError); // schon verwendet
    const r = await readThread(db, "m2", t.id);
    expect(r.messages[0]!.attachments).toEqual([expect.objectContaining({ id: a.id, name: "a.webp", removed: false })]);
  });
  it("älteste Nachrichten über der Grenze werden gelöscht", async () => {
    const t = await getOrCreateThread(db, m1, "m2");
    for (let i = 0; i < 5; i++) await sendDm(db, m1, t.id, `n${i}`);
    await sendDm(db, m2, t.id, "antwort");
    expect(await capDirectMessages(db, 3)).toBe(2);
    expect((await readThread(db, "m2", t.id)).messages.map((m) => m.body)).toEqual(["n2", "n3", "n4", "antwort"]);
    expect(await capDirectMessages(db, 0)).toBe(0);
  });
});

