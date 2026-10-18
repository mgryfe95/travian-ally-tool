"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type DragEvent } from "react";
import type { MessageKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

/** Arten mit Beispielbild unter /examples/<ART>.webp */
const PREVIEW = new Set(["RALLY_POINT", "VILLAGE_TROOPS", "VILLAGE_TROOPS_PRESENT", "VILLAGE_TRAINING", "VILLAGE_SMITHY", "VILLAGE_HOSPITAL", "VILLAGE_CULTURE", "VILLAGE_RESOURCES", "VILLAGE_PRODUCTION", "RESOURCE_VIEW", "VILLAGE_VIEW"]);
export const ALL_UPLOAD_KINDS = ["RESOURCE_VIEW", "VILLAGE_VIEW", "RALLY_POINT", "VILLAGE_TROOPS", "VILLAGE_TROOPS_PRESENT", "VILLAGE_RESOURCES", "VILLAGE_PRODUCTION", "VILLAGE_TRAINING", "VILLAGE_SMITHY", "VILLAGE_HOSPITAL", "VILLAGE_CULTURE", "BATTLE_REPORT"] as const;

/**
 * Upload mit optionaler Wahl der Screenshot-Art: zu jeder Art steht, welcher Ausschnitt gebraucht wird, plus Beispielbild.
 * „Automatisch erkennen“ bleibt möglich; die Wahl dient der Erkennung als Hinweis. Auch Strg+V und Drag & Drop.
 */
export function UploadBox({ villageId, label, hint, id, kinds = ALL_UPLOAD_KINDS }: { villageId?: number; label: string; hint?: string; id: string; kinds?: readonly string[] }) {
  const router = useRouter();
  const t = useT();
  const [msg, setMsg] = useState<{ text: string; error?: boolean; review?: boolean }>();
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg(undefined);
    const form = new FormData();
    form.append("file", file);
    if (villageId) form.append("villageId", String(villageId));
    if (kind) form.append("kind", kind);
    const res = await fetch("/api/screenshots", { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as { error?: string; status?: string; message?: string | null };
    setBusy(false);
    if (!res.ok) return setMsg({ text: data.error ?? t("screenshots.upload.failed"), error: true });
    setMsg({ text: data.status === "needs_review" ? t("screenshots.upload.needsReview") : data.status === "parsed" ? t("screenshots.upload.parsed") : data.status === "failed" ? t("screenshots.upload.recFailed", { msg: data.message ?? "" }) : data.message ? t("screenshots.upload.savedMsg", { msg: data.message }) : t("screenshots.upload.saved"), review: data.status === "needs_review" });
    router.refresh();
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    void upload(e.dataTransfer.files[0]);
  };
  const kindLabel = (k: string) => t(`screenshots.kind.${k}` as MessageKey);
  return (
    <div onPaste={(e) => void upload(e.clipboardData.files[0])}>
      {kinds.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <label className="lbl" htmlFor={`${id}-kind`}>{t("screenshots.upload.kind")}</label>
          <select id={`${id}-kind`} className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">{t("screenshots.upload.kindAuto")}</option>
            {kinds.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
          </select>
          {kind && (
            <div className="row" style={{ gap: 12, marginTop: 8, alignItems: "flex-start" }}>
              {PREVIEW.has(kind) && (
                <a href={`/examples/${kind}.webp`} target="_blank" rel="noopener noreferrer" title={t("screenshots.upload.example", { kind: kindLabel(kind) })}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- statisches Beispielbild */}
                  <img src={`/examples/${kind}.webp`} alt={t("screenshots.upload.example", { kind: kindLabel(kind) })} style={{ width: 120, maxHeight: 160, objectFit: "cover", objectPosition: "top", borderRadius: 8, border: "1px solid var(--line)" }} />
                </a>
              )}
              <p className="sub" style={{ fontSize: 13, flex: "1 1 200px", margin: 0 }}>{t(`screenshots.howto.${kind}` as MessageKey)}</p>
            </div>
          )}
        </div>
      )}
      <label htmlFor={id} className="drop" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 130, border: "1.5px dashed var(--gold)", borderRadius: 10, textAlign: "center", padding: 16, cursor: "pointer", background: "#1a1712" }}>
        <span style={{ fontWeight: 600 }}>{busy ? t("screenshots.upload.busy") : label}</span>
        {hint && <span className="sub">{hint}</span>}
      </label>
      <input id={id} type="file" accept="image/png,image/jpeg,image/webp" className="sr" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
      {msg && <p className={msg.error ? "errtext" : "sub"} role="status" style={{ marginTop: 6 }}>{msg.text}{msg.review && <> <Link href="/screenshots">{t("screenshots.upload.toReview")}</Link></>}</p>}
    </div>
  );
}
