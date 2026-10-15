import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cleanupOrphanAttachments } from "@/lib/chat/cleanup";
import { ForbiddenError, type Role } from "@/lib/permissions";
import { seedPermissions } from "@/lib/services/admin";
import {
  addTaskforceMember, archiveTaskforce, ChatError, chatCtx, createChannel, createTaskforce, deleteMessage, deleteTag, deleteTagType, editMessage, listChannels,
  listMessages, markRead, moveChannel, postMessage, removeTaskforceMember, saveTag, saveTagType, seedChat, updateChannel,
} from "@/lib/services/chat";
import { storage } from "@/lib/storage";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
const who = (id: string, role: Role) => ({ id, role });
const member = who("m1", "MEMBER");
const member2 = who("m2", "MEMBER");
const guest = who("g1", "GUEST");
const mod = who("mod", "MODERATOR");
const mod2 = who("mod2", "MODERATOR");
const admin = who("adm", "ADMIN");
const ctx = (a: { id: string; role: Role }) => chatCtx(db, a);
const ch = async (name: string) => (await db.channel.findFirstOrThrow({ where: { name } })).id;
const f = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","RolePermission","AuditLog","Channel","Message","Tag","TagType","Taskforce","Attachment","ChannelRead" RESTART IDENTITY CASCADE`;
  await seedPermissions(db);
  await seedChat(db);
  for (const [id, role] of [["m1", "MEMBER"], ["m2", "MEMBER"], ["g1", "GUEST"], ["mod", "MODERATOR"], ["mod2", "MODERATOR"], ["adm", "ADMIN"]] as const)
    await db.user.create({ data: { id, name: id, email: `${id}@x.de`, role } });
});
afterAll(() => db.$disconnect());

describe("Seed und Sichtbarkeit", () => {
  it("8 Standardkanäle + 4 Tags in einem Typ, idempotent", async () => {
    await seedChat(db);
    expect((await db.channel.findMany({ orderBy: { sortOrder: "asc" } })).map((c) => c.name)).toEqual(["Deff-Call", "Deff-Reports", "Off-Call", "Off-Reports", "Ressources", "Settlement", "Sitter", "Mixed topics"]);
    expect(await db.tag.count()).toBe(4);
  });
  it("Member sieht alle, Gast nur Kanäle mit minReadRole=GUEST", async () => {
    expect((await listChannels(db, await ctx(member))).length).toBe(8);
    expect((await listChannels(db, await ctx(guest))).map((c) => c.name)).toEqual(["Mixed topics"]);
  });
});

describe("Schreiben", () => {
  it("Member postet mit Tag; Gast und fremde Rolle werden abgelehnt (403)", async () => {
    const tag = await db.tag.findFirstOrThrow({ where: { name: "Dringend" } });
    const m = await postMessage(db, await ctx(member), { channelId: await ch("Deff-Call"), body: "Angriff auf (12|-34)", tagIds: [tag.id] });
    expect(m).toMatchObject({ body: "Angriff auf (12|-34)", tags: [{ name: "Dringend" }], author: { id: "m1" } });
    expect(await f(postMessage(db, await ctx(guest), { channelId: await ch("Mixed topics"), body: "hi" }))).toBeInstanceOf(ForbiddenError);
    expect(await f(postMessage(db, await ctx(guest), { channelId: await ch("Deff-Call"), body: "hi" }))).toBeInstanceOf(ForbiddenError);
  });
  it("leer, zu lang, unbekannter Tag", async () => {
    const channelId = await ch("Deff-Call");
    const c = await ctx(member);
    expect(await f(postMessage(db, c, { channelId, body: "  " }))).toBeInstanceOf(ChatError);
    expect(await f(postMessage(db, c, { channelId, body: "x".repeat(4001) }))).toBeInstanceOf(ChatError);
    expect(await f(postMessage(db, c, { channelId, body: "x", tagIds: [999] }))).toBeInstanceOf(ChatError);
  });
  it("Schreib-Mindestrolle pro Kanal", async () => {
    const channelId = await ch("Sitter");
    await updateChannel(db, await ctx(admin), channelId, { minWriteRole: "MODERATOR" });
    expect(await f(postMessage(db, await ctx(member), { channelId, body: "x" }))).toBeInstanceOf(ForbiddenError);
    await postMessage(db, await ctx(mod), { channelId, body: "x" });
  });
});

describe("Sammelraum, Tags, Suche, Cursor", () => {
  it("„Alle“ enthält lesbare Allianz-Kanäle mit Kanalname, keine Task-Force-Nachrichten", async () => {
    await postMessage(db, await ctx(member), { channelId: await ch("Deff-Call"), body: "a" });
    await postMessage(db, await ctx(member), { channelId: await ch("Off-Call"), body: "b" });
    const tf = await createTaskforce(db, await ctx(mod), { name: "TF Süd", memberIds: ["m1"] });
    const tfCh = await db.channel.findFirstOrThrow({ where: { taskforceId: tf.id } });
    await postMessage(db, await ctx(member), { channelId: tfCh.id, body: "geheim" });
    const all = await listMessages(db, await ctx(member), { channelId: "all" });
    expect(all.messages.map((m) => [m.body, m.channelName])).toEqual([["a", "Deff-Call"], ["b", "Off-Call"]]);
    expect((await listMessages(db, await ctx(guest), { channelId: "all" })).messages).toEqual([]);
  });
  it("Tag-Filter, Volltextsuche und Cursor-Pagination", async () => {
    const channelId = await ch("Deff-Call");
    const c = await ctx(member);
    const tag = await db.tag.findFirstOrThrow({ where: { name: "Info" } });
    for (let i = 1; i <= 5; i++) await postMessage(db, c, { channelId, body: i === 3 ? "Brauche Getreide dringend" : `Nachricht ${i}`, tagIds: i === 2 ? [tag.id] : [] });
    expect((await listMessages(db, c, { channelId, tagId: tag.id })).messages.map((m) => m.body)).toEqual(["Nachricht 2"]);
    expect((await listMessages(db, c, { channelId, q: "Getreide" })).messages.map((m) => m.body)).toEqual(["Brauche Getreide dringend"]);
    const p1 = await listMessages(db, c, { channelId, limit: 2 });
    expect(p1.messages.map((m) => m.body)).toEqual(["Nachricht 4", "Nachricht 5"]);
    const p2 = await listMessages(db, c, { channelId, limit: 2, before: p1.nextBefore! });
    expect(p2.messages.map((m) => m.body)).toEqual(["Nachricht 2", "Brauche Getreide dringend"]);
    expect(p2.nextBefore).not.toBeNull();
    expect((await listMessages(db, c, { channelId, limit: 2, before: p2.nextBefore! })).nextBefore).toBeNull();
  });
  it("Lesen fremder Kanäle → 403", async () => {
    expect(await f(listMessages(db, await ctx(guest), { channelId: await ch("Deff-Call") }))).toBeInstanceOf(ForbiddenError);
  });
});

describe("Bearbeiten und Löschen", () => {
  it("nur Autor bearbeitet; Moderator löscht fremde, Member nicht", async () => {
    const channelId = await ch("Deff-Call");
    const m = await postMessage(db, await ctx(member), { channelId, body: "alt" });
    expect((await editMessage(db, await ctx(member), m.id, "neu")).editedAt).not.toBeNull();
    expect(await f(editMessage(db, await ctx(mod), m.id, "x"))).toBeInstanceOf(ForbiddenError);
    expect(await f(deleteMessage(db, await ctx(member2), m.id))).toBeInstanceOf(ForbiddenError);
    await deleteMessage(db, await ctx(mod), m.id);
    expect((await listMessages(db, await ctx(member), { channelId })).messages).toEqual([]);
    expect(await db.auditLog.count({ where: { action: "message.moderate_delete" } })).toBe(1);
  });
  it("Löschen entfernt Anhänge samt Dateien", async () => {
    await storage().put("t/a.bin", Buffer.from("x"));
    const att = await db.attachment.create({ data: { uploaderId: "m1", kind: "text", mime: "text/plain", name: "a.txt", sizeBytes: 1, storageKey: "t/a.bin" } });
    const m = await postMessage(db, await ctx(member), { channelId: await ch("Deff-Call"), body: "mit Datei", attachmentIds: [att.id] });
    expect(m.attachments).toHaveLength(1);
    await deleteMessage(db, await ctx(member), m.id);
    expect(await db.attachment.count()).toBe(0);
    expect(await storage().exists("t/a.bin")).toBe(false);
  });
});

describe("Anhänge an Nachrichten", () => {
  it("fremde Anhänge, fehlendes chat.upload und Limit pro Nachricht", async () => {
    const mk = (uploaderId: string) => db.attachment.create({ data: { uploaderId, kind: "text", mime: "text/plain", name: "a.txt", sizeBytes: 1, storageKey: `k/${Math.random()}` } });
    const foreign = await mk("m2");
    const channelId = await ch("Deff-Call");
    expect(await f(postMessage(db, await ctx(member), { channelId, body: "x", attachmentIds: [foreign.id] }))).toBeInstanceOf(ChatError);
    await db.rolePermission.deleteMany({ where: { role: "MEMBER", permission: "chat.upload" } });
    const own = await mk("m1");
    expect(await f(postMessage(db, await ctx(member), { channelId, body: "x", attachmentIds: [own.id] }))).toBeInstanceOf(ForbiddenError);
    await db.rolePermission.create({ data: { role: "MEMBER", permission: "chat.upload" } });
    const eleven = await Promise.all(Array.from({ length: 11 }, () => mk("m1")));
    expect(await f(postMessage(db, await ctx(member), { channelId, body: "x", attachmentIds: eleven.map((a) => a.id) }))).toBeInstanceOf(ChatError);
  });
  it("verwaiste Uploads werden nach 24 h samt Dateien aufgeräumt", async () => {
    await storage().put("o/old.bin", Buffer.from("x"));
    await storage().put("o/new.bin", Buffer.from("x"));
    const old = await db.attachment.create({ data: { uploaderId: "m1", kind: "text", mime: "text/plain", name: "a", sizeBytes: 1, storageKey: "o/old.bin", createdAt: new Date(Date.now() - 25 * 3_600_000) } });
    await db.attachment.create({ data: { uploaderId: "m1", kind: "text", mime: "text/plain", name: "b", sizeBytes: 1, storageKey: "o/new.bin" } });
    expect(await cleanupOrphanAttachments(db)).toBe(1);
    expect(await db.attachment.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await storage().exists("o/old.bin")).toBe(false);
    expect(await storage().exists("o/new.bin")).toBe(true);
  });
});

describe("Ungelesen", () => {
  it("zählt fremde Nachrichten seit letztem Lesen; markRead setzt zurück; eigene zählen nicht", async () => {
    const channelId = await ch("Deff-Call");
    await postMessage(db, await ctx(member), { channelId, body: "1" });
    await postMessage(db, await ctx(member), { channelId, body: "2" });
    const unread = async (a: { id: string; role: Role }) => (await listChannels(db, await ctx(a))).find((c) => c.id === channelId)!.unread;
    expect(await unread(member)).toBe(0);
    expect(await unread(member2)).toBe(2);
    await markRead(db, await ctx(member2), channelId);
    expect(await unread(member2)).toBe(0);
    await postMessage(db, await ctx(member), { channelId, body: "3" });
    expect(await unread(member2)).toBe(1);
  });
});

describe("Task-Forces", () => {
  it("anlegen braucht taskforce.create; Kanal nur für Mitglieder; Admin sieht alle", async () => {
    expect(await f(createTaskforce(db, await ctx(member), { name: "TF X" }))).toBeInstanceOf(ForbiddenError);
    const tf = await createTaskforce(db, await ctx(mod), { name: "TF Südfront", memberIds: ["m1", "g1"] });
    expect((await db.taskforceMember.findMany({ where: { taskforceId: tf.id } })).map((m) => m.userId).sort()).toEqual(["m1", "mod"]); // Gast wird nicht aufgenommen
    const names = async (a: { id: string; role: Role }) => (await listChannels(db, await ctx(a))).filter((c) => c.tree === "TASKFORCE").map((c) => c.name);
    expect(await names(member)).toEqual(["TF Südfront"]);
    expect(await names(member2)).toEqual([]);
    expect(await names(mod2)).toEqual([]);
    expect(await names(admin)).toEqual(["TF Südfront"]);
    const tfCh = await db.channel.findFirstOrThrow({ where: { taskforceId: tf.id } });
    expect(await f(listMessages(db, await ctx(member2), { channelId: tfCh.id }))).toBeInstanceOf(ForbiddenError);
    expect(await f(postMessage(db, await ctx(mod2), { channelId: tfCh.id, body: "x" }))).toBeInstanceOf(ForbiddenError);
  });
  it("Lead verwaltet Mitglieder, letzter Lead bleibt, Archivieren blendet aus", async () => {
    const tf = await createTaskforce(db, await ctx(mod), { name: "TF Nord" });
    expect(await f(addTaskforceMember(db, await ctx(member), tf.id, "m2"))).toBeInstanceOf(ForbiddenError);
    await addTaskforceMember(db, await ctx(mod), tf.id, "m2");
    expect((await listChannels(db, await ctx(member2))).some((c) => c.name === "TF Nord")).toBe(true);
    await removeTaskforceMember(db, await ctx(mod), tf.id, "m2");
    expect(await f(removeTaskforceMember(db, await ctx(mod), tf.id, "mod"))).toBeInstanceOf(ChatError);
    await archiveTaskforce(db, await ctx(mod), tf.id);
    expect((await listChannels(db, await ctx(mod))).some((c) => c.name === "TF Nord")).toBe(false);
  });
});

describe("Kanäle und Tags verwalten", () => {
  it("Admin legt an, benennt um, sortiert, archiviert; Moderator darf nicht", async () => {
    expect(await f(createChannel(db, await ctx(mod), { name: "Neu" }))).toBeInstanceOf(ForbiddenError);
    const c = await createChannel(db, await ctx(admin), { name: "Diplomatie" });
    await updateChannel(db, await ctx(admin), c.id, { name: "Diplomatie & Pakte" });
    await moveChannel(db, await ctx(admin), c.id, -1);
    const names = (await listChannels(db, await ctx(member))).map((x) => x.name);
    expect(names.indexOf("Diplomatie & Pakte")).toBe(names.length - 2);
    await updateChannel(db, await ctx(admin), c.id, { archived: true });
    expect((await listChannels(db, await ctx(member))).some((x) => x.id === c.id)).toBe(false);
  });
  it("Tags: nur mit tags.manage; Name eindeutig; Farbe aus Vorgabe", async () => {
    const type = await db.tagType.findFirstOrThrow();
    expect(await f(saveTag(db, await ctx(member), { tagTypeId: type.id, name: "Neu", color: "red" }))).toBeInstanceOf(ForbiddenError);
    const t = await saveTag(db, await ctx(mod), { tagTypeId: type.id, name: "Wichtig", color: "purple" });
    expect(await f(saveTag(db, await ctx(mod), { tagTypeId: type.id, name: "Wichtig", color: "red" }))).toBeInstanceOf(ChatError);
    expect(await f(saveTag(db, await ctx(mod), { tagTypeId: type.id, name: "Bunt", color: "pink" }))).toBeInstanceOf(ChatError);
    await deleteTag(db, await ctx(mod), t.id);
    expect(await db.tag.count({ where: { name: "Wichtig" } })).toBe(0);
  });
});

describe("Tag-Typen", () => {
  it("Typ gilt nur in zugewiesenen Kanälen; Einzelauswahl und Pflicht werden erzwungen", async () => {
    const c = await ctx(mod);
    const prio = await saveTagType(db, c, { name: "Priorität", multi: false, required: true, forTaskforces: false, channelIds: [await ch("Deff-Call")] });
    const hoch = await saveTag(db, c, { tagTypeId: prio.id, name: "Hoch", color: "red" });
    const niedrig = await saveTag(db, c, { tagTypeId: prio.id, name: "Niedrig", color: "gray" });
    const mc = await ctx(member);
    const deff = await ch("Deff-Call");
    expect(await f(postMessage(db, mc, { channelId: deff, body: "x" }))).toBeInstanceOf(ChatError); // Pflicht fehlt
    expect(await f(postMessage(db, mc, { channelId: deff, body: "x", tagIds: [hoch.id, niedrig.id] }))).toBeInstanceOf(ChatError); // nur ein Tag
    expect((await postMessage(db, mc, { channelId: deff, body: "ok", tagIds: [hoch.id] })).tags.map((t) => t.name)).toEqual(["Hoch"]);
    // in einem anderen Kanal nicht angeboten: Tag abgelehnt, Nachricht ohne Tag erlaubt
    const off = await ch("Off-Call");
    expect(await f(postMessage(db, mc, { channelId: off, body: "x", tagIds: [hoch.id] }))).toBeInstanceOf(ChatError);
    expect((await postMessage(db, mc, { channelId: off, body: "ohne" })).tags).toEqual([]);
  });
  it("multi erlaubt mehrere Tags; gleicher Tag-Name in verschiedenen Typen; Löschen nur ohne Tags; Rechte", async () => {
    const c = await ctx(mod);
    const t = await saveTagType(db, c, { name: "Themen", multi: true, required: false, forTaskforces: false, channelIds: [await ch("Off-Call")] });
    const a = await saveTag(db, c, { tagTypeId: t.id, name: "Info", color: "blue" }); // „Info“ existiert auch in Kategorie
    const b = await saveTag(db, c, { tagTypeId: t.id, name: "Ziel", color: "green" });
    const m = await postMessage(db, await ctx(member), { channelId: await ch("Off-Call"), body: "x", tagIds: [a.id, b.id] });
    expect(m.tags.length).toBe(2);
    expect(await f(deleteTagType(db, c, t.id))).toBeInstanceOf(ChatError);
    expect(await f(saveTagType(db, await ctx(member), { name: "Nope", multi: false, required: false, forTaskforces: true, channelIds: [] }))).toBeInstanceOf(ForbiddenError);
    await deleteTag(db, c, a.id);
    await deleteTag(db, c, b.id);
    await deleteTagType(db, c, t.id);
    expect(await db.tagType.count({ where: { id: t.id } })).toBe(0);
  });
  it("Task-Force-Kanäle bekommen Typen mit forTaskforces", async () => {
    const c = await ctx(mod);
    const t = await saveTagType(db, c, { name: "TF-Typ", multi: false, required: true, forTaskforces: true, channelIds: [] });
    const tag = await saveTag(db, c, { tagTypeId: t.id, name: "Plan", color: "amber" });
    const tf = await createTaskforce(db, await ctx(mod), { name: "Operation X" } as never);
    const tfChannel = await db.channel.findFirstOrThrow({ where: { taskforceId: (tf as { id: number }).id } });
    expect(await f(postMessage(db, await ctx(mod), { channelId: tfChannel.id, body: "x" }))).toBeInstanceOf(ChatError);
    expect((await postMessage(db, await ctx(mod), { channelId: tfChannel.id, body: "x", tagIds: [tag.id] })).tags.length).toBe(1);
  });
});
