import type { ReactNode } from "react";
import { LanguageSelect } from "@/components/LanguageSelect";
import { LogoEmblem } from "@/components/Logo";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ownAllianceTag, serverLabel } from "@/lib/serverinfo";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const tag = await ownAllianceTag(db).catch(() => "");
  return (
    <div className="authwrap">
      <div className="authhero">
        <LogoEmblem size={190} />
        <div className="tag">Community · Humanity · Support</div>
        <div className="sub" style={{ color: "var(--side-muted)" }}>{[serverLabel(env().TRAVIAN_SERVER_URL), tag].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="authform">
        <div className="authbox card" style={{ width: "min(100%, 460px)" }}>
          {children}
          <div style={{ marginTop: 16 }}><LanguageSelect /></div>
        </div>
      </div>
    </div>
  );
}
