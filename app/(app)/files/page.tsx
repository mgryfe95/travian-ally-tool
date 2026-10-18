import { Thumb } from "@/components/Thumb";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fmtDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { quotaBytes } from "@/lib/quota";
import { listMyFiles } from "@/lib/screenshots";
import { requireUser } from "@/lib/session";
import { deleteFileAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_KEYS: Record<string, MessageKey> = {
  uploaded: "screenshots.status.uploaded", needs_review: "screenshots.status.needs_review", parsed: "screenshots.status.parsed", failed: "screenshots.status.failed", rejected: "screenshots.status.rejected",
};
const FILE_KINDS = ["image", "pdf", "text"] as const;

export default async function FilesPage() {
  const { t, locale } = await getT();
  const size = (n: number) => (n >= 1_048_576 ? t("screenshots.files.sizeMB", { n: (n / 1_048_576).toFixed(1) }) : t("screenshots.files.sizeKB", { n: Math.max(1, Math.round(n / 1024)) }));
  const when = (d: Date) => fmtDate(d, locale, { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  const user = await requireUser();
  const { files, totalBytes } = await listMyFiles(db, user.id);
  const days = env().SCREENSHOT_RETENTION_DAYS;
  const limit = quotaBytes();
  const mb = (n: number) => (n / 1_048_576).toFixed(1);
  return (
    <>
      <header>
        <div className="sub">{t("screenshots.files.crumb")}</div>
        <h1>{t("screenshots.files.title")}</h1>
        <p className="sub" style={{ marginTop: 4 }}>
          {t("screenshots.files.summary", { n: files.length, size: size(totalBytes), retention: days > 0 ? t("screenshots.files.retentionDays", { n: days }) : "—" })}
        </p>
        <div style={{ marginTop: 8, maxWidth: 360 }} aria-label={t("screenshots.files.quotaLabel")}>
          <div className="sub" style={{ fontSize: 12 }}>{limit > 0 ? t("screenshots.files.quota", { used: mb(totalBytes), limit: mb(limit) }) : t("screenshots.files.quotaUnlimited", { used: mb(totalBytes) })}</div>
          {limit > 0 && <div role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(totalBytes, limit)} style={{ height: 6, borderRadius: 3, background: "var(--line)", marginTop: 4 }}><div style={{ height: 6, borderRadius: 3, width: `${Math.min(100, (totalBytes / limit) * 100)}%`, background: totalBytes / limit > 0.9 ? "var(--warn)" : "var(--link-h)" }} /></div>}
        </div>
      </header>
      {files.length === 0 ? <section className="card"><p className="sub">{t("screenshots.files.empty")}</p></section> : (
        <section className="card flush">
          <div className="scroll"><table style={{ minWidth: 640 }}>
            <thead><tr><th /><th>{t("screenshots.files.col.file")}</th><th>{t("screenshots.files.col.type")}</th><th className="r">{t("screenshots.files.col.size")}</th><th>{t("screenshots.files.col.date")}</th><th>{t("screenshots.files.col.use")}</th><th /></tr></thead>
            <tbody>{files.map((f) => (
              <tr key={`${f.type}-${f.id}`}>
                <td style={{ width: 64 }}>{f.thumbUrl ? <Thumb src={f.thumbUrl} /> : null}</td>
                <td><a href={f.url} target="_blank" rel="noreferrer">{f.name}</a></td>
                <td>{f.type === "screenshot" ? t("screenshots.files.type.screenshot") : (FILE_KINDS as readonly string[]).includes(f.kind) ? t(`screenshots.files.type.${f.kind as (typeof FILE_KINDS)[number]}`) : f.kind}</td>
                <td className="mono r">{size(f.sizeBytes)}</td>
                <td>{when(f.createdAt)}</td>
                <td className="sub">{f.type === "screenshot" ? (STATUS_KEYS[f.note] ? t(STATUS_KEYS[f.note] as MessageKey) : f.note) : f.channel !== undefined ? t(f.channelDeleted ? "screenshots.files.inChannelDeleted" : "screenshots.files.inChannel", { name: f.channel }) : f.dm ? t("screenshots.files.inDm") : t("screenshots.files.unsent")}</td>
                <td className="r"><form action={deleteFileAction}><input type="hidden" name="type" value={f.type} /><input type="hidden" name="id" value={f.id} /><button className="btn ghost sm" aria-label={t("screenshots.files.deleteAria", { name: f.name })}>{t("screenshots.files.delete")}</button></form></td>
              </tr>))}</tbody>
          </table></div>
        </section>
      )}
    </>
  );
}
