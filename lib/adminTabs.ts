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
