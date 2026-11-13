import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setPushSender, type PushTarget } from "@/lib/notify/push";
import { seedPermissions } from "@/lib/services/admin";
import { chatCtx, createTaskforce, postMessage, seedChat } from "@/lib/services/chat";
import { getOrCreateThread, sendDm } from "@/lib/services/messenger";
import { getNotifySettings, notifyChannelMessage, saveNotifySettings, saveSubscription } from "@/lib/services/notify";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
let sent: { endpoint: string; payload: { title: string; body: string; url: string } }[] = [];
let fail: Record<string, number> = {};

const sub = (userId: string) => saveSubscription(db, userId, { endpoint: `https://push.example/${userId}`, p256dh: "k", auth: "a" });
const to = (u: string) => sent.filter((s) => s.endpoint.endsWith(`/${u}`));
const ch = async (name: string) => (await db.channel.findFirstOrThrow({ where: { name } })).id;

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","RolePermission","Channel","Message","Mention","Taskforce","PushSubscription","NotifyPref","DmThread","DmMessage" RESTART IDENTITY CASCADE`;
  await seedPermissions(db);
  await seedChat(db);
  for (const [id, role] of [["m1", "MEMBER"], ["m2", "MEMBER"], ["g1", "GUEST"]] as const) await db.user.create({ data: { id, name: id, email: `${id}@x.de`, role, locale: id === "m2" ? "de" : "en" } });
  sent = [];
  fail = {};
  setPushSender(async (t: PushTarget, p: string) => {
    if (fail[t.endpoint]) throw Object.assign(new Error("gone"), { statusCode: fail[t.endpoint] });
    sent.push({ endpoint: t.endpoint, payload: JSON.parse(p) });
  });
  for (const u of ["m1", "m2", "g1"]) await sub(u);
});
afterEach(() => setPushSender(null));
afterAll(() => db.$disconnect());

describe("Push bei Kanalnachrichten", () => {
  it("Allianz-Kanal: Standard aus, nach Einschalten an; Autor bekommt nichts", async () => {
    const channelId = await ch("Deff-Call");
    const m = await db.message.create({ data: { channelId, authorId: "m1", body: "**Angriff** auf 1|2" } });
    expect(await notifyChannelMessage(db, { channelId, messageId: m.id, authorId: "m1", body: m.body })).toBe(0);
    await saveNotifySettings(db, "m2", [`ch:${channelId}`], new Set([`ch:${channelId}`]));
    await saveNotifySettings(db, "m1", [`ch:${channelId}`], new Set([`ch:${channelId}`]));
    expect(await notifyChannelMessage(db, { channelId, messageId: m.id, authorId: "m1", body: m.body })).toBe(1);
    expect(to("m2")[0]!.payload).toEqual({ title: "#Deff-Call · m1", body: "Angriff auf 1|2", url: `/chat?c=${channelId}&m=${m.id}`, tag: `ch-${channelId}` });
  });
  it("Gast ohne Leserecht bekommt nichts, auch wenn eingeschaltet", async () => {
    const channelId = await ch("Deff-Call");
    await saveNotifySettings(db, "g1", [`ch:${channelId}`], new Set([`ch:${channelId}`]));
    const m = await db.message.create({ data: { channelId, authorId: "m1", body: "x" } });
    await notifyChannelMessage(db, { channelId, messageId: m.id, authorId: "m1", body: "x" });
    expect(to("g1")).toEqual([]);
  });
  it("Erwähnung kommt trotz ausgeschaltetem Kanal (Sprache des Empfängers)", async () => {
    const channelId = await ch("Deff-Call");
    await postMessage(db, await chatCtx(db, { id: "m1", role: "MEMBER" }), { channelId, body: "hi @m2" });
    await vi.waitFor(() => expect(to("m2").length).toBe(1));
    expect(to("m2")[0]!.payload.title).toBe("m1 hat dich in #Deff-Call erwähnt");
  });
  it("Task-Force: Standard an für Mitglieder, Name der Task-Force als Titel", async () => {
    await db.user.update({ where: { id: "m1" }, data: { role: "MODERATOR" } });
    const tf = await createTaskforce(db, await chatCtx(db, { id: "m1", role: "MODERATOR" }), { name: "Hammer" });
    await db.taskforceMember.create({ data: { taskforceId: tf.id, userId: "m2" } });
    const channel = await db.channel.findFirstOrThrow({ where: { tree: "TASKFORCE" } });
    const m = await db.message.create({ data: { channelId: channel.id, authorId: "m1", body: "los" } });
    await notifyChannelMessage(db, { channelId: channel.id, messageId: m.id, authorId: "m1", body: "los" });
    expect(sent.map((s) => s.payload.title)).toEqual(["#Hammer · m1"]);
  });
  it("Alarm (ALERT) geht an alle mit Leserecht, abgelaufene Abos werden gelöscht", async () => {
    const channelId = await ch("Deff-Call");
    fail["https://push.example/m2"] = 410;
    const m = await db.message.create({ data: { channelId, authorId: "g1", body: "Angriff" } });
    await notifyChannelMessage(db, { channelId, messageId: m.id, authorId: "g1", body: "Angriff", alert: true });
    expect(to("m1")[0]!.payload.title).toBe("⚠ Attack reported");
    expect(await db.pushSubscription.count({ where: { userId: "m2" } })).toBe(0);
  });
});

describe("Push bei Direktnachrichten und Einstellungen", () => {
  it("DM an Empfänger, abschaltbar", async () => {
    const actor = { id: "m1", role: "MEMBER" as const };
    const th = await getOrCreateThread(db, actor, "m2");
    await sendDm(db, actor, th.id, "Hallo");
    await vi.waitFor(() => expect(to("m2").length).toBe(1));
    expect(to("m2")[0]!.payload).toMatchObject({ title: "Nachricht von m1", body: "Hallo", url: `/messages?c=${th.id}` });
    await saveNotifySettings(db, "m2", ["dm"], new Set());
    await sendDm(db, actor, th.id, "Noch da?");
    await new Promise((r) => setTimeout(r, 100));
    expect(to("m2").length).toBe(1);
  });
  it("Einstellungen: lesbare Kanäle, unbekannte Schlüssel ignoriert, max. 10 Geräte", async () => {
    const s = await getNotifySettings(db, { id: "m1", role: "MEMBER" });
    expect(s.general.map((r) => [r.key, r.on])).toEqual([["dm", true], ["mention", true], ["broadcast", true], ["alert", true]]);
    expect(s.channels.length).toBe(8);
    expect(s.channels.every((c) => !c.on)).toBe(true);
    expect(s.devices).toBe(1);
    expect((await getNotifySettings(db, { id: "g1", role: "GUEST" })).channels.map((c) => c.label)).toEqual(["Mixed topics"]);
    await saveNotifySettings(db, "m1", ["evil", "dm"], new Set(["evil"]));
    expect(await db.notifyPref.findMany({ where: { userId: "m1" } })).toEqual([{ userId: "m1", key: "dm", on: false }]);
    for (let i = 0; i < 12; i++) await saveSubscription(db, "m1", { endpoint: `https://push.example/x${i}`, p256dh: "k", auth: "a" });
    expect(await db.pushSubscription.count({ where: { userId: "m1" } })).toBe(10);
    await expect(saveSubscription(db, "m1", { endpoint: "http://insecure", p256dh: "k", auth: "a" })).rejects.toThrow();
  });
});
