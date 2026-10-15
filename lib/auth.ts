import { hash, verify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import { env } from "./env";
import { resetMail, sendMail } from "./mail";
import { matchLocale, translate } from "./i18n";

/** Header, mit dem nur unsere eigene Registrierungs-Route (/api/register) den Sign-up von Better Auth aufrufen darf. */
export const INTERNAL_HEADER = "x-internal-register";
export const internalSecret = () => env().AUTH_SECRET;

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret: env().AUTH_SECRET,
  baseURL: env().APP_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 3600,
    revokeSessionsOnPasswordReset: true,
    // Versandfehler werden nur geloggt und nie nach außen gemeldet (sonst ließe sich erraten, ob eine Adresse existiert).
    sendResetPassword: async ({ user, url }) => {
      void sendMail(resetMail(user.email, user.name, url, (user as { locale?: string | null }).locale)).catch((e) => console.error("[mail] Reset-Mail fehlgeschlagen", e));
    },
    password: {
      hash: (password) => hash(password),
      verify: ({ hash: h, password }) => verify(h, password),
    },
  },
  user: {
    additionalFields: {
      // input:false → ein Client kann Rolle/Sperre nie selbst setzen.
      role: { type: "string", defaultValue: "GUEST", input: false },
      banned: { type: "boolean", defaultValue: false, input: false },
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: env().AUTH_RATE_LIMIT_PER_MIN },
      "/sign-up/email": { window: 60, max: env().AUTH_RATE_LIMIT_PER_MIN },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" && ctx.headers?.get(INTERNAL_HEADER) !== internalSecret()) {
        throw new APIError("FORBIDDEN", { message: translate(matchLocale(ctx.headers?.get("accept-language")), "err.registerOnly") });
      }
    }),
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const u = await db.user.findUnique({ where: { id: session.userId }, select: { banned: true } });
          if (u?.banned) return false;
          return { data: session };
        },
      },
    },
  },
  plugins: [nextCookies()],
});
