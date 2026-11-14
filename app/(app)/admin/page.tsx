import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { ADMIN_TABS, adminNav } from "@/lib/adminTabs";
import { AdminTabs } from "@/components/AdminTabs";
import { hasPermission } from "@/lib/permissions";
import { loadMatrix } from "@/lib/services/context";
import { requirePermission } from "@/lib/session";
import { AlliancesTab } from "./tabs/alliances";
import { AuditTab } from "./tabs/audit";
import { CostsTab } from "./tabs/costs";
import { ChannelsTab } from "./tabs/channels";
import { MembersTab } from "./tabs/members";
import { RightsTab } from "./tabs/rights";
import { UsersTab } from "./tabs/users";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; error?: string; q?: string }> }) {
  const { t } = await getT();
  const user = await requirePermission("members.invite", "members.approve", "roles.assign", "permissions.edit", "alliances.classify");
  const { tab, error, q } = await searchParams;
  const matrix = await loadMatrix(db);
  const allowed = ADMIN_TABS.filter((x) => x.perms.some((p) => hasPermission(user.role, p, matrix)));
  const current = allowed.find((x) => x.id === tab) ?? allowed[0];
  return (
    <>
      <header>
        <div className="sub">{t("admin.page.eyebrow")}</div>
        <h1>{t("admin.page.title")}</h1>
      </header>
      <AdminTabs items={adminNav((p) => hasPermission(user.role, p, matrix))} current={current?.id} t={t} />
      {error && <p className="errtext" role="alert">{error}</p>}
      {current?.id === "members" && <MembersTab actor={user} />}
      {current?.id === "rights" && <RightsTab />}
      {current?.id === "channels" && <ChannelsTab actor={user} />}
      {current?.id === "alliances" && <AlliancesTab q={q} />}
      {current?.id === "users" && <UsersTab actor={user} />}
      {current?.id === "audit" && <AuditTab />}
      {current?.id === "costs" && <CostsTab />}
    </>
  );
}
