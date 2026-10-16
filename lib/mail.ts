import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";
import { DEFAULT_LOCALE, isLocale, translate } from "./i18n";
import { AppError } from "./i18n/errors";

export type Mail = { to: string; subject: string; text: string };

let transport: Transporter | undefined;
let override: Transporter | undefined;

/** Nur für Tests: eigenen Transport (z. B. jsonTransport) setzen. */
export const setMailTransport = (t: Transporter | undefined) => {
  override = t;
};

export const mailEnabled = () => !!override || !!env().SMTP_HOST;

function getTransport(): Transporter {
  if (override) return override;
  const c = env();
  return (transport ??= nodemailer.createTransport({
    host: c.SMTP_HOST, port: c.SMTP_PORT, secure: c.SMTP_SECURE, auth: c.SMTP_USER ? { user: c.SMTP_USER, pass: c.SMTP_PASS } : undefined,
  }));
}

export async function sendMail(mail: Mail): Promise<void> {
  if (!mailEnabled()) throw new AppError("err.mail.smtp");
  await getTransport().sendMail({ from: env().SMTP_FROM, ...mail });
}

/** Sprache der Mail = Sprache des Empfängers (`user.locale`), sonst Englisch. */
export const resetMail = (to: string, name: string, url: string, locale?: string | null): Mail => {
  const l = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return { to, subject: translate(l, "err.mail.resetSubject"), text: translate(l, "err.mail.resetBody", { name, url }) };
};
