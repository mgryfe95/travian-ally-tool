import { LogoMark } from "@/components/Logo";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { MessageKey } from "@/lib/i18n";
import { LogoutButton } from "@/components/AuthForms";
import { LanguageSelect } from "@/components/LanguageSelect";
import { SideNav, type NavItem } from "@/components/SideNav";
import { MobileNav } from "@/components/MobileNav";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fmtDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { hasPermission, type Permission } from "@/lib/permissions";
import { serverLabel, ownAllianceTag } from "@/lib/serverinfo";
import { loadMatrix } from "@/lib/services/context";
import { unreadCounts } from "@/lib/services/messenger";
import { getWorldStatus } from "@/lib/services/world";
import { requireUser } from "@/lib/session";

const ROLE_LABEL: Record<string, MessageKey> = { SYSTEMADMIN: "common.role.admin", ADMIN: "common.role.admin", MODERATOR: "common.role.moderator", MEMBER: "common.role.member", GUEST: "common.role.guest" };
const ADMIN_PERMS: Permission[] = ["members.invite", "members.approve", "roles.assign", "permissions.edit", "alliances.classify"];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  if (user.role === "GUEST") redirect("/claim"); // unverifizierte Konten sehen nur die Verifizierungsseite
  const { t, locale } = await getT();
  const matrix = await loadMatrix(db);
  const can = (p: Permission) => hasPermission(user.role, p, matrix);
  const items: NavItem[] = [
    { href: "/", label: t("nav.overview") },
    { href: "/villages", label: t("nav.myVillages") },
    { href: "/inactive", label: t("nav.inactive") },
    { href: "/chat", label: t("nav.chat") },
    { href: "/chat?tf=1", label: t("nav.taskForces"), match: "/taskforces" },
  ];
  if (can("messenger.use")) items.push({ href: "/messages", label: t("nav.messages"), badge: (await unreadCounts(db, user.id)).total });
  if (can("schedule.view")) items.push({ href: "/schedule", label: t("nav.schedule") });
  if (can("troops.view")) items.push({ href: "/troops", label: t("nav.troops") });
  items.push({ href: "/screenshots", label: t("nav.screenshots") });
  if (ADMIN_PERMS.some(can)) items.push({ href: "/admin", label: t("nav.admin"), sepBefore: true });
  items.push({ href: "/gamedata", label: t("nav.gameData"), sepBefore: !ADMIN_PERMS.some(can) });
  const tag = await ownAllianceTag(db);
  const world = await getWorldStatus(db);
  return (
    <div className="shell">
      <MobileNav items={items} name={user.name} role={ROLE_LABEL[user.role] ? t(ROLE_LABEL[user.role]!) : user.role} />
      <nav className="side" aria-label={t("nav.main")}>
        <div className="logo"><LogoMark size={64} />Humans</div>
        <div className="srv">{[serverLabel(env().TRAVIAN_SERVER_URL), tag].filter(Boolean).join(" · ")}</div>
        <SideNav items={items} />
        <div className="me">
          <div style={{ fontWeight: 600 }}>{user.name}</div>
          <div className="sub">{ROLE_LABEL[user.role] ? t(ROLE_LABEL[user.role]!) : user.role}</div>
          <div style={{ marginTop: 6, fontSize: 12 }}>
            <a href="/files" style={{ display: "block", marginBottom: 4 }}>{t("nav.myFiles")}</a>
            <LogoutButton />
          </div>
          <div style={{ marginTop: 8 }}><LanguageSelect /></div>
        </div>
      </nav>
      <main className="main">
        {world.status === "ended" && (
          <section className="card warn" role="status">
            <strong style={{ color: "var(--warn)" }}>{t("nav.worldEnded")}</strong>{" "}
            <span className="sub">{t("nav.worldEndedBody", { date: world.lastSuccessAt ? fmtDate(world.lastSuccessAt, locale, { dateStyle: "short" }) : t("nav.worldEndedUnknown") })}</span>
          </section>
        )}
        {children}
      </main>
    </div>
  );
}
