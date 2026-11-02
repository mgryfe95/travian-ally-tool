import { RegisterForm } from "@/components/AuthForms";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { findOpenInvite } from "@/lib/services/verification";
import { env } from "@/lib/env";
import { ownAllianceTag, serverLabel } from "@/lib/serverinfo";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t, locale } = await getT();
  const invite = await findOpenInvite(db, token);
  const player = invite ? await db.player.findUnique({ where: { id: invite.travianPlayerId } }) : null;
  if (!invite || !player) {
    return (
      <>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>{t("auth.invite.invalidTitle")}</h1>
        <p className="sub">{t("auth.invite.invalidBody")}</p>
      </>
    );
  }
  const tag = await ownAllianceTag(db);
  return (
    <>
      <h1 style={{ fontSize: 22, margin: "10px 0 6px" }}>{t("auth.invite.welcome", { name: player.name })}</h1>
      <p className="sub" style={{ margin: "0 0 16px" }}>
        {t("auth.invite.intro", { tag: tag || t("auth.invite.ourAlliance"), server: serverLabel(env().TRAVIAN_SERVER_URL).split(" · ")[0] ?? "", name: player.name })}
      </p>
      <RegisterForm inviteToken={token} />
      <p className="sub" style={{ fontSize: 12, marginTop: 12 }}>{t("auth.invite.privacy")}</p>
      <div className="sub" style={{ fontSize: 12, marginTop: 12 }}>{t("auth.invite.validUntil", { date: fmtDate(invite.expiresAt, locale, { dateStyle: "short" }) })}</div>
    </>
  );
}
