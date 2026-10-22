"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";

/** Versehentlich bestätigten Screenshot wieder zur Prüfung stellen (entfernt das Lern-Beispiel). */
export function RetractButton({ id }: { id: number }) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  return (
    <div style={{ marginTop: 6 }}>
      <button type="button" className="btn ghost sm" disabled={busy} title={t("screenshots.retract.hint")} onClick={async () => {
        setBusy(true);
        const res = await fetch(`/api/screenshots/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "retract" }) });
        setBusy(false);
        if (!res.ok) return setMsg(t("screenshots.retract.failed"));
        router.refresh();
      }}>{t("screenshots.retract")}</button>
      {msg && <span className="errtext" role="status"> {msg}</span>}
    </div>
  );
}
