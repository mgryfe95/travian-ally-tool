import Link from "next/link";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n";
import { hasPermission, type Permission } from "@/lib/permissions";
import { loadMatrix } from "@/lib/services/context";
import { requirePermission } from "@/lib/session";
import { AlliancesTab } from "./tabs/alliances";
import { AuditTab } from "./tabs/audit";
import { ChannelsTab } from "./tabs/channels";
import { MembersTab } from "./tabs/members";
import { RightsTab } from "./tabs/rights";
import { UsersTab } from "./tabs/users";

export const dynamic = "force-dynamic";

const TABS: { id: string; label: MessageKey; perms: Permission[] }[] = [
  { id: "members", label: "admin.tab.members", perms: ["members.invite", "members.approve"] },
  { id: "rights", label: "admin.tab.rights", perms: ["permissions.edit"] },
  { id: "channels", label: "admin.tab.channels", perms: ["tags.manage", "settings.edit"] },
  { id: "alliances", label: "admin.tab.alliances", perms: ["alliances.classify"] },
  { id: "users", label: "admin.tab.users", perms: ["roles.assign"] },
  { id: "audit", label: "admin.tab.audit", perms: ["roles.assign", "permissions.edit"] },
];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; error?: string; q?: string }> }) {
  const { t } = await getT();
  const user = await requirePermission("members.invite", "members.approve", "roles.assign", "permissions.edit", "alliances.classify");
  const { tab, error, q } = await searchParams;
  const matrix = await loadMatrix(db);
  const allowed = TABS.filter((x) => x.perms.some((p) => hasPermission(user.role, p, matrix)));
  const current = allowed.find((x) => x.id === tab) ?? allowed[0];
  return (
    <>
      <header>
        <div className="sub">{t("admin.page.eyebrow")}</div>
        <h1>{t("admin.page.title")}</h1>
      </header>
      <div role="tablist" aria-label={t("admin.page.tabsLabel")} className="tabs">
        {allowed.map((x) => (
          <Link key={x.id} role="tab" aria-selected={x.id === current?.id} className={`tab ${x.id === current?.id ? "on" : ""}`} href={`/admin?tab=${x.id}`}>
            {t(x.label)}
          </Link>
        ))}
      </div>
      {error && <p className="errtext" role="alert">{error}</p>}
      {current?.id === "members" && <MembersTab actor={user} />}
      {current?.id === "rights" && <RightsTab actor={user} />}
      {current?.id === "channels" && <ChannelsTab actor={user} />}
      {current?.id === "alliances" && <AlliancesTab q={q} />}
      {current?.id === "users" && <UsersTab actor={user} />}
      {current?.id === "audit" && <AuditTab />}
    </>
  );
}
