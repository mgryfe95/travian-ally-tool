import type { ReactNode } from "react";
import { LanguageSelect } from "@/components/LanguageSelect";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ownAllianceTag, serverLabel } from "@/lib/serverinfo";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const tag = await ownAllianceTag(db).catch(() => "");
  return (
    <div className="center">
      <div className="authbox card" style={{ width: "min(100%, 480px)" }}>
        <div className="logo" style={{ padding: "0 0 4px" }}>Ally Tool</div>
        <div className="sub" style={{ marginBottom: 18 }}>{[serverLabel(env().TRAVIAN_SERVER_URL), tag].filter(Boolean).join(" · ")}</div>
        {children}
        <div style={{ marginTop: 16 }}><LanguageSelect /></div>
      </div>
    </div>
  );
}
