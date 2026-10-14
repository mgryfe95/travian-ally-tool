import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { auth, INTERNAL_HEADER, internalSecret } from "../auth";
import { db } from "../db";
import { env } from "../env";
import { findOpenInvite, redeemInvite, VerificationError } from "./verification";

export class RegisterError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  /** Bei Einladungen optional: dann gilt der Spielername. */
  name: z.string().trim().min(2).max(40).optional(),
  password: z.string().min(10).max(200),
  inviteToken: z.string().min(10).max(200).optional(),
  setupCode: z.string().max(200).optional(),
});

const digest = (s: string) => createHash("sha256").update(s).digest();
const safeEqual = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

/**
 * Registrierung. Ohne Einladung → GUEST. Mit gültiger Einladung → MEMBER + verifizierter PlayerLink.
 * SYSTEMADMIN-Adressen (ENV) lassen sich nur mit Setup-Code registrieren, damit sie niemand vorab belegen kann.
 */
export async function registerUser(raw: unknown) {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) throw new RegisterError("Eingaben ungültig (Passwort mind. 10 Zeichen)");
  const { email, password, inviteToken, setupCode } = parsed.data;
  let name = parsed.data.name;
  const cfg = env();

  if (cfg.SYSTEMADMIN_EMAILS.includes(email)) {
    const expected = cfg.SYSTEMADMIN_SETUP_CODE ?? cfg.AUTH_SECRET;
    if (!setupCode || !safeEqual(setupCode, expected)) throw new RegisterError("Setup-Code erforderlich oder falsch", 403);
  }
  if (inviteToken) {
    const invite = await findOpenInvite(db, inviteToken);
    if (!invite) throw new RegisterError("Einladung ungültig, abgelaufen oder bereits verwendet. Bitte einen Admin um einen neuen Link bitten.");
    name ??= (await db.player.findUnique({ where: { id: invite.travianPlayerId }, select: { name: true } }))?.name;
  }
  if (!name) throw new RegisterError("Bitte einen Anzeigenamen angeben");

  let result;
  try {
    result = await auth.api.signUpEmail({
      body: { email, name, password },
      headers: new Headers({ [INTERNAL_HEADER]: internalSecret() }),
      returnHeaders: true,
    });
  } catch {
    // Keine Unterscheidung „E-Mail existiert“ vs. sonstiger Fehler nach außen.
    throw new RegisterError("Registrierung nicht möglich (E-Mail bereits vergeben?)");
  }
  const userId = result.response.user.id;
  let verified = false;
  let warning: string | undefined;
  if (inviteToken) {
    try {
      await redeemInvite(db, inviteToken, userId);
      verified = true;
    } catch (e) {
      if (!(e instanceof VerificationError)) throw e;
      warning = e.message;
    }
  }
  return { userId, verified, warning, setCookie: result.headers.getSetCookie() };
}
