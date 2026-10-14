import { db } from "@/lib/db";
import { compareMembers, loadGroupPlayers, loadRelations, ownGroupIds } from "@/lib/alliance-group";
import { fmt } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { loadMatrix } from "@/lib/services/context";
import { requirePermission } from "@/lib/session";
import { InviteButton } from "@/components/InviteButton";
import { approveLinkAction, rejectLinkAction, revokeInviteAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function MembersAdmin({ searchParams }: { searchParams: Promise<{ error?: string; filter?: string }> }) {
  const user = await requirePermission("members.invite", "members.approve");
  const { error, filter } = await searchParams;
  const matrix = await loadMatrix(db);
  const canInvite = hasPermission(user.role, "members.invite", matrix);
  const canApprove = hasPermission(user.role, "members.approve", matrix);

  const relations = await loadRelations(db);
  const group = await loadGroupPlayers(db, relations);
  const links = await db.playerLink.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { id: "desc" } });
  const cmp = compareMembers(group, links.map((l) => ({ userId: l.userId, playerId: l.travianPlayerId, status: l.status as "pending" | "verified" | "rejected" })));
  const names = new Map((await db.player.findMany({ where: { id: { in: links.map((l) => l.travianPlayerId) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
  const openInvites = await db.invite.findMany({ where: { usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { id: "desc" } });
  const pending = links.filter((l) => l.status === "pending");
  const rows = cmp.members.filter((m) => (filter === "missing" ? m.userIds.length === 0 : true));
  const groupIds = ownGroupIds(relations);

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <h1 className="text-xl font-semibold">Mitglieder & Abgleich</h1>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {groupIds.size === 0 && <p className="text-sm text-amber-400">Keine Allianz als „Eigene Allianz“/„Allianz“ markiert – siehe Admin → Allianzen.</p>}

      <section>
        <h2 className="font-medium">Abgleich: Mitglieder im System vs. Mitglieder unserer Allianz-Gruppe</h2>
        <p className="mt-1 text-sm text-zinc-300">
          {cmp.summary.groupPlayers} Spieler in der Gruppe · <b>{cmp.summary.withAccount}</b> mit verifiziertem Konto · <b>{cmp.summary.withoutAccount}</b> ohne Konto
          · {cmp.summary.orphanLinks} verifizierte Konten außerhalb der Gruppe
        </p>
        <p className="mt-1 text-sm"><a className="text-amber-400" href={filter === "missing" ? "?" : "?filter=missing"}>{filter === "missing" ? "Alle zeigen" : "Nur ohne Konto zeigen"}</a></p>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-zinc-400"><tr><th>Spieler</th><th>Allianz-ID</th><th className="text-right">Bev.</th><th>Konto</th><th></th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-zinc-800 align-top">
                <td className="py-1">{m.name}</td>
                <td>{m.allianceId}</td>
                <td className="text-right tabular-nums">{fmt(m.population)}</td>
                <td>{m.userIds.length ? `✔ ${m.userIds.length}` : m.pendingUserIds.length ? "ausstehend" : "–"}</td>
                <td>{canInvite && m.userIds.length === 0 && <InviteButton playerId={m.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {cmp.orphanLinks.length > 0 && (
        <section>
          <h2 className="font-medium text-amber-400">Konten, deren Spieler die Gruppe verlassen hat (nur Markierung, keine Sperre)</h2>
          <ul className="mt-2 text-sm">
            {cmp.orphanLinks.map((l) => (
              <li key={`${l.userId}-${l.playerId}`} className="border-t border-zinc-800 py-1">{links.find((x) => x.userId === l.userId)?.user.name} → {names.get(l.playerId) ?? `#${l.playerId}`}</li>
            ))}
          </ul>
        </section>
      )}

      {canApprove && (
        <section>
          <h2 className="font-medium">Ausstehende Verifizierungen ({pending.length})</h2>
          <ul className="mt-2 text-sm">
            {pending.map((l) => (
              <li key={l.id} className="flex items-center gap-3 border-t border-zinc-800 py-1">
                <span>{l.user.name} ({l.user.email}) → {names.get(l.travianPlayerId) ?? `#${l.travianPlayerId}`} · {l.claimCode}</span>
                <form action={approveLinkAction}><input type="hidden" name="linkId" value={l.id} /><button className="rounded border border-zinc-700 px-2 text-xs hover:border-amber-400">Bestätigen</button></form>
                <form action={rejectLinkAction}><input type="hidden" name="linkId" value={l.id} /><button className="rounded border border-zinc-700 px-2 text-xs hover:border-red-400">Ablehnen</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canInvite && (
        <section>
          <h2 className="font-medium">Offene Einladungen ({openInvites.length})</h2>
          <ul className="mt-2 text-sm">
            {openInvites.map((i) => (
              <li key={i.id} className="flex items-center gap-3 border-t border-zinc-800 py-1">
                <span>{names.get(i.travianPlayerId) ?? group.find((g) => g.id === i.travianPlayerId)?.name ?? `#${i.travianPlayerId}`} · gültig bis {i.expiresAt.toISOString().slice(0, 10)}</span>
                <form action={revokeInviteAction}><input type="hidden" name="inviteId" value={i.id} /><button className="rounded border border-zinc-700 px-2 text-xs hover:border-red-400">Widerrufen</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
