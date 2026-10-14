import Link from "next/link";
import { db } from "@/lib/db";
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

const TABS: { id: string; label: string; perms: Permission[] }[] = [
  { id: "members", label: "Mitglieder & Einladungen", perms: ["members.invite", "members.approve"] },
  { id: "rights", label: "Rechte", perms: ["permissions.edit"] },
  { id: "channels", label: "Kanäle & Tags", perms: ["tags.manage", "settings.edit"] },
  { id: "alliances", label: "Allianzen", perms: ["alliances.classify"] },
  { id: "users", label: "Konten", perms: ["roles.assign"] },
  { id: "audit", label: "Audit-Log", perms: ["roles.assign", "permissions.edit"] },
];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; error?: string; q?: string }> }) {
  const user = await requirePermission("members.invite", "members.approve", "roles.assign", "permissions.edit", "alliances.classify");
  const { tab, error, q } = await searchParams;
  const matrix = await loadMatrix(db);
  const allowed = TABS.filter((t) => t.perms.some((p) => hasPermission(user.role, p, matrix)));
  const current = allowed.find((t) => t.id === tab) ?? allowed[0];
  return (
    <>
      <header>
        <div className="sub">Verwaltung</div>
        <h1>Admin</h1>
      </header>
      <div role="tablist" aria-label="Bereiche" className="tabs">
        {allowed.map((t) => (
          <Link key={t.id} role="tab" aria-selected={t.id === current?.id} className={`tab ${t.id === current?.id ? "on" : ""}`} href={`/admin?tab=${t.id}`}>
            {t.label}
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
