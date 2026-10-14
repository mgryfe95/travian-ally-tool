import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata = { title: "Travian Ally Tool" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased"><Nav />
        {children}
      </body>
    </html>
  );
}
