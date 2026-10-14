import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(1),
  SYSTEMADMIN_EMAILS: z.string().default(""),
  TRAVIAN_SERVER_URL: z.string().url(),
  TRAVIAN_ALLIANCE_ID: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  IMPORT_CRON: z.string().default("15 * * * *"),
  INACTIVE_DAYS: z.coerce.number().int().positive().default(3),
  /** Code, der zum Registrieren eines SYSTEMADMIN_EMAILS-Kontos nötig ist (Default: AUTH_SECRET). Verhindert, dass Fremde die Admin-Adresse vorab belegen. */
  SYSTEMADMIN_SETUP_CODE: z.preprocess(emptyToUndefined, z.string().min(8).optional()),
  /** Better-Auth-Rate-Limit für Sign-in/Sign-up pro Minute und IP (E2E erhöht es). */
  AUTH_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(5),
  STORAGE_DIR: z.string().default("./storage"),
  UPLOAD_MAX_IMAGE_MB: z.coerce.number().positive().default(10),
  UPLOAD_MAX_FILE_MB: z.coerce.number().positive().default(20),
  UPLOAD_MAX_FILES: z.coerce.number().int().positive().default(10),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
});

export type Env = Omit<z.infer<typeof schema>, "SYSTEMADMIN_EMAILS"> & { SYSTEMADMIN_EMAILS: string[] };

export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = schema.parse(source);
  return {
    ...parsed,
    TRAVIAN_SERVER_URL: parsed.TRAVIAN_SERVER_URL.replace(/\/+$/, ""),
    SYSTEMADMIN_EMAILS: parsed.SYSTEMADMIN_EMAILS.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  };
}

let cached: Env | undefined;
export function env(): Env {
  return (cached ??= parseEnv(process.env));
}
