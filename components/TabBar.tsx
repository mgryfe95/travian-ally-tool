"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

const ITEMS: readonly (readonly [string, MessageKey])[] = [["/", "nav.overview"], ["/villages", "nav.villages"], ["/inactive", "nav.inactive"], ["/chat", "nav.chat"]];

/** Untere Navigationsleiste für Mobile (die Sidebar ist dort ausgeblendet). */
export function TabBar() {
  const path = usePathname();
  const t = useT();
  return (
    <nav className="tabbar" aria-label={t("nav.mainMobile")}>
      {ITEMS.map(([href, label]) => {
        const on = href === "/" ? path === "/" : path.startsWith(href);
        return <Link key={href} href={href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>{t(label)}</Link>;
      })}
    </nav>
  );
}
