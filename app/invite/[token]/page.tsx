import { RegisterForm } from "@/components/AuthForms";
import { db } from "@/lib/db";
import { findOpenInvite } from "@/lib/services/verification";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await findOpenInvite(db, token);
  const player = invite ? await db.player.findUnique({ where: { id: invite.travianPlayerId } }) : null;
  if (!invite || !player) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Einladung ungültig</h1>
        <p className="mt-2 text-zinc-400">Der Link ist abgelaufen, wurde bereits verwendet oder widerrufen. Bitte frag einen Moderator nach einem neuen.</p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Einladung für {player.name}</h1>
      <p className="mt-1 text-sm text-zinc-400">Mit der Registrierung wird dein Konto automatisch mit dem Spieler „{player.name}“ verknüpft.</p>
      <RegisterForm inviteToken={token} defaultName={player.name} />
    </main>
  );
}
