import { z } from "zod";
import { parseIdList } from "./ids";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(1),
  SYSTEMADMIN_EMAILS: z.string().default(""),
  TRAVIAN_SERVER_URL: z.string().url(),
  /** Eine oder mehrere Allianz-IDs, kommagetrennt (z. B. `36,7`). Alle gelten implizit als „Eigene Allianz“; weitere pflegt der Admin im UI. */
  TRAVIAN_ALLIANCE_ID: z.string().default(""),
  IMPORT_CRON: z.string().default("15 * * * *"),
  INACTIVE_DAYS: z.coerce.number().int().positive().default(3),
  /** Code, der zum Registrieren eines SYSTEMADMIN_EMAILS-Kontos nötig ist (Default: AUTH_SECRET). Verhindert, dass Fremde die Admin-Adresse vorab belegen. */
  SYSTEMADMIN_SETUP_CODE: z.preprocess(emptyToUndefined, z.string().min(8).optional()),
  /** Better-Auth-Rate-Limit für Sign-in/Sign-up pro Minute und IP (E2E erhöht es). */
  AUTH_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(5),
  /** SMTP für Passwort-Reset; ohne SMTP_HOST ist der Versand aus (die Seite /forgot zeigt dann einen Hinweis). */
  SMTP_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.preprocess((v) => v === "true" || v === "1", z.boolean()).default(false),
  SMTP_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PASS: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_FROM: z.string().default("Ally Tool <noreply@localhost>"),
  /** Travian veröffentlicht map.sql täglich zwischen 23:55 und 0:05 Serverzeit; der Worker holt sie kurz danach (+5 und +15 Min. als Nachversuch). */
  MAP_RELEASE_TIME: z.string().regex(/^\d{1,2}:\d{2}$/).default("00:05"),
  /** Zeitzone der Spielserver-Uhr (für Release-Zeit und Hinweise). */
  GAME_TIMEZONE: z.string().default("Europe/Berlin"),
  /** Schreibfenster der Ingame-Nachrichten ({server}, {id}, {name}); Standard siehe lib/igm.ts. */
  IGM_WRITE_URL: z.string().default("{server}/messages/write?to={id}"),
  STORAGE_DIR: z.string().default("./storage"),
  /** Speicherplatz je Nutzer für Screenshots + Chat-Dateien in MB (0 = unbegrenzt). */
  USER_QUOTA_MB: z.coerce.number().min(0).default(50),
  /** Screenshots in einem eigenen S3-Bucket (AWS, MinIO, Hetzner, Backblaze …). Ohne S3_BUCKET_SCREENSHOTS bleibt alles lokal. */
  S3_BUCKET_SCREENSHOTS: z.preprocess(emptyToUndefined, z.string().optional()),
  S3_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
  S3_REGION: z.string().default("us-east-1"),
  /** Nur für Entwicklung/E2E: Screenshots lokal statt in S3 erlauben. Im Produktivbetrieb ist S3 Pflicht. */
  ALLOW_LOCAL_SCREENSHOTS: z.preprocess((v) => v === "true" || v === "1", z.boolean()).default(false),
  S3_ACCESS_KEY_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  S3_SECRET_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  S3_FORCE_PATH_STYLE: z.preprocess((v) => v === "true" || v === "1", z.boolean()).default(false),
  UPLOAD_MAX_IMAGE_MB: z.coerce.number().positive().default(10),
  UPLOAD_MAX_FILE_MB: z.coerce.number().positive().default(20),
  UPLOAD_MAX_FILES: z.coerce.number().int().positive().default(10),
  /** Screenshots werden nach so vielen Tagen samt Datei gelöscht (außer als Lern-Beispiel genutzte). 0 = nie. */
  SCREENSHOT_RETENTION_DAYS: z.coerce.number().int().min(0).default(30),
  /** Spielversion der Welt (Spieldaten-Import nur für genau diese Version). */
  GAME_VERSION: z.string().min(2).default("legends"),
  /** Server-Geschwindigkeit; Standard: aus dem Host der TRAVIAN_SERVER_URL (x1, x2 …). */
  GAME_SPEED: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  /** Bilderkennung: Anzahl unabhängiger Lesedurchläufe je Screenshot (≥2 = Konsens-Prüfung, höhere Konfidenz, höhere Kosten). */
  VISION_PASSES: z.coerce.number().int().min(1).max(3).default(2),
  /** Ab dieser Konfidenz (und ohne Auffälligkeit) wird automatisch übernommen – sobald der Lernmodus für die Art abgeschlossen ist. */
  VISION_AUTO_ACCEPT: z.coerce.number().min(0).max(1).default(0.97),
  /** Lernmodus: so viele bestätigte Screenshots je Art, bevor automatisch übernommen wird (0 = Lernmodus aus). */
  VISION_LEARNING_MIN: z.coerce.number().int().min(0).default(10),
});

export type Env = Omit<z.infer<typeof schema>, "SYSTEMADMIN_EMAILS" | "TRAVIAN_ALLIANCE_ID"> & { SYSTEMADMIN_EMAILS: string[]; TRAVIAN_ALLIANCE_IDS: number[] };

export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = schema.parse(source);
  if (source.NODE_ENV === "production" && !parsed.ALLOW_LOCAL_SCREENSHOTS && !(parsed.S3_BUCKET_SCREENSHOTS && parsed.S3_ACCESS_KEY_ID && parsed.S3_SECRET_ACCESS_KEY)) {
    throw new Error("S3 ist im Produktivbetrieb Pflicht: S3_BUCKET_SCREENSHOTS, S3_ACCESS_KEY_ID und S3_SECRET_ACCESS_KEY in .env setzen (S3_ENDPOINT/S3_REGION nach Anbieter).");
  }
  return {
    ...parsed,
    TRAVIAN_ALLIANCE_IDS: parseIdList(parsed.TRAVIAN_ALLIANCE_ID),
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
