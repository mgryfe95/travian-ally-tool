import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

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
  if (!mailEnabled()) throw new Error("SMTP ist nicht konfiguriert");
  await getTransport().sendMail({ from: env().SMTP_FROM, ...mail });
}

export const resetMail = (to: string, name: string, url: string): Mail => ({
  to,
  subject: "Ally Tool: Passwort zurücksetzen",
  text: `Hallo ${name},\n\nüber diesen Link kannst du ein neues Passwort setzen (eine Stunde gültig):\n\n${url}\n\nWenn du das nicht angefordert hast, ignoriere diese Nachricht.`,
});
