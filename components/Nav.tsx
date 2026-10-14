import Link from "next/link";
import { LogoutButton } from "./AuthForms";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { loadMatrix } from "@/lib/services/context";
import { getCurrentUser } from "@/lib/session";

export async function Nav() {
  const user = await getCurrentUser();
  const matrix = user ? await loadMatrix(db) : undefined;
  const isStaff = user && matrix && (["members.invite", "members.approve", "roles.assign", "permissions.edit", "alliances.classify"] as const).some((p) => hasPermission(user.role, p, matrix));
  const links: [string, string][] = [["/", "Start"], ["/inactive", "Inaktive"], ["/events", "Ereignisse"]];
  if (user) links.push(["/account", "Mein Konto"]);
  if (isStaff) links.push(["/admin", "Admin"]);
  return (
    <nav className="flex items-center gap-4 border-b border-zinc-800 px-6 py-3 text-sm">
      {links.map(([href, label]) => (
        <Link key={href} href={href} className="text-zinc-300 hover:text-amber-400">{label}</Link>
      ))}
      <span className="ml-auto flex items-center gap-4 text-zinc-400">
        {user ? (<><span>{user.name} · {user.role}</span><LogoutButton /></>) : (<><Link href="/login" className="hover:text-amber-400">Anmelden</Link><Link href="/register" className="hover:text-amber-400">Registrieren</Link></>)}
      </span>
    </nav>
  );
}
