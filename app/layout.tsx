import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/client";
import { messagesFor } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import "./globals.css";

export const metadata = { title: "Ally Tool" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale} messages={messagesFor(locale)}>{children}</I18nProvider>
      </body>
    </html>
  );
}
