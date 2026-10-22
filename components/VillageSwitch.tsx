"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useT } from "@/lib/i18n/client";

export function VillageSwitch({ villages, current }: { villages: { id: number; label: string }[]; current: number }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <div>
      <label htmlFor="vsel" className="lbl">{t("villages.switch")}</label>
      <select id="vsel" className="field" style={{ width: "auto" }} value={current} onChange={(e) => { const id = e.target.value; start(() => router.push(`/villages/${id}`)); }}>
        {villages.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
      {pending && <span className="spinner sm" role="status" aria-label={t("nav.loading")} style={{ marginLeft: 10, verticalAlign: "middle" }} />}
    </div>
  );
}
