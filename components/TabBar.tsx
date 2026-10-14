"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [["/", "Übersicht"], ["/villages", "Dörfer"], ["/inactive", "Inaktive"], ["/chat", "Chat"]] as const;

/** Untere Navigationsleiste für Mobile (die Sidebar ist dort ausgeblendet). */
export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Hauptnavigation (mobil)">
      {ITEMS.map(([href, label]) => {
        const on = href === "/" ? path === "/" : path.startsWith(href);
        return <Link key={href} href={href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>{label}</Link>;
      })}
    </nav>
  );
}
