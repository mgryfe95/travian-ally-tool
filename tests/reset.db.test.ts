import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { setMailTransport } from "@/lib/mail";
import { registerUser } from "@/lib/services/register";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
const sent: { to: string; text: string }[] = [];

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","Verification" RESTART IDENTITY CASCADE`;
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
    const r = await registerUser({ email: "a@x.de", name: "Alpha", password: "old-password-123" });
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
  it("unbekannte Adresse: keine Mail, kein Fehler (kein Rückschluss auf Konten)", async () => {
    await expect(auth.api.requestPasswordReset({ body: { email: "nobody@x.de", redirectTo: "/reset-password" } })).resolves.toBeTruthy();
    await wait();
    expect(sent).toHaveLength(0);
  });
});
