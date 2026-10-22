import { BulkInviteButton, InviteButton } from "@/components/InviteButton";
import { PlayerRoleSelect, RoleSelect } from "@/components/AdminControls";
import { SortTable } from "@/components/SortTable";
import { fmtDate } from "@/lib/format";
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
  const assignable = STORED_ROLES.filter((r) => actor.role === "ADMIN" || rank(r) < rank(actor.role)).reverse() as string[];
  const withAccount = rows.filter((r) => r.state === "verified").length;
  const ids = rows.map((r) => r.player.id);
  const [alliances, invites, planned] = await Promise.all([
    db.alliance.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.player.allianceId))] } }, select: { id: true, name: true } }),
    db.invite.findMany({ where: { travianPlayerId: { in: ids } }, orderBy: { createdAt: "desc" }, select: { travianPlayerId: true, createdAt: true } }),
    db.playerRole.findMany({ where: { travianPlayerId: { in: ids } } }),
  ]);
  const allianceOf = new Map(alliances.map((a) => [a.id, a.name]));
  const invitedAt = new Map<number, Date>();
  for (const i of invites) if (!invitedAt.has(i.travianPlayerId)) invitedAt.set(i.travianPlayerId, i.createdAt);
  const plannedOf = new Map(planned.map((p) => [p.travianPlayerId, p.role]));
  const STATE_ORDER = { verified: 0, claim_pending: 1, invite_open: 2, none: 3 } as const;

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
          <SortTable minWidth={1040} initial={{ col: 2, dir: -1 }}
            cols={[{ label: t("admin.members.colPlayer") }, { label: t("admin.members.colAlliance") }, { label: t("admin.members.colPop"), align: "r" }, { label: t("admin.members.colAccount") }, { label: t("admin.members.colVerification") }, { label: t("admin.members.colInvited") }, { label: t("admin.members.colRole") }, { label: "", sortable: false }]}
            rows={rows.map((r) => {
              const inv = invitedAt.get(r.player.id);
              const role = r.state === "verified" ? undefined : plannedOf.get(r.player.id);
              return {
                key: r.key,
                sort: [r.player.name.toLowerCase(), allianceOf.get(r.player.allianceId) ?? "", r.player.population, r.user?.name.toLowerCase() ?? null, STATE_ORDER[r.state], inv ? inv.getTime() : null, role ?? (r.state === "verified" ? "~" : null), null],
                cells: [
                  <span key="p" style={{ fontWeight: 500 }}>{r.player.name}</span>,
                  <span key="a" className="sub">{allianceOf.get(r.player.allianceId) ?? "–"}</span>,
                  <span key="n" className="mono">{fmt(r.player.population, locale)}</span>,
                  <span key="u" style={{ color: "var(--text2)" }}>{r.user ? r.user.name : "—"}{r.extraAccounts > 0 && <span className="sub"> +{r.extraAccounts}</span>}</span>,
                  <span key="s">{status(r, t)}</span>,
                  <span key="i" className="sub mono">{inv ? fmtDate(inv, locale, { day: "2-digit", month: "2-digit", year: "2-digit" }) : "–"}</span>,
                  <RoleCell key="r" t={t} row={r} actor={actor} canRoles={canRoles} assignable={assignable} emergency={r.user?.locked === true} planned={plannedOf.get(r.player.id) ?? ""} />,
                  <span key="x" style={{ whiteSpace: "nowrap", display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                    {canInvite && r.state === "none" && <InviteButton playerId={r.player.id} playerName={r.player.name} />}
                    {canInvite && r.state === "invite_open" && <InviteButton playerId={r.player.id} playerName={r.player.name} label={t("admin.members.newLink")} ghost />}
                    {canApprove && r.state === "claim_pending" && r.linkId && (
                      <>
                        <form action={approveLinkAction}><input type="hidden" name="linkId" value={r.linkId} /><button className="btn ghost sm">{t("admin.members.approve")}</button></form>
                        <form action={rejectLinkAction}><input type="hidden" name="linkId" value={r.linkId} /><button className="btn ghost sm">{t("admin.members.reject")}</button></form>
                      </>
                    )}
                  </span>,
                ],
              };
            })} />
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

async function RoleCell({ t, row, actor, canRoles, assignable, emergency, planned }: { t: T; row: MemberRow; actor: Actor; canRoles: boolean; assignable: string[]; emergency: boolean; planned: string }) {
  // Ohne verifiziertes Konto: Rolle vorab je Spieler (wird bei der Verifizierung übernommen)
  if (row.state !== "verified") {
    const editable = canRoles && (actor.role === "ADMIN" || !planned || rank(planned as Role) < rank(actor.role));
    return editable ? <PlayerRoleSelect playerId={row.player.id} current={planned} options={assignable} /> : <span className="sub">{planned ? t(`admin.role.${planned as Role}`) : t("admin.members.roleAuto")}</span>;
  }
  if (!row.user) return <span className="sub">—</span>;
  if (emergency) return <span>{t("admin.role.ADMIN")}</span>; // Admin per Server-Konfiguration: Rolle wird dort bestimmt
  const u = await db.user.findUnique({ where: { id: row.user.id }, select: { role: true } });
  const current = u?.role ?? "GUEST";
  const editable = canRoles && (actor.role === "ADMIN" || rank(current as Role) < rank(actor.role));
  return editable ? <RoleSelect userId={row.user.id} current={current} options={assignable} tab="members" /> : <span>{t(`admin.role.${current as Role}`)}</span>;
}
