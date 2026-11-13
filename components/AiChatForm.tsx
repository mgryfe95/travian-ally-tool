"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

const CMDS = ["tips", "open", "search", "incident", "help"] as const;

function Submit() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <>
      <button className="btn" disabled={pending}>{t("aichat.send")}</button>
      {pending && <span className="sub" role="status">{t("aichat.thinking")}</span>}
    </>
  );
}

/** Eingabe mit „/“-Befehlsliste; Enter sendet, Umschalt+Enter = neue Zeile. */
export function AiChatForm({ action, chatId, incident }: { action: (f: FormData) => Promise<void>; chatId: number; incident: boolean }) {
  const t = useT();
  const [text, setText] = useState("");
  const showCmds = !incident && text.startsWith("/") && !text.includes(" ");
  const matches = CMDS.filter((c) => `/${c}`.startsWith(text.toLowerCase()));
  return (
    <form action={action} onSubmit={() => setTimeout(() => setText(""), 0)} style={{ display: "grid", gap: 8, position: "relative" }}>
      <input type="hidden" name="chatId" value={chatId} />
      {showCmds && matches.length > 0 && (
        <ul role="listbox" aria-label={t("aichat.cmds")} className="card" style={{ listStyle: "none", margin: 0, padding: 6, position: "absolute", bottom: "100%", left: 0, right: 0, zIndex: 5 }}>
          {matches.map((c) => (
            <li key={c}><button type="button" className="listbtn" style={{ width: "100%", textAlign: "left" }} onClick={() => setText(`/${c} `)}><b>/{c}</b> <span className="sub">– {t(`aichat.cmd.desc.${c}` as MessageKey)}</span></button></li>
          ))}
        </ul>
      )}
      <textarea name="text" rows={3} className="field" maxLength={4000} required value={text} onChange={(e) => setText(e.target.value)}
        placeholder={t(incident ? "aichat.placeholderIncident" : "aichat.placeholder")} aria-label={t("aichat.send")}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) e.currentTarget.form?.requestSubmit(); } }} />
      <div className="row" style={{ gap: 10, alignItems: "center" }}><Submit /></div>
    </form>
  );
}
