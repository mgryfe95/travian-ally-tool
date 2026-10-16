import { describe, expect, it } from "vitest";
import { defaultMatrix, type Role } from "../permissions";
import { canDeleteMessage, canEditMessage, canManageTaskforce, canReadChannel, canWriteChannel, type ChannelLike, type ChatCtx } from "./access";

const m = defaultMatrix();
const ctx = (role: Role, taskforceIds: number[] = [], userId = "u"): ChatCtx => ({ userId, role, matrix: m, taskforceIds: new Set(taskforceIds) });
const ally = (o: Partial<ChannelLike> = {}): ChannelLike => ({ tree: "ALLY", taskforceId: null, minReadRole: "MEMBER", minWriteRole: "MEMBER", archivedAt: null, ...o });
const tf = (id = 1): ChannelLike => ({ tree: "TASKFORCE", taskforceId: id, minReadRole: "MEMBER", minWriteRole: "MEMBER", archivedAt: null });

describe("Allianz-Kanäle", () => {
  it("Member liest und schreibt, Gast nur wo minReadRole=GUEST und nie schreibt", () => {
    expect(canReadChannel(ally(), ctx("MEMBER"))).toBe(true);
    expect(canWriteChannel(ally(), ctx("MEMBER"))).toBe(true);
    expect(canReadChannel(ally(), ctx("GUEST"))).toBe(false);
    expect(canReadChannel(ally({ minReadRole: "GUEST" }), ctx("GUEST"))).toBe(false); // GUEST hat keine Rechte mehr (gesperrt bis zur Verifizierung)
    expect(canWriteChannel(ally({ minReadRole: "GUEST", minWriteRole: "GUEST" }), ctx("GUEST"))).toBe(false);
  });
  it("Schreib-Mindestrolle wird geprüft", () => {
    expect(canWriteChannel(ally({ minWriteRole: "MODERATOR" }), ctx("MEMBER"))).toBe(false);
    expect(canWriteChannel(ally({ minWriteRole: "MODERATOR" }), ctx("MODERATOR"))).toBe(true);
  });
  it("archivierte Kanäle sind unsichtbar; unbekannte Mindestrolle schließt aus", () => {
    expect(canReadChannel(ally({ archivedAt: new Date() }), ctx("ADMIN"))).toBe(false);
    expect(canReadChannel(ally({ minReadRole: "???" }), ctx("MODERATOR"))).toBe(false);
  });
});

describe("Task-Force-Kanäle", () => {
  it("nur Mitglieder; Nicht-Mitglieder (auch Moderatoren) sehen nichts", () => {
    expect(canReadChannel(tf(1), ctx("MEMBER", [1]))).toBe(true);
    expect(canWriteChannel(tf(1), ctx("MEMBER", [1]))).toBe(true);
    expect(canReadChannel(tf(1), ctx("MEMBER", [2]))).toBe(false);
    expect(canReadChannel(tf(1), ctx("MODERATOR"))).toBe(false);
    expect(canWriteChannel(tf(1), ctx("MODERATOR"))).toBe(false);
  });
  it("ADMIN sieht alle", () => {
    expect(canReadChannel(tf(1), ctx("ADMIN"))).toBe(true);
  });
  it("Verwaltung: Lead, taskforce.manage oder Admin", () => {
    expect(canManageTaskforce(ctx("MEMBER"), true)).toBe(true);
    expect(canManageTaskforce(ctx("MEMBER"), false)).toBe(false);
    expect(canManageTaskforce(ctx("ADMIN"), false)).toBe(true);
  });
});

describe("Nachrichten", () => {
  it("Bearbeiten nur Autor, Löschen Autor oder chat.moderate", () => {
    expect(canEditMessage("u", ctx("MEMBER"))).toBe(true);
    expect(canEditMessage("x", ctx("MODERATOR"))).toBe(false);
    expect(canDeleteMessage("x", ctx("MODERATOR"))).toBe(true);
    expect(canDeleteMessage("x", ctx("MEMBER"))).toBe(false);
  });
});
