import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, type Role } from "@/lib/permissions";
import { seedPermissions } from "@/lib/services/admin";
import { ChatError, seedChat } from "@/lib/services/chat";
import {
  berlinToDate, cancelCall, createCall, deleteCall, dispatchDueCalls, parseCoord, renderCall, saveTemplate, seedSchedule, sendCall,
} from "@/lib/services/schedule";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
const admin = { id: "adm", role: "ADMIN" as Role };
const mod = { id: "mod", role: "MODERATOR" as Role };
const f = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);
const t0 = new Date("2026-10-15T12:00:00Z");

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","RolePermission","AuditLog","Channel","Message","Tag","TagType","Taskforce","Attachment","ChannelRead","CallTemplate","AllianceCall","Player","Village" RESTART IDENTITY CASCADE`;
  await seedPermissions(db);
  await seedChat(db);
  await seedSchedule(db);
  await db.user.createMany({ data: [{ id: "adm", name: "Admin", email: "a@x.de", role: "ADMIN" }, { id: "mod", name: "Mod", email: "m@x.de", role: "MODERATOR" }] });
  await db.player.create({ data: { id: 7, name: "MG.RYFE", allianceId: 36, tribe: 3, population: 100, villageCount: 1, status: "active", noGrowthDays: 0, firstSeen: t0 } });
  await db.village.create({ data: { id: 1, fieldId: 1, x: -3, y: -82, name: "MG Ryfe", playerId: 7, population: 100, extra: {} } });
});
afterAll(() => db.$disconnect());

describe("Hilfsfunktionen", () => {
  it("parseCoord", () => {
    expect(parseCoord("(-3|-82)")).toEqual([-3, -82]);
    expect(parseCoord("12 -34")).toEqual([12, -34]);
    expect(parseCoord("−3|−82")).toEqual([-3, -82]);
    expect(parseCoord("999|1")).toBeNull();
    expect(parseCoord("abc")).toBeNull();
  });
  it("berlinToDate: Sommer-/Winterzeit", () => {
    expect(berlinToDate("2026-10-15T18:30")?.toISOString()).toBe("2026-10-15T16:30:00.000Z"); // MESZ
    expect(berlinToDate("2026-12-01T18:30")?.toISOString()).toBe("2026-12-01T17:30:00.000Z"); // MEZ
    expect(berlinToDate("kaputt")).toBeNull();
  });
  it("renderCall ersetzt Platzhalter und entfernt leere Zeilen", () => {
    const text = renderCall({ kind: "DEFF", title: "", x: -3, y: -82, playerId: 7, playerName: "MG.RYFE", villageName: "MG Ryfe", at: new Date("2026-10-15T16:30:00Z"), note: "", template: "Deff für {spieler} {koordinaten}\n{zeit}\n{link}\n{notiz}" }, "https://humans-travian.com/", "de");
    expect(text).toBe("Deff für MG.RYFE (-3|-82)\nDo., 15.10., 18:30 Uhr\nhttps://humans-travian.com/players/7");
  });
});

describe("Calls", () => {
  it("nur Koordinaten nötig: Spieler/Dorf/Link werden aufgelöst; Standardvorlage und Kanal", async () => {
    const c = await createCall(db, admin, { kind: "DEFF", coord: "-3|-82" });
    expect(c).toMatchObject({ playerName: "MG.RYFE", villageName: "MG Ryfe", playerId: 7, status: "draft" });
    expect((await db.channel.findUniqueOrThrow({ where: { id: c.channelId } })).name).toBe("Deff-Call");
    expect(renderCall(c, "https://x.de")).toContain("https://x.de/players/7");
  });
  it("Fehler: fehlende/unbekannte Koordinaten, Rechte", async () => {
    expect(await f(createCall(db, admin, { kind: "ATTACK" }))).toBeInstanceOf(ChatError);
    expect(await f(createCall(db, admin, { kind: "ATTACK", coord: "1|1" }))).toBeInstanceOf(ChatError);
    expect(await f(createCall(db, admin, { kind: "ATTACK", coord: "kaputt" }))).toBeInstanceOf(ChatError);
    expect(await f(createCall(db, mod, { kind: "ATTACK_DAY", at: t0 }))).toBeInstanceOf(ForbiddenError);
  });
  it("Jetzt senden postet in den Kanal (genau einmal); Abbrechen sperrt", async () => {
    const c = await createCall(db, admin, { kind: "ATTACK", coord: "-3|-82" });
    const sent = await sendCall(db, admin, c.id, t0);
    expect(sent.status).toBe("sent");
    const m = await db.message.findUniqueOrThrow({ where: { id: sent.messageId! } });
    expect(m.body).toContain("MG.RYFE");
    expect(m.channelId).toBe(c.channelId);
    expect(await f(sendCall(db, admin, c.id))).toBeInstanceOf(ChatError);
    const c2 = await createCall(db, admin, { kind: "ATTACK_DAY", title: "Samstag" });
    await cancelCall(db, admin, c2.id);
    expect(await f(sendCall(db, admin, c2.id))).toBeInstanceOf(ChatError);
    await deleteCall(db, admin, c2.id);
    expect(await db.allianceCall.count({ where: { id: c2.id } })).toBe(0);
  });
  it("Geplante Calls gehen erst zur Zeit raus und nur einmal", async () => {
    const later = new Date(t0.getTime() + 3600_000);
    const c = await createCall(db, admin, { kind: "ATTACK_DAY", title: "Samstag", at: later });
    expect(c.status).toBe("scheduled");
    expect(await dispatchDueCalls(db, t0)).toBe(0);
    expect(await dispatchDueCalls(db, new Date(later.getTime() + 1000))).toBe(1);
    expect(await dispatchDueCalls(db, new Date(later.getTime() + 60_000))).toBe(0);
    expect(await db.message.count({ where: { id: (await db.allianceCall.findUniqueOrThrow({ where: { id: c.id } })).messageId! } })).toBe(1);
  });
  it("Vorlagen: Admin darf, Moderator nicht; Namen eindeutig", async () => {
    const t = await saveTemplate(db, admin, { kind: "OTHER", name: "Notfall", body: "{titel} {link}" });
    expect(await f(saveTemplate(db, admin, { kind: "OTHER", name: "Notfall", body: "doppelt" }))).toBeInstanceOf(ChatError);
    expect(await f(saveTemplate(db, mod, { id: t.id, kind: "OTHER", name: "Notfall", body: "x y z" }))).toBeInstanceOf(ForbiddenError);
  });
});
