"use client";

import { useActionState } from "react";
import { useT } from "@/lib/i18n/client";
import { createBulkInvitesAction, createInviteAction, type InviteState } from "@/app/(app)/admin/actions";

const copy = (text: string) => navigator.clipboard?.writeText(text);

function Texts({ items }: { items: { player: string; message: string }[] }) {
  const t = useT();
  return (
    <div className="card" style={{ marginTop: 8, textAlign: "left", minWidth: 320 }}>
      <p className="sub" style={{ color: "var(--warn)" }}>{t("admin.invite.visibleOnce")}</p>
      {items.map((i) => (
        <div key={i.player} style={{ marginTop: 10 }}>
          <div className="row between"><b>{i.player}</b><button type="button" className="btn ghost sm" onClick={() => copy(i.message)}>{t("admin.invite.copy")}</button></div>
          <textarea readOnly rows={5} className="field" defaultValue={i.message} onFocus={(e) => e.currentTarget.select()} />
        </div>
      ))}
    </div>
  );
}

export function InviteButton({ playerId, label, ghost = false, playerName = "" }: { playerId: number; label?: string; ghost?: boolean; playerName?: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<InviteState, FormData>(createInviteAction, {});
  return (
    <form action={action} style={{ display: "inline-block", textAlign: "right" }}>
      <input type="hidden" name="playerId" value={playerId} />
      <button disabled={pending} className={`btn sm ${ghost ? "ghost" : ""}`}>{label ?? t("admin.invite.create")}</button>
      {state.error && <div className="errtext">{state.error}</div>}
      {state.message && <Texts items={[{ player: playerName || `#${playerId}`, message: state.message }]} />}
    </form>
  );
}

export function BulkInviteButton() {
  const t = useT();
  const [state, action, pending] = useActionState<InviteState>(createBulkInvitesAction, {});
  return (
    <form action={action}>
      <button disabled={pending} className="btn ghost sm">{t("admin.invite.bulk")}</button>
      {state.error && <div className="errtext">{state.error}</div>}
      {state.items && <Texts items={state.items} />}
    </form>
  );
}
