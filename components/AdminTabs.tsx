import Link from "next/link";
import type { AdminNavItem } from "@/lib/adminTabs";
import type { T } from "@/lib/i18n";

/** Reiter oben im Admin-Bereich – dieselben Einträge wie das Untermenü „Admin“ in der Seitenleiste (`adminNav`). */
export function AdminTabs({ items, current, t }: { items: AdminNavItem[]; current: string | undefined; t: T }) {
  return (
    <div role="tablist" aria-label={t("admin.page.tabsLabel")} className="tabs">
      {items.map((x) => (
        <Link key={x.id} role="tab" aria-selected={x.id === current} className={`tab ${x.id === current ? "on" : ""}`} href={x.href}>
          {t(x.label)}
        </Link>
      ))}
    </div>
  );
}
