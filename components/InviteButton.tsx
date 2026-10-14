"use client";

import { useActionState } from "react";
import { createInviteAction, type InviteState } from "@/app/admin/actions";

export function InviteButton({ playerId }: { playerId: number }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInviteAction, {});
  return (
    <form action={action} className="inline-block">
      <input type="hidden" name="playerId" value={playerId} />
      <button disabled={pending} className="rounded border border-zinc-700 px-2 py-0.5 text-xs hover:border-amber-400">Einladung</button>
      {state.error && <span className="ml-2 text-xs text-red-400">{state.error}</span>}
      {state.message && (
        <div className="mt-2 w-96 rounded border border-zinc-700 bg-zinc-900 p-2 text-xs">
          <p className="mb-1 text-amber-400">Nur jetzt sichtbar – IGM-Text kopieren:</p>
          <textarea readOnly rows={7} className="w-full bg-transparent" defaultValue={state.message} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="mt-1 underline" onClick={() => navigator.clipboard?.writeText(state.message ?? "")}>IGM-Text kopieren</button>
        </div>
      )}
    </form>
  );
}
