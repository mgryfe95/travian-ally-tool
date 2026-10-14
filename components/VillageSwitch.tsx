"use client";

import { useRouter } from "next/navigation";

export function VillageSwitch({ villages, current }: { villages: { id: number; label: string }[]; current: number }) {
  const router = useRouter();
  return (
    <div>
      <label htmlFor="vsel" className="lbl">Dorf wechseln</label>
      <select id="vsel" className="field" style={{ width: "auto" }} value={current} onChange={(e) => router.push(`/villages/${e.target.value}`)}>
        {villages.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
    </div>
  );
}
