"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type DragEvent } from "react";
import { useT } from "@/lib/i18n/client";

/** Ein Upload-Weg je Zweck – Art und Gerät (Desktop/Mobile) werden vom Scanner erkannt, es gibt keine Auswahl. Auch Strg+V. */
export function UploadBox({ villageId, label, hint, id }: { villageId?: number; label: string; hint?: string; id: string }) {
  const router = useRouter();
  const t = useT();
  const [msg, setMsg] = useState<{ text: string; error?: boolean; review?: boolean }>();
  const [busy, setBusy] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg(undefined);
    const form = new FormData();
    form.append("file", file);
    if (villageId) form.append("villageId", String(villageId));
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
  return (
    <div onPaste={(e) => void upload(e.clipboardData.files[0])}>
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
