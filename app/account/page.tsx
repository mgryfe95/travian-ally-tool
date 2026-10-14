import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { startClaimAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { pending: "ausstehend", verified: "verifiziert", rejected: "abgelehnt" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const { error } = await searchParams;
  const links = await db.playerLink.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } });
  const players = new Map((await db.player.findMany({ where: { id: { in: links.map((l) => l.travianPlayerId) } } })).map((p) => [p.id, p]));
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">Mein Konto</h1>
      <p className="text-sm text-zinc-400">{user.name} · {user.email} · Rolle {user.role}</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <section>
        <h2 className="mb-2 font-medium">Verknüpfte Spieler</h2>
        {links.length === 0 && <p className="text-sm text-zinc-500">Noch keine. Beanspruche unten deinen Spieler.</p>}
        <ul className="space-y-2 text-sm">
          {links.map((l) => (
            <li key={l.id} className="rounded border border-zinc-800 p-2">
              <b>{players.get(l.travianPlayerId)?.name ?? `#${l.travianPlayerId}`}</b> · {STATUS[l.status] ?? l.status}
              {l.status === "pending" && l.method === "village_rename" && l.claimCode && (
                <p className="mt-1 text-zinc-300">
                  Benenne in Travian eines deiner Dörfer so um, dass der Name <code className="rounded bg-zinc-800 px-1 text-amber-400">{l.claimCode}</code> enthalten ist.
                  Nach dem nächsten Kartenimport wirst du automatisch verifiziert (oder ein Moderator bestätigt manuell). Danach darfst du das Dorf zurückbenennen.
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-medium">Spieler beanspruchen</h2>
        <form action={startClaimAction} className="flex gap-2 text-sm">
          <input name="playerName" required placeholder="Travian-Spielername" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1" />
          <button className="rounded bg-amber-500 px-3 py-1 font-medium text-zinc-950">Code erzeugen</button>
        </form>
        <p className="mt-1 text-xs text-zinc-500">Möglich nur für Spieler der eigenen Allianz-Gruppe.</p>
      </section>
    </main>
  );
}
