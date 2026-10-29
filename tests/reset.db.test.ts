import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { setMailTransport } from "@/lib/mail";
import { registerUser } from "@/lib/services/register";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
const sent: { to: string; text: string }[] = [];

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","Verification","Player","Setting","PlayerLink","AllianceClassification" RESTART IDENTITY CASCADE`;
  await db.setting.create({ data: { key: "allianceId", value: "36" } });
  await db.player.create({ data: { id: 1, name: "Alpha", tribe: 1, allianceId: 36, population: 1, villageCount: 1, status: "active", noGrowthDays: 0, firstSeen: new Date() } });
  sent.length = 0;
  const t = nodemailer.createTransport({ jsonTransport: true });
  const orig = t.sendMail.bind(t);
  t.sendMail = (async (m: { to: string; text: string }) => {
    sent.push({ to: m.to, text: m.text });
    return orig(m as never);
  }) as typeof t.sendMail;
  setMailTransport(t);
});
afterAll(async () => {
  setMailTransport(undefined);
  await db.$disconnect();
});

const wait = () => new Promise((r) => setTimeout(r, 50));

describe("Passwort-Reset per E-Mail", () => {
  it("Link per Mail → neues Passwort gilt, altes nicht, Sitzungen werden beendet", async () => {
    const r = await registerUser({ email: "a@x.de", name: "Alpha", password: "old-password-123", playerName: "Alpha" });
    await wait();
    sent.length = 0; // Bestätigungs-Mail der Registrierung
    await auth.api.requestPasswordReset({ body: { email: "a@x.de", redirectTo: "/reset-password" } });
    await wait();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("a@x.de");
    const token = /reset-password\/([^\s?]+)/.exec(sent[0]!.text)?.[1];
    expect(token).toBeTruthy();
    await auth.api.resetPassword({ body: { newPassword: "new-password-456", token: token! } });
    expect(await db.session.count({ where: { userId: r.userId } })).toBe(0);
    await expect(auth.api.signInEmail({ body: { email: "a@x.de", password: "old-password-123" } })).rejects.toThrow();
    await expect(auth.api.signInEmail({ body: { email: "a@x.de", password: "new-password-456" } })).resolves.toBeTruthy();
    // Token ist einmalig
    await expect(auth.api.resetPassword({ body: { newPassword: "third-password-789", token: token! } })).rejects.toThrow();
  });
  it("Registrierung mit SMTP: Bestätigungs-Mail, Link setzt emailVerified", async () => {
    const r = await registerUser({ email: "b@x.de", name: "Beta", password: "old-password-123", playerName: "Alpha" });
    await wait();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("b@x.de");
    expect((await db.user.findUniqueOrThrow({ where: { id: r.userId } })).emailVerified).toBe(false);
    const token = /verify-email\?token=([^\s&]+)/.exec(sent[0]!.text)?.[1];
    expect(token).toBeTruthy();
    await auth.api.verifyEmail({ query: { token: token! } });
    expect((await db.user.findUniqueOrThrow({ where: { id: r.userId } })).emailVerified).toBe(true);
  });
  it("unbekannte Adresse: keine Mail, kein Fehler (kein Rückschluss auf Konten)", async () => {
    await expect(auth.api.requestPasswordReset({ body: { email: "nobody@x.de", redirectTo: "/reset-password" } })).resolves.toBeTruthy();
    await wait();
    expect(sent).toHaveLength(0);
  });
});
