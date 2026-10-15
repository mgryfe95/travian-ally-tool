import { BulkInviteButton, InviteButton } from "@/components/InviteButton";
import { RoleSelect } from "@/components/AdminControls";
import type { MemberRow } from "@/lib/admin-members";
import { db } from "@/lib/db";
import { fmt } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n";
import { hasPermission, rank, STORED_ROLES, type Role } from "@/lib/permissions";
import { loadMatrix, type Actor } from "@/lib/services/context";
import { approveLinkAction, rejectLinkAction } from "../actions";
import { loadMemberRows } from "./data";

const VIA = { invite: "admin.members.viaInvite", village_rename: "admin.members.viaVillageRename", admin: "admin.members.viaAdmin" } as const;

function status(r: MemberRow, t: T) {
  if (r.state === "verified") return <span className="pill p-ok">{t(VIA[(r.via ?? "invite") as keyof typeof VIA])}</span>;
  if (r.state === "claim_pending") return <span className="pill p-wait">{t("admin.members.claimPending", { code: r.claimCode ?? "" })}</span>;
  if (r.state === "invite_open") return <span className="pill p-wait">{t(r.inviteDaysLeft === 1 ? "admin.members.inviteOpenOne" : "admin.members.inviteOpenOther", { n: r.inviteDaysLeft ?? 0 })}</span>;
  return <span className="pill p-none">{t("admin.members.notInvited")}</span>;
}

export async function MembersTab({ actor }: { actor: Actor }) {
  const { t, locale } = await getT();
  const matrix = await loadMatrix(db);
  const canInvite = hasPermission(actor.role, "members.invite", matrix);
  const canApprove = hasPermission(actor.role, "members.approve", matrix);
  const canRoles = hasPermission(actor.role, "roles.assign", matrix);
  const rows = await loadMemberRows(db);
  const assignable = STORED_ROLES.filter((r) => actor.role === "SYSTEMADMIN" || rank(r) < rank(actor.role)).reverse() as string[];
  const withAccount = rows.filter((r) => r.state === "verified").length;

  const orphans = await db.playerLink.findMany({
    where: { status: "verified", travianPlayerId: { notIn: rows.map((r) => r.player.id) } },
    include: { user: { select: { name: true } } },
  });
  const orphanNames = new Map((await db.player.findMany({ where: { id: { in: orphans.map((o) => o.travianPlayerId) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));

  return (
    <>
      <section className="card flush">
        <div className="row between" style={{ margin: 12 }}>
          <div>
            <h2>{t("admin.members.title")}</h2>
            <div className="sub">
              {t("admin.members.summary", { total: rows.length, withAccount, without: rows.length - withAccount })}
            </div>
          </div>
          {canInvite && <BulkInviteButton />}
        </div>
        {rows.length === 0 && <p className="sub" style={{ margin: 12 }}>{t("admin.members.noGroup")}</p>}
        <div className="scroll">
          <table style={{ minWidth: 860 }}>
            <thead><tr><th>{t("admin.members.colPlayer")}</th><th className="r">{t("admin.members.colPop")}</th><th>{t("admin.members.colAccount")}</th><th>{t("admin.members.colVerification")}</th><th>{t("admin.members.colRole")}</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => {
                return (
                  <tr key={r.key}>
                    <td style={{ fontWeight: 500 }}>{r.player.name}</td>
                    <td className="mono r">{fmt(r.player.population, locale)}</td>
                    <td style={{ color: "var(--text2)" }}>{r.user ? r.user.name : "—"}{r.extraAccounts > 0 && <span className="sub"> +{r.extraAccounts}</span>}</td>
                    <td>{status(r, t)}</td>
                    <td><RoleCell t={t} row={r} actor={actor} canRoles={canRoles} assignable={assignable} sysTarget={r.user?.locked === true} /></td>
                    <td className="r" style={{ whiteSpace: "nowrap" }}>
                      {canInvite && r.state === "none" && <InviteButton playerId={r.player.id} playerName={r.player.name} />}
                      {canInvite && r.state === "invite_open" && <InviteButton playerId={r.player.id} playerName={r.player.name} label={t("admin.members.newLink")} ghost />}
                      {canApprove && r.state === "claim_pending" && r.linkId && (
                        <span className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          <form action={approveLinkAction}><input type="hidden" name="linkId" value={r.linkId} /><button className="btn ghost sm">{t("admin.members.approve")}</button></form>
                          <form action={rejectLinkAction}><input type="hidden" name="linkId" value={r.linkId} /><button className="btn ghost sm">{t("admin.members.reject")}</button></form>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {orphans.length > 0 && (
        <section className="card warn">
          <h2 style={{ color: "var(--warn)" }}>{t("admin.members.orphansTitle")}</h2>
          <p className="sub" style={{ margin: "4px 0 8px" }}>{t("admin.members.orphansHint")}</p>
          <ul>{orphans.map((o) => <li key={o.id}>{o.user.name} → {orphanNames.get(o.travianPlayerId) ?? `#${o.travianPlayerId}`}</li>)}</ul>
        </section>
      )}
    </>
  );
}

async function RoleCell({ t, row, actor, canRoles, assignable, sysTarget }: { t: T; row: MemberRow; actor: Actor; canRoles: boolean; assignable: string[]; sysTarget: boolean }) {
  if (!row.user) return <span className="sub">—</span>;
  if (sysTarget)
    return (<><span style={{ color: "var(--link-h)", fontWeight: 600 }}>{t("admin.locked", { role: t("admin.role.ADMIN") })}</span><div className="sub" style={{ fontSize: 12 }}>{t("admin.members.notChangeable")}</div></>);
  const u = await db.user.findUnique({ where: { id: row.user.id }, select: { role: true } });
  const current = u?.role ?? "GUEST";
  const editable = canRoles && (actor.role === "SYSTEMADMIN" || rank(current as Role) < rank(actor.role));
  return editable ? <RoleSelect userId={row.user.id} current={current} options={assignable} tab="members" /> : <span>{t(`admin.role.${current as Role}`)}</span>;
}
