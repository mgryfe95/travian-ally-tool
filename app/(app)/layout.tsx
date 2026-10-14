import type { ReactNode } from "react";
import { LogoutButton } from "@/components/AuthForms";
import { SideNav, type NavItem } from "@/components/SideNav";
import { TabBar } from "@/components/TabBar";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hasPermission, type Permission } from "@/lib/permissions";
import { serverLabel, ownAllianceTag } from "@/lib/serverinfo";
import { loadMatrix } from "@/lib/services/context";
import { getWorldStatus } from "@/lib/services/world";
import { requireUser } from "@/lib/session";

const ROLE_LABEL: Record<string, string> = { SYSTEMADMIN: "Systemadmin", ADMIN: "Admin", MODERATOR: "Moderator", MEMBER: "Member", GUEST: "Gast" };
const ADMIN_PERMS: Permission[] = ["members.invite", "members.approve", "roles.assign", "permissions.edit", "alliances.classify"];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const matrix = await loadMatrix(db);
  const can = (p: Permission) => hasPermission(user.role, p, matrix);
  const items: NavItem[] = [
    { href: "/", label: "Übersicht" },
    { href: "/villages", label: "Meine Dörfer" },
    { href: "/inactive", label: "Inaktive" },
    { href: "/chat", label: "Chat" },
    { href: "/chat?tf=1", label: "Task-Forces", match: "/taskforces" },
  ];
  if (ADMIN_PERMS.some(can)) items.push({ href: "/admin", label: "Admin", sepBefore: true });
  items.push({ href: "/gamedata", label: "Spieldaten", sepBefore: !ADMIN_PERMS.some(can) });
  const tag = await ownAllianceTag(db);
  const world = await getWorldStatus(db);
  return (
    <div className="shell">
      <nav className="side" aria-label="Hauptnavigation">
        <div className="logo">Ally Tool</div>
        <div className="srv">{[serverLabel(env().TRAVIAN_SERVER_URL), tag].filter(Boolean).join(" · ")}</div>
        <SideNav items={items} />
        <div className="me">
          <div style={{ fontWeight: 600 }}>{user.name}</div>
          <div className="sub">{ROLE_LABEL[user.role] ?? user.role}</div>
          <div style={{ marginTop: 6, fontSize: 12 }}>
            <LogoutButton />
          </div>
        </div>
      </nav>
      <main className="main">
        {world.status === "ended" && (
          <section className="card warn" role="status">
            <strong style={{ color: "var(--warn)" }}>Die Spielwelt scheint beendet.</strong>{" "}
            <span className="sub">Die Kartendaten sind seit {world.lastSuccessAt ? world.lastSuccessAt.toLocaleDateString("de-DE") : "längerem"} nicht mehr abrufbar. Der Stand bleibt als Archiv sichtbar, der Chat funktioniert weiter. Ein Admin kann eine neue Welt starten (docs/DEPLOY.md).</span>
          </section>
        )}
        {children}
      </main>
      <TabBar />
    </div>
  );
}
