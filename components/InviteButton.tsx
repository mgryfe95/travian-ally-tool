"use client";

import { useActionState } from "react";
import { createBulkInvitesAction, createInviteAction, type InviteState } from "@/app/(app)/admin/actions";

const copy = (text: string) => navigator.clipboard?.writeText(text);

function Texts({ items }: { items: { player: string; message: string }[] }) {
  return (
    <div className="card" style={{ marginTop: 8, textAlign: "left", minWidth: 320 }}>
      <p className="sub" style={{ color: "var(--warn)" }}>Nur jetzt sichtbar – bitte kopieren und ingame verschicken.</p>
      {items.map((i) => (
        <div key={i.player} style={{ marginTop: 10 }}>
          <div className="row between"><b>{i.player}</b><button type="button" className="btn ghost sm" onClick={() => copy(i.message)}>IGM-Text kopieren</button></div>
          <textarea readOnly rows={5} className="field" defaultValue={i.message} onFocus={(e) => e.currentTarget.select()} />
        </div>
      ))}
    </div>
  );
}

export function InviteButton({ playerId, label = "Einladung erzeugen", ghost = false, playerName = "" }: { playerId: number; label?: string; ghost?: boolean; playerName?: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInviteAction, {});
  return (
    <form action={action} style={{ display: "inline-block", textAlign: "right" }}>
      <input type="hidden" name="playerId" value={playerId} />
      <button disabled={pending} className={`btn sm ${ghost ? "ghost" : ""}`}>{label}</button>
      {state.error && <div className="errtext">{state.error}</div>}
      {state.message && <Texts items={[{ player: playerName || `#${playerId}`, message: state.message }]} />}
    </form>
  );
}

export function BulkInviteButton() {
  const [state, action, pending] = useActionState<InviteState>(createBulkInvitesAction, {});
  return (
    <form action={action}>
      <button disabled={pending} className="btn ghost sm">Alle Uneingeladenen: Links erzeugen</button>
      {state.error && <div className="errtext">{state.error}</div>}
      {state.items && <Texts items={state.items} />}
    </form>
  );
}
