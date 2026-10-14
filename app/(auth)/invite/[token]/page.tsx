import { RegisterForm } from "@/components/AuthForms";
import { db } from "@/lib/db";
import { findOpenInvite } from "@/lib/services/verification";
import { env } from "@/lib/env";
import { ownAllianceTag, serverLabel } from "@/lib/serverinfo";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await findOpenInvite(db, token);
  const player = invite ? await db.player.findUnique({ where: { id: invite.travianPlayerId } }) : null;
  if (!invite || !player) {
    return (
      <>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>Einladung ungültig</h1>
        <p className="sub">Der Link ist abgelaufen, wurde bereits verwendet oder widerrufen. Bitte einen Admin um einen neuen Link bitten.</p>
      </>
    );
  }
  const tag = await ownAllianceTag(db);
  return (
    <>
      <h1 style={{ fontSize: 22, margin: "10px 0 6px" }}>Willkommen, {player.name}</h1>
      <p className="sub" style={{ margin: "0 0 16px" }}>
        Du wurdest in die Allianz <b style={{ color: "var(--text)" }}>{tag || "unserer Allianz"}</b> auf {serverLabel(env().TRAVIAN_SERVER_URL).split(" · ")[0]} eingeladen.
        Dein Account wird automatisch mit dem Travian-Spieler <b style={{ color: "var(--text)" }}>{player.name}</b> verknüpft.
      </p>
      <RegisterForm inviteToken={token} />
      <div className="sub" style={{ fontSize: 12, marginTop: 12 }}>Link gültig bis {invite.expiresAt.toLocaleDateString("de-DE")} · nur einmal verwendbar</div>
    </>
  );
}
