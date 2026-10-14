"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; match?: string; sepBefore?: boolean };

export function SideNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <>
      {items.map((it) => {
        const base = (it.match ?? it.href).split("?")[0] as string;
        const on = base === "/" ? path === "/" : path === base || path.startsWith(base + "/");
        return (
          <div key={it.href + it.label} style={{ display: "contents" }}>
            {it.sepBefore && <div className="sep" />}
            <Link className={`nav ${on ? "on" : ""}`} href={it.href} aria-current={on ? "page" : undefined}>
              {it.label}
            </Link>
          </div>
        );
      })}
    </>
  );
}
