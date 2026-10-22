"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createBulkInvitesAction, createInviteAction, type InviteState } from "@/app/(app)/admin/actions";

/** Zwischenablage; liefert false, wenn der Browser es ohne frische Nutzeraktion verweigert. */
const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

function Texts({ items }: { items: { player: string; message: string; igmUrl: string }[] }) {
  const t = useT();
  const [copied, setCopied] = useState<string>();
  return (
    <div className="card" style={{ marginTop: 8, textAlign: "left", minWidth: 320 }}>
      <p className="sub" style={{ color: "var(--warn)" }}>{t("admin.invite.visibleOnce")}</p>
      {items.map((i) => (
        <div key={i.player} style={{ marginTop: 10 }}>
          <div className="row between">
            <b>{i.player}</b>
            <span className="row" style={{ gap: 6 }}>
              <button type="button" className="btn ghost sm" onClick={async () => setCopied((await copy(i.message)) ? i.player : undefined)}>{t("admin.invite.copy")}</button>
              <a className="btn ghost sm" href={i.igmUrl} target="_blank" rel="noopener noreferrer" onClick={() => void copy(i.message).then((ok) => setCopied(ok ? i.player : undefined))}>{t("admin.invite.openIgm")}</a>
            </span>
          </div>
          {copied === i.player && <div className="sub" role="status" style={{ fontSize: 12 }}>{t("admin.invite.copied")}</div>}
          <textarea readOnly rows={5} className="field" defaultValue={i.message} onFocus={(e) => e.currentTarget.select()} />
        </div>
      ))}
    </div>
  );
}

export function InviteButton({ playerId, label, ghost = false, playerName = "" }: { playerId: number; label?: string; ghost?: boolean; playerName?: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<InviteState, FormData>(createInviteAction, {});
  const tab = useRef<Window | null>(null);
  const [copied, setCopied] = useState<boolean>();
  // Neuer Tab wird beim Klick geöffnet (Popup-Blocker!) und sobald der Link da ist auf das Ingame-Nachrichtenfenster gesetzt;
  // der Text lässt sich nicht per URL vorbelegen und landet deshalb in der Zwischenablage.
  useEffect(() => {
    if (!state.message) return;
    void copy(state.message).then(setCopied);
    if (tab.current && !tab.current.closed && state.igmUrl) tab.current.location.href = state.igmUrl;
    tab.current = null;
  }, [state]);
  useEffect(() => {
    if (state.error && tab.current && !tab.current.closed) tab.current.close();
  }, [state.error]);
  return (
    <form action={action} style={{ display: "inline-block", textAlign: "right" }}>
      <input type="hidden" name="playerId" value={playerId} />
      <button disabled={pending} className={`btn sm ${ghost ? "ghost" : ""}`} onClick={() => { tab.current = window.open("about:blank", "_blank"); }}>{label ?? t("admin.invite.create")}</button>
      {state.error && <div className="errtext">{state.error}</div>}
      {state.message && copied !== undefined && <div className="sub" role="status" style={{ fontSize: 12 }}>{copied ? t("admin.invite.copied") : t("admin.invite.copyManual")}</div>}
      {state.message && <Texts items={[{ player: playerName || `#${playerId}`, message: state.message, igmUrl: state.igmUrl ?? "#" }]} />}
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
