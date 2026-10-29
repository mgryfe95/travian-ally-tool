import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { HelpBrowser, type HelpSectionView } from "@/components/HelpBrowser";
import type { FlowLabels } from "@/components/HelpFlow";
import { LanguageSelect } from "@/components/LanguageSelect";
import { LogoMark } from "@/components/Logo";
import { HELP, helpHref, helpKey } from "@/lib/help";
import type { MessageKey } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const FLOW_KEYS = ["title", "ocr", "res", "bld", "trp", "a", "b1", "b2", "inc", "incSub", "ai", "aiSub", "out", "outSub", "admins", "adminsSub", "call", "callSub"] as const;
export const metadata = { title: "Help · Humans Ally Tool" };

/** Öffentliche Hilfe (ohne Login). Quicklinks führen ohne Anmeldung über /login?next=… zum Ziel. */
export default async function HelpPage() {
  const { t, locale } = await getT();
  const signedIn = !!(await getCurrentUser().catch(() => null));
  // Kurzvideo in der eingestellten Sprache (public/help/<bereich>.<sprache>.webm), sonst Englisch, sonst keins
  const video = (id: string) => [locale, "en"].map((l) => `${id}.${l}.webm`).find((f) => existsSync(path.join(process.cwd(), "public", "help", f)))?.replace(/^/, "/help/") ?? null;
  const sections: HelpSectionView[] = HELP.map((s) => ({
    id: s.id, title: t(`help.sec.${s.id}` as MessageKey), intro: t(`help.sec.${s.id}.intro` as MessageKey), video: video(s.id), flow: s.id === "ocr" || s.id === "ai",
    items: s.items.map((i) => ({ id: i.id, title: t(helpKey(i.id, "t")), body: t(helpKey(i.id, "b")), links: i.links.map((l) => ({ href: helpHref(l.href, signedIn), label: t(l.label) })) })),
  }));
  return (
    <div className="helpwrap">
      <header className="helphead">
        <Link href={signedIn ? "/" : "/login"} className="row" style={{ gap: 12, textDecoration: "none", color: "inherit" }} aria-label="Humans">
          <LogoMark size={56} />
          <span><span className="sub" style={{ display: "block", color: "var(--side-muted)" }}>{t("help.eyebrow")}</span><b style={{ fontFamily: "var(--serif)", fontSize: 24 }}>{t("help.title")}</b></span>
        </Link>
        <div className="row" style={{ gap: 12 }}>
          <LanguageSelect />
          <Link className="btn" href={signedIn ? "/" : "/login?next=%2Fhelp"}>{signedIn ? t("help.toApp") : t("help.login")}</Link>
        </div>
      </header>
      <main className="helpmain">
        <p style={{ fontSize: 17, margin: "0 0 12px" }}>{t("help.intro")}</p>
        {!signedIn && <p className="card soft" role="note" style={{ margin: "0 0 16px" }}>{t("help.loginHint")}</p>}
        <HelpBrowser sections={sections} signedIn={signedIn} flow={Object.fromEntries(FLOW_KEYS.map((k) => [k, t(`help.flow.${k}` as MessageKey)])) as FlowLabels} />
      </main>
    </div>
  );
}
