import Link from "next/link";
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
import { ADMIN_TABS } from "@/lib/adminTabs";
import { chatCtx, listChannels } from "@/lib/services/chat";
import { loadMatrix } from "@/lib/services/context";
import { unreadCounts } from "@/lib/services/messenger";
import { ownVillages } from "@/lib/services/villages";
import { getWorldStatus } from "@/lib/services/world";
import { requireUser } from "@/lib/session";

const ROLE_LABEL: Record<string, MessageKey> = { ADMIN: "common.role.admin", MODERATOR: "common.role.moderator", MEMBER: "common.role.member", GUEST: "common.role.guest" };
const ADMIN_PERMS: Permission[] = ["members.invite", "members.approve", "roles.assign", "permissions.edit", "alliances.classify"];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  if (user.role === "UNVERIFIED") redirect("/claim"); // unverifizierte Konten sehen nur die Verifizierungsseite
  const { t, locale } = await getT();
  const matrix = await loadMatrix(db);
  const can = (p: Permission) => hasPermission(user.role, p, matrix);
  const isAdmin = ADMIN_PERMS.some(can);
  const villages = await ownVillages(db, user.id);
  const channels = can("chat.read") ? await listChannels(db, await chatCtx(db, user)) : [];
  const chan = (c: (typeof channels)[number]): NavItem => ({ href: `/chat?c=${c.id}`, label: c.tree === "TASKFORCE" ? c.name : `# ${c.name}`, badge: c.unread });
  const ally = channels.filter((c) => c.tree !== "TASKFORCE").map(chan);
  const tfs = channels.filter((c) => c.tree === "TASKFORCE").map(chan);
  if (tfs[0]) tfs[0] = { ...tfs[0], group: t("nav.taskForces") };
  const extras: NavItem[] = [];
  if (can("schedule.view")) extras.push({ href: "/schedule", label: t("nav.schedule") });
  if (can("troops.view")) extras.push({ href: "/troops", label: t("nav.troops") });

  const items: NavItem[] = [
    { href: "/", label: t("nav.overview"), children: villages.map((v) => ({ href: `/villages/${v.id}`, label: v.name })) },
    { href: "/inactive", label: t("nav.inactive") },
    { href: "/chat", label: t("nav.chats"), children: channels.length ? [{ href: "/chat?c=all", label: t("chat.aside.all") }, ...ally, ...tfs] : undefined },
  ];
  if (can("messenger.use")) items.push({ href: "/messages", label: t("nav.messages"), badge: (await unreadCounts(db, user.id)).total });
  if (!isAdmin) items.push(...extras); // ohne Admin-Bereich bleiben Schedule/Truppen Hauptpunkte
  items.push({ href: "/screenshots", label: t("nav.screenshots") });
  if (isAdmin) {
    const tabs = ADMIN_TABS.filter((x) => x.perms.some(can)).map((x) => ({ href: `/admin?tab=${x.id}`, label: t(x.label) }));
    items.push({ href: "/admin", label: t("nav.admin"), sepBefore: true, children: [...tabs, ...extras] });
  }
  items.push({ href: "/gamedata", label: t("nav.gameData"), sepBefore: !isAdmin });
  const tag = await ownAllianceTag(db);
  const world = await getWorldStatus(db);
  return (
    <div className="shell">
      <MobileNav items={items} name={user.name} role={ROLE_LABEL[user.role] ? t(ROLE_LABEL[user.role]!) : user.role} />
      <nav className="side" aria-label={t("nav.main")}>
        <Link className="logo" href="/" aria-label="Humans"><LogoMark size={150} /></Link>
        <div className="srv">{[serverLabel(env().TRAVIAN_SERVER_URL), tag].filter(Boolean).join(" · ")}</div>
        <SideNav items={items} />
        <div className="me">
          <div style={{ fontWeight: 600 }}>{user.name}</div>
          <div className="sub">{ROLE_LABEL[user.role] ? t(ROLE_LABEL[user.role]!) : user.role}</div>
          <div style={{ marginTop: 6, fontSize: 12 }}>
            <a href="/mentions" style={{ display: "block", marginBottom: 4 }}>{t("chat.mentions.link")}</a>
            <a href="/files" style={{ display: "block", marginBottom: 4 }}>{t("nav.myFiles")}</a>
            <a href="/privacy" style={{ display: "block", marginBottom: 4 }}>{t("privacy.link")}</a>
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
