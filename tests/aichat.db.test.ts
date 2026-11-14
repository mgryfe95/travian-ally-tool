import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Advisor } from "@/lib/ai/advice";
import { setChatLlm, type ChatLlm, type LlmRequest } from "@/lib/ai/chat";
import { setEmbedder, type Embedder } from "@/lib/ai/embed";
import { setAdvisor } from "@/lib/services/advice";
import { chatGate, createChat, deleteChat, getChat, listChats, parseSlash, sendChatMessage, startIncident } from "@/lib/services/aichat";
import { seedChat } from "@/lib/services/chat";
import { deleteMemory, embedMemory, listMemory, searchMemoryHybrid, upsertMemory } from "@/lib/services/memory";
import { runChatTool } from "@/lib/ai/tools";
import { compareLosses } from "@/lib/gamedata/losses";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
const me = { id: "u1", role: "MEMBER" as const };
const other = { id: "u2", role: "MEMBER" as const };
const usage = { input_tokens: 10, output_tokens: 5 };

/** Bag-of-words-Embedder: gleiche Wörter → ähnliche Vektoren (Synonyme über eine kleine Tabelle). */
const VOCAB = ["attack", "angriff", "evil", "wall", "crop", "farm", "deff"];
const SYN: Record<string, string> = { angriff: "attack", überfall: "attack", raid: "attack" };
const fakeEmbedder: Embedder = {
  async embed(texts) {
    return { model: "fake-1", tokens: texts.length * 5, vectors: texts.map((s) => { const w = s.toLowerCase().split(/[^a-zäöüß]+/).map((x) => SYN[x] ?? x); return VOCAB.map((v) => w.filter((x) => x === v).length + 0.01); }) };
  },
};
let requests: LlmRequest[] = [];
let replies: string[] = [];
const fakeLlm: ChatLlm = { async complete(req) { requests.push(req); return { text: replies.shift() ?? "ok", model: "claude-haiku-5-5", usage }; } };
const advisor: Advisor = { async advise() { return { summary: "Alles ruhig.", recommendations: [{ villageId: 10, type: "build", priority: 1, title: "Wall 5 → 6", reason: "Angriffe erwartet" }] }; } };

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","Village","Player","Alliance","Setting","VillageState","AdviceRun","Recommendation","AiUsage","RolePermission","Incident","Channel","Message","UnitName","Screenshot","MemoryDoc","AllianceCall","AuditLog","AiChat","AiChatMessage","GameDataVersion" RESTART IDENTITY CASCADE`;
  await db.user.createMany({ data: [{ id: "u1", name: "u1", email: "u1@x.de", role: "MEMBER" }, { id: "u2", name: "u2", email: "u2@x.de", role: "MEMBER" }] });
  await db.player.createMany({ data: [
    { id: 1, name: "Me", tribe: 2, allianceId: 0, population: 100, villageCount: 1, status: "active", noGrowthDays: 0, firstSeen: new Date() },
    { id: 9, name: "Evil", tribe: 1, allianceId: 77, population: 800, villageCount: 4, status: "active", noGrowthDays: 0, firstSeen: new Date() },
  ] });
  await db.alliance.create({ data: { id: 77, name: "BAD", memberCount: 1, villageCount: 4, population: 800 } });
  await db.village.createMany({ data: [{ id: 10, fieldId: 1, x: 0, y: 0, name: "Home", playerId: 1, population: 100, extra: {} }, { id: 90, fieldId: 2, x: 3, y: 4, name: "Evil Town", playerId: 9, population: 200, extra: {} }] });
  await db.playerLink.create({ data: { userId: "u1", travianPlayerId: 1, status: "verified", method: "invite" } });
  await seedChat(db);
  requests = [];
  replies = [];
  setChatLlm(null);
  setEmbedder(fakeEmbedder);
  setAdvisor(advisor);
});
afterEach(() => { setChatLlm(undefined); setEmbedder(undefined); setAdvisor(undefined); });
afterAll(() => db.$disconnect());

describe("Incident: Upload → Klärungs-Chat (regelbasiert, ohne KI)", () => {
  it("fragt Parameter nacheinander, prüft ja/nein, schließt ab, sendet Alarm und bettet ein", async () => {
    const now = new Date("2026-11-13T10:00:00Z");
    const { incidentId, chatId } = await startIncident(db, me, { type: "defense", villageId: 10, description: "Heute früh wurde ich überfallen" }, "de", now);
    let inc = await db.incident.findUniqueOrThrow({ where: { id: incidentId } });
    expect(inc).toMatchObject({ status: "clarifying", chatId, description: "Heute früh wurde ich überfallen" });
    let chat = (await getChat(db, "u1", chatId))!;
    expect(chat.kind).toBe("incident");
    expect(chat.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(chat.messages[1]!.content).toMatch(/Wer war der Angreifer/);
    await sendChatMessage(db, me, chatId, "(3|4)", "de", now);
    const r = await sendChatMessage(db, me, chatId, "morgen früh", "de", now);
    expect(r.answer).toMatch(/Erwartest du/); // ungültig → erneut gefragt
    expect(r.answer).toMatch(/ja, nein oder unbekannt/);
    for (const a of ["ja", "ja", "nein", "ja"]) await sendChatMessage(db, me, chatId, a, "de", now);
    inc = await db.incident.findUniqueOrThrow({ where: { id: incidentId } });
    expect(inc).toMatchObject({ status: "open", attackerName: "Evil", attackerPlayerId: 9, attackerAlliance: "BAD", params: { attacker: "(3|4)", moreAttacks: "yes", ongoing: "yes", siege: "no", needHelp: "yes" }, answers: { moreAttacks: "yes", ongoing: "yes", needHelp: "yes", siege: "no" } });
    expect(inc.alertCallId).not.toBeNull();
    expect(inc.threatUntil.toISOString()).toBe("2026-11-16T10:00:00.000Z");
    chat = (await getChat(db, "u1", chatId))!;
    expect(chat.messages.at(-1)!.content).toMatch(/Angriff melden/);
    const docs = await listMemory(db, "u1");
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ sourceType: "incident", sourceId: incidentId, embedModel: "fake-1", dims: VOCAB.length });
    expect(docs[0]!.body).toMatch(/überfallen/);
    // weitere Nachricht nach Abschluss: Hinweis statt neuer Klärung
    expect((await sendChatMessage(db, me, chatId, "noch was", "de", now)).answer).toMatch(/schon vollständig/);
    expect((await listChats(db, "u1"))[0]).toMatchObject({ kind: "incident", incidentStatus: "open" });
  });
  it("„fertig“ schließt sofort ab; sonstige Typen ohne Bedrohungsmodus; fremdes Dorf verboten", async () => {
    const now = new Date("2026-11-13T10:00:00Z");
    const { incidentId, chatId } = await startIncident(db, me, { type: "diplomacy", villageId: 10, description: "BAD hat den NAP gebrochen" }, "en", now);
    await sendChatMessage(db, me, chatId, "fertig", "en", now);
    const inc = await db.incident.findUniqueOrThrow({ where: { id: incidentId } });
    expect(inc.status).toBe("open");
    expect(inc.threatUntil.getTime()).toBe(now.getTime());
    await expect(startIncident(db, me, { type: "defense", villageId: 90, description: "x" }, "en")).rejects.toThrow();
    await expect(startIncident(db, me, { type: "defense", villageId: 10, description: "  " }, "en")).rejects.toThrow();
    await expect(sendChatMessage(db, other, chatId, "hi", "en")).rejects.toThrow();
  });
});

describe("Incident-Klärung mit KI", () => {
  it("liest Parameter aus der Beschreibung, KI-Antwort + Abschluss", async () => {
    setChatLlm(fakeLlm);
    replies = [
      JSON.stringify({ reply: "Who attacked you?", params: { attacker: null, moreAttacks: null }, note: "", complete: false }),
      JSON.stringify({ reply: "Thanks!", params: { attacker: "Evil", moreAttacks: "unknown", target: "ignored" }, note: "Evil sent 5 scouts.", complete: true }),
    ];
    const { incidentId, chatId } = await startIncident(db, me, { type: "scouted", villageId: 10, description: "got scouted" }, "en");
    expect(requests[0]!.schema).toBeTruthy();
    expect(requests[0]!.messages.at(-1)!.content).toMatch(/"type":"scouted"/);
    await sendChatMessage(db, me, chatId, "it was Evil, no idea if more", "en");
    const inc = await db.incident.findUniqueOrThrow({ where: { id: incidentId } });
    expect(inc).toMatchObject({ status: "open", attackerPlayerId: 9, params: { attacker: "Evil", moreAttacks: "unknown" } });
    expect(inc.description).toBe("got scouted\nEvil sent 5 scouts.");
    expect((await getChat(db, "u1", chatId))!.messages.at(-1)!.content).toMatch(/^Thanks!\n\n✅/);
    expect(await db.aiUsage.count({ where: { feature: "incident" } })).toBe(2);
  });
});

describe("Freier KI-Chat", () => {
  it("ohne KI gesperrt; mit KI: Lagebild + Gedächtnis im Prompt, eigener Systemprompt, Antwort gespeichert und eingebettet", async () => {
    const c = await createChat(db, me);
    expect(await chatGate(db, "u1")).toBe("noKey");
    await expect(sendChatMessage(db, me, c.id, "hi", "de")).rejects.toThrow();
    setChatLlm(fakeLlm);
    await upsertMemory(db, "u1", { sourceType: "recommendation", sourceId: 1, title: "done: Wall", body: "Angriff von Evil abgewehrt" });
    await db.user.update({ where: { id: "u1" }, data: { aiChatPrompt: "Ich spiele defensiv." } });
    replies = ["Baue die **Mauer** aus."];
    const r = await sendChatMessage(db, me, c.id, "Was tun gegen attack von Evil?", "de");
    expect(r.answer).toBe("Baue die **Mauer** aus.");
    const req = requests[0]!;
    expect(req.system[1]).toMatch(/Ich spiele defensiv/);
    expect(req.tools?.map((x) => x.name)).toEqual(["list_buildings", "get_building", "get_units", "compare_battle_losses", "search_memory"]);
    const last = req.messages.at(-1)!.content;
    expect(last).toMatch(/Answer in German/);
    expect(last).toMatch(/<situation>[\s\S]*"name":"Home"/);
    expect(last).toMatch(/<memory>[\s\S]*done: Wall/);
    const chat = (await getChat(db, "u1", c.id))!;
    expect(chat.title).toBe("Was tun gegen attack von Evil?");
    const docs = await listMemory(db, "u1", { sourceType: "chat" });
    expect(docs[0]).toMatchObject({ sourceId: c.id, embedModel: "fake-1" });
    expect(await db.aiUsage.count({ where: { feature: "chat" } })).toBe(1);
    // Löschen entfernt auch den Gedächtnis-Eintrag
    await deleteChat(db, "u1", c.id);
    expect(await listMemory(db, "u1", { sourceType: "chat" })).toEqual([]);
  });
  it("„/“-Befehle ohne KI-Antwort: help, open, search, tips (Advisor), unbekannt", async () => {
    setChatLlm(fakeLlm);
    expect(parseSlash("/Vorschläge")).toEqual({ cmd: "tips", arg: "" });
    expect(parseSlash("/suche Evil Angriff")).toEqual({ cmd: "search", arg: "Evil Angriff" });
    const c = await createChat(db, me);
    expect((await sendChatMessage(db, me, c.id, "/help", "en")).answer).toMatch(/\/tips/);
    expect((await sendChatMessage(db, me, c.id, "/open", "en")).answer).toBe("No open suggestions.");
    await upsertMemory(db, "u1", { sourceType: "recommendation", sourceId: 2, title: "Raid by Evil", body: "lost crop" });
    expect((await sendChatMessage(db, me, c.id, "/search angriff evil", "en")).answer).toMatch(/Raid by Evil/);
    expect((await sendChatMessage(db, me, c.id, "/xyz", "en")).answer).toMatch(/Unknown command/);
    await db.villageState.create({ data: { villageId: 10, userId: "u1", troops: [] } });
    const tips = await sendChatMessage(db, me, c.id, "/tips", "en");
    expect(tips.answer).toMatch(/Alles ruhig[\s\S]*P1 Wall 5 → 6/);
    expect(await db.recommendation.count({ where: { userId: "u1", status: "open" } })).toBe(1);
    expect(requests).toEqual([]); // kein freier KI-Aufruf
    expect((await sendChatMessage(db, me, c.id, "/tips", "en")).answer).toMatch(/already updated today[\s\S]*P1 Wall/);
  });
  it("Tageslimit", async () => {
    setChatLlm(fakeLlm);
    process.env.AI_CHAT_DAILY = "0";
    const { env } = await import("@/lib/env");
    const old = env().AI_CHAT_DAILY;
    (env() as { AI_CHAT_DAILY: number }).AI_CHAT_DAILY = 0;
    try {
      const c = await createChat(db, me);
      await sendChatMessage(db, me, c.id, "eins", "en");
      expect(await chatGate(db, "u1")).toBe("daily");
      await expect(sendChatMessage(db, me, c.id, "zwei", "en")).rejects.toThrow(/Daily limit|err.aichat/);
    } finally {
      (env() as { AI_CHAT_DAILY: number }).AI_CHAT_DAILY = old;
    }
  });
});

describe("RAG: Embeddings, hybride Suche, Rechte", () => {
  it("semantische Treffer (Synonym), nur eigene/globale, neu einbetten und löschen nur eigene", async () => {
    await upsertMemory(db, "u1", { sourceType: "recommendation", sourceId: 1, title: "Überfall durch Evil", body: "deff kam zu spät" });
    await upsertMemory(db, "u1", { sourceType: "recommendation", sourceId: 2, title: "Farm", body: "crop crop farm" });
    await upsertMemory(db, "u2", { sourceType: "recommendation", sourceId: 3, title: "Angriff", body: "attack attack" });
    const hits = await searchMemoryHybrid(db, "u1", "attack evil", 5);
    expect(hits[0]!.title).toBe("Überfall durch Evil"); // kein Volltext-Treffer für „attack“, aber Vektor
    expect(hits.map((h) => h.sourceId)).not.toContain(3);
    await db.$executeRaw`UPDATE "MemoryDoc" SET "embedding" = NULL, "embedModel" = NULL, "embeddedAt" = NULL`;
    expect((await listMemory(db, "u1")).every((d) => d.embeddedAt === null)).toBe(true);
    expect(await embedMemory(db, "u1", null)).toBe(2);
    expect((await listMemory(db, "u2"))[0]!.embeddedAt).toBeNull(); // fremde bleiben unberührt
    const id3 = (await listMemory(db, "u2"))[0]!.id;
    expect(await deleteMemory(db, "u1", id3)).toBe(false);
    setEmbedder(null);
    expect(await embedMemory(db, "u1", null)).toBe(0);
    expect((await searchMemoryHybrid(db, "u1", "Evil", 5)).map((h) => h.sourceId)).toEqual([1]); // Volltext-Rückfall
  });
});

describe("Werkzeuge des Chats: Spieldaten und Verlustvergleich", () => {
  it("Gebäudetabelle, Einheiten, Verluste in Rohstoffen (wer hat mehr geopfert)", async () => {
    const v = await db.gameDataVersion.create({ data: { source: "t", serverSpeed: 2 } });
    const b = await db.building.create({ data: { versionId: v.id, key: "granary", gid: 11, name: "Kornspeicher", nameEn: "Granary", category: "infrastructure", maxLevel: 20 } });
    for (const [level, cap] of [[1, 1200], [2, 1700], [3, 2300]] as const)
      await db.buildingLevel.create({ data: { buildingId: b.id, level, costWood: 80 * level, costClay: 100 * level, costIron: 70 * level, costCrop: 20 * level, upkeep: 1, buildTimeSec: 1600 * level, culturePoints: 1, effects: {}, effectRows: { create: [{ effect: "capacity", value: cap }] } } });
    const bt = await runChatTool(db, "u1", "en", "get_building", { name: "kornspeicher" });
    expect(bt.text).toMatch(/Granary \/ Kornspeicher \(max level 20, server speed x2\)/);
    expect(bt.text).toMatch(/\| 3 \| 240 \| 300 \| 210 \| 60 \|/);
    expect((await runChatTool(db, "u1", "en", "get_building", { name: "Castle" })).error).toBe(true);
    expect((await runChatTool(db, "u1", "en", "get_building", {})).error).toBe(true);
    expect((await runChatTool(db, "u1", "en", "list_buildings", {})).text).toMatch(/Granary \/ Kornspeicher \(max 20/);

    await db.unitName.createMany({ data: [
      { tribeVid: 2, slot: 1, nameEn: "Clubswinger", nameDe: "Keulenschwinger", costTotal: 250, upkeep: 1, attack: 40, gameVersion: "t", source: "t" },
      { tribeVid: 1, slot: 1, nameEn: "Legionnaire", nameDe: "Legionär", costTotal: 440, upkeep: 1, attack: 40, gameVersion: "t", source: "t" },
    ] });
    expect((await runChatTool(db, "u1", "en", "get_units", { tribe: "Römer" })).text).toMatch(/\| 1 \| 1 \| Legionnaire \/ Legionär \| 40 .*\| 440 \|/);
    expect((await runChatTool(db, "u1", "en", "get_units", { tribe: "elves" })).error).toBe(true);

    const inc = await db.incident.create({ data: { userId: "u1", villageId: 10, kind: "attack", attackerName: "Evil", attackerPlayerId: 9, answers: {}, threatUntil: new Date(), attackerLosses: [{ unit: "Legionnaire", count: 10 }], defenderLosses: [{ unit: "Keulenschwinger", count: 20 }, { unit: "Hero", count: 1 }] } });
    const c = await compareLosses(db, inc);
    expect(c.attacker).toMatchObject({ tribe: 1, total: 4400, upkeep: 10 });
    expect(c.defender).toMatchObject({ tribe: 2, total: 5000, upkeep: 20, unknown: ["Hero"] });
    expect(c.moreLost).toBe("unknown");
    await db.incident.update({ where: { id: inc.id }, data: { defenderLosses: [{ unit: "Keulenschwinger", count: 20 }] } });
    const r = JSON.parse((await runChatTool(db, "u1", "en", "compare_battle_losses", {})).text);
    expect(r).toMatchObject({ incident: { id: inc.id }, moreLost: "defender", ownLosses: { total: 5000 } });
    expect((await runChatTool(db, "u2", "en", "compare_battle_losses", { incident_id: inc.id })).error).toBe(true); // fremder Incident
  });
});
