"use client";

import { Suspense } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/client";

export type NavItem = {
  href: string;
  label: string;
  match?: string;
  sepBefore?: boolean;
  badge?: number;
  /** Untermenü (Sekundärlinks); klappt auf, sobald der Punkt selbst oder ein Kind aktiv ist. */
  children?: NavItem[];
  /** Zwischenüberschrift vor diesem Kind (z. B. „Task-Forces“ im Chat). */
  group?: string;
};

export type Loc = { path: string; sp: URLSearchParams };

/** Dynamischer Loader: kleiner Spinner am angeklickten Link, bis die Zielseite da ist. */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span className="spinner sm" aria-hidden="true" /> : null;
}

function pathOf(it: NavItem) {
  return (it.match ?? it.href).split("?")[0] as string;
}

/** Hauptpunkt: Pfad-Präfix ("/" nur exakt). */
function onPath(it: NavItem, { path }: Loc) {
  const base = pathOf(it);
  return base === "/" ? path === "/" : path === base || path.startsWith(base + "/");
}

/** Kind mit Query (`/chat?c=3`): Pfad exakt + alle Query-Werte gleich; ohne Query wie Hauptpunkt. */
function onChild(it: NavItem, loc: Loc) {
  const [, query] = it.href.split("?");
  if (!query) return onPath(it, loc);
  if (loc.path !== pathOf(it)) return false;
  return [...new URLSearchParams(query)].every(([k, v]) => loc.sp.get(k) === v);
}

/** Aktives Kind; ohne Treffer gilt das erste Kind auf demselben Pfad, dessen Query-Schlüssel alle fehlen (Standard-Tab/-Kanal). */
export function activeChild(kids: NavItem[], loc: Loc): NavItem | undefined {
  return kids.find((k) => onChild(k, loc)) ?? kids.find((k) => {
    const [base, query] = k.href.split("?");
    return !!query && base === loc.path && [...new URLSearchParams(query).keys()].every((key) => !loc.sp.has(key));
  });
}

/** Query-Parameter in eigener Suspense-Grenze lesen; sonst stört useSearchParams im Layout die Weiterleitung von Server-Actions. */
export function NavList({ items }: { items: NavItem[] }) {
  return (
    <Suspense fallback={<NavListInner items={items} sp={null} />}>
      <NavListWithQuery items={items} />
    </Suspense>
  );
}

function NavListWithQuery({ items }: { items: NavItem[] }) {
  return <NavListInner items={items} sp={useSearchParams()} />;
}

function NavListInner({ items, sp }: { items: NavItem[]; sp: URLSearchParams | ReadonlyURLSearchParams | null }) {
  const path = usePathname();
  const t = useT();
  const loc: Loc = { path, sp: new URLSearchParams(sp?.toString() ?? "") };
  return (
    <>
      {items.map((it) => {
        const kids = it.children ?? [];
        const kid = activeChild(kids, loc);
        const open = kids.length > 0 && (onPath(it, loc) || !!kid);
        const on = onPath(it, loc) || !!kid;
        return (
          <div key={it.href + it.label} style={{ display: "contents" }}>
            {it.sepBefore && <div className="sep" />}
            <Link className={`nav ${on ? "on" : ""}`} href={it.href} aria-current={on && !kid ? "page" : undefined} aria-expanded={kids.length ? open : undefined}>
              {it.label}
              <Pending />
              {it.badge ? <span className="badge" aria-label={t("nav.unread", { n: it.badge })}>{it.badge}</span> : null}
            </Link>
            {open && (
              <div className="subnav" role="group" aria-label={it.label}>
                {kids.map((k) => (
                  <div key={k.href + k.label} style={{ display: "contents" }}>
                    {k.group && <div className="subnav-group">{k.group}</div>}
                    <Link className={`nav sub ${k === kid ? "on" : ""}`} href={k.href} aria-current={k === kid ? "page" : undefined}>
                      <span className="subnav-label">{k.label}</span>
                      <Pending />
                      {k.badge ? <span className="badge" aria-label={t("nav.unread", { n: k.badge })}>{k.badge}</span> : null}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function SideNav({ items }: { items: NavItem[] }) {
  return <NavList items={items} />;
}
