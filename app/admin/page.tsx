import Link from "next/link";
import { type Permission } from "@/lib/permissions";
import { permissionsOf, requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const SECTIONS: { href: string; label: string; perms: Permission[] }[] = [
  { href: "/admin/members", label: "Mitglieder, Einladungen & Abgleich", perms: ["members.invite", "members.approve"] },
  { href: "/admin/alliances", label: "Allianzen & Allianz-Gruppe", perms: ["alliances.classify"] },
  { href: "/admin/users", label: "Nutzer & Rollen", perms: ["roles.assign"] },
  { href: "/admin/permissions", label: "Rechte-Matrix", perms: ["permissions.edit"] },
  { href: "/admin/audit", label: "Audit-Log", perms: ["roles.assign", "permissions.edit"] },
];

export default async function AdminHome() {
  const user = await requirePermission("members.invite", "members.approve", "roles.assign", "permissions.edit", "alliances.classify");
  const has = await permissionsOf(user.role, SECTIONS.flatMap((s) => s.perms));
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Administration</h1>
      <ul className="mt-4 space-y-2">
        {SECTIONS.filter((s) => s.perms.some((p) => has[p])).map((s) => (
          <li key={s.href}><Link className="text-amber-400 hover:underline" href={s.href}>{s.label}</Link></li>
        ))}
      </ul>
    </main>
  );
}
