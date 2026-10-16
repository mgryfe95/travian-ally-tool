"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/AuthForms";
import { LanguageSelect } from "@/components/LanguageSelect";
import { LogoMark } from "@/components/Logo";
import type { NavItem } from "@/components/SideNav";
import { useT } from "@/lib/i18n/client";

/** Mobile Kopfzeile: Burger-Menü (Hauptnavigation, standardmäßig zu) links, Profil-Menü (Konto, Sprache, Abmelden) rechts. */
export function MobileNav({ items, name, role }: { items: NavItem[]; name: string; role: string }) {
  const t = useT();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  useEffect(() => {
    setMenu(false);
    setProfile(false);
  }, [path]);
  return (
    <header className="mobilehead">
      <button type="button" className="iconbtn" aria-label={t("nav.menu")} aria-expanded={menu} aria-controls="mobile-menu" onClick={() => { setMenu((v) => !v); setProfile(false); }}>
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      <Link href="/" className="logo" style={{ padding: 0 }}><LogoMark size={40} />Humans</Link>
      <button type="button" className="avatarbtn" aria-label={t("nav.account")} aria-expanded={profile} aria-controls="profile-menu" onClick={() => { setProfile((v) => !v); setMenu(false); }}>
        {name[0]?.toUpperCase() ?? "?"}
      </button>
      {menu && (
        <nav id="mobile-menu" className="dropdown menu" aria-label={t("nav.mainMobile")}>
          {items.map((it) => {
            const base = (it.match ?? it.href).split("?")[0] as string;
            const on = base === "/" ? path === "/" : path === base || path.startsWith(base + "/");
            return (
              <Link key={it.href + it.label} href={it.href} className={`nav ${on ? "on" : ""}`} aria-current={on ? "page" : undefined}>
                {it.label}
                {it.badge ? <span className="badge">{it.badge}</span> : null}
              </Link>
            );
          })}
        </nav>
      )}
      {profile && (
        <div id="profile-menu" className="dropdown profile">
          <div style={{ padding: "6px 12px" }}><div style={{ fontWeight: 700 }}>{name}</div><div className="sub">{role}</div></div>
          <div className="sep" />
          <Link href="/files" className="nav">{t("nav.myFiles")}</Link>
          <div style={{ padding: "6px 12px" }}><LanguageSelect /></div>
          <div className="sep" />
          <div style={{ padding: "6px 12px" }}><LogoutButton /></div>
        </div>
      )}
    </header>
  );
}
