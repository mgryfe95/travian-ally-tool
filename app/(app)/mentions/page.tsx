import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { chatCtx, listMyMentions } from "@/lib/services/chat";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MentionsPage() {
  const { t, locale } = await getT();
  const user = await requirePermission("chat.read");
  const rows = await listMyMentions(db, await chatCtx(db, user));
  return (
    <>
      <header>
        <div className="sub">{t("mentions.eyebrow")}</div>
        <h1>{t("mentions.title")}</h1>
        <p className="sub" style={{ marginTop: 4 }}>{t("mentions.intro")}</p>
      </header>
      <section className="card flush" aria-label={t("mentions.title")}>
        {rows.length === 0 ? <p className="sub" style={{ margin: 12 }}>{t("mentions.empty")}</p> : (
          <div className="scroll"><table style={{ minWidth: 640 }}>
            <thead><tr><th>{t("mentions.col.when")}</th><th>{t("mentions.col.channel")}</th><th>{t("mentions.col.from")}</th><th>{t("mentions.col.text")}</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.messageId}>
                <td className="mono">{fmtDate(new Date(r.at), locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                <td>{r.channelTree === "ALLY" ? `# ${r.channelName}` : r.channelName}</td>
                <td>{r.author}</td>
                <td className="sub" style={{ maxWidth: 380, overflowWrap: "anywhere" }}>{r.isReply ? `${t("mentions.reply")}: ` : ""}{r.excerpt}</td>
                <td className="r"><Link className="btn sm" href={`/chat?c=${r.channelId}&m=${r.messageId}`}>{t("mentions.open")}</Link></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
