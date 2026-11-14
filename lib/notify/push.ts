import type { PrismaClient } from "@prisma/client";
import webpush from "web-push";
import { env } from "../env";

export type PushPayload = { title: string; body: string; url: string; tag?: string };
export type PushTarget = { endpoint: string; p256dh: string; auth: string };
/** Versand an ein Gerät; wirft bei Fehler (mit `statusCode` bei HTTP-Fehlern des Push-Dienstes). */
export type PushSender = (target: PushTarget, payload: string) => Promise<void>;

type G = typeof globalThis & { __pushSender?: PushSender | null };

/** Für Tests: eigenen Versand einsetzen (null = zurück zu web-push). */
export function setPushSender(s: PushSender | null) {
  (globalThis as G).__pushSender = s;
}

export function vapidPublicKey(): string | null {
  const e = env();
  return e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY ? e.VAPID_PUBLIC_KEY : null;
}

export const pushEnabled = () => Boolean((globalThis as G).__pushSender) || vapidPublicKey() !== null;

const webPushSender: PushSender = async (t, payload) => {
  const e = env();
  await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, {
    TTL: 60 * 60,
    urgency: "high",
    vapidDetails: { subject: e.VAPID_SUBJECT, publicKey: e.VAPID_PUBLIC_KEY!, privateKey: e.VAPID_PRIVATE_KEY! },
  });
};

/** Schickt `payload` an alle Geräte der Nutzer. Abgelaufene Abos (404/410) werden gelöscht. Gibt die Zahl erfolgreicher Zustellungen zurück. */
export async function pushToUsers(db: PrismaClient, userIds: string[], payload: PushPayload | ((userId: string) => PushPayload)): Promise<number> {
  if (!userIds.length || !pushEnabled()) return 0;
  const send = (globalThis as G).__pushSender ?? webPushSender;
  const subs = await db.pushSubscription.findMany({ where: { userId: { in: [...new Set(userIds)] } } });
  let ok = 0;
  await Promise.all(subs.map(async (s) => {
    const p = typeof payload === "function" ? payload(s.userId) : payload;
    try {
      await send(s, JSON.stringify(p));
      ok++;
      await db.pushSubscription.update({ where: { id: s.id }, data: { lastOkAt: new Date() } }).catch(() => undefined);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
      else console.error("[push] Versand fehlgeschlagen", status ?? e);
    }
  }));
  return ok;
}
