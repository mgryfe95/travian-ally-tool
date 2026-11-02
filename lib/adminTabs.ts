import type { MessageKey } from "@/lib/i18n";
import type { Permission } from "@/lib/permissions";

/** Reiter der Admin-Seite; die Seitenleiste zeigt sie als Untermenü von „Admin“. */
export const ADMIN_TABS: { id: string; label: MessageKey; perms: Permission[] }[] = [
  { id: "members", label: "admin.tab.members", perms: ["members.invite", "members.approve"] },
  { id: "rights", label: "admin.tab.rights", perms: ["permissions.edit"] },
  { id: "channels", label: "admin.tab.channels", perms: ["tags.manage", "settings.edit"] },
  { id: "alliances", label: "admin.tab.alliances", perms: ["alliances.classify"] },
  { id: "users", label: "admin.tab.users", perms: ["roles.assign"] },
  { id: "audit", label: "admin.tab.audit", perms: ["roles.assign", "permissions.edit"] },
  { id: "costs", label: "admin.tab.costs", perms: ["settings.edit"] },
];

/** Wer einen Admin-Bereich hat (sonst bleiben Schedule/Truppen eigene Menüpunkte). */
export const ADMIN_PERMS: Permission[] = ["members.invite", "members.approve", "roles.assign", "permissions.edit", "alliances.classify"];

export type AdminNavItem = { id: string; href: string; label: MessageKey };

/** Eine Liste für beide Menüs: Untermenü „Admin“ in der Seitenleiste und Reiter oben im Admin-Bereich (inkl. Schedule und Truppen). */
export function adminNav(can: (p: Permission) => boolean): AdminNavItem[] {
  return [
    ...ADMIN_TABS.filter((x) => x.perms.some(can)).map((x) => ({ id: x.id, href: `/admin?tab=${x.id}`, label: x.label })),
    ...(can("schedule.view") ? [{ id: "schedule", href: "/schedule", label: "nav.schedule" as MessageKey }] : []),
    ...(can("troops.view") ? [{ id: "troops", href: "/troops", label: "nav.troops" as MessageKey }] : []),
  ];
}
