import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "Ally Tool" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- Root-Layout: gilt für alle Seiten */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
