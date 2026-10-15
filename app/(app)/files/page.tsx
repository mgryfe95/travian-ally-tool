import { Thumb } from "@/components/Thumb";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { listMyFiles } from "@/lib/screenshots";
import { requireUser } from "@/lib/session";
import { deleteFileAction } from "./actions";

export const dynamic = "force-dynamic";

const size = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const when = (d: Date) => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(d);

export default async function FilesPage() {
  const user = await requireUser();
  const { files, totalBytes } = await listMyFiles(db, user.id);
  const days = env().SCREENSHOT_RETENTION_DAYS;
  return (
    <>
      <header>
        <div className="sub">Profil</div>
        <h1>Meine Bilder &amp; Dateien</h1>
        <p className="sub" style={{ marginTop: 4 }}>
          {files.length} Dateien · {size(totalBytes)} belegt. Bilder werden beim Hochladen komprimiert (WebP, ohne Metadaten). Screenshots löscht das System nach {days > 0 ? `${days} Tagen` : "—"} automatisch, außer sie dienen als Lern-Beispiel; Du kannst sie hier jederzeit selbst löschen.
        </p>
      </header>
      {files.length === 0 ? <section className="card"><p className="sub">Noch keine Uploads.</p></section> : (
        <section className="card flush">
          <div className="scroll"><table style={{ minWidth: 640 }}>
            <thead><tr><th /><th>Datei</th><th>Art</th><th className="r">Größe</th><th>Datum</th><th>Verwendung</th><th /></tr></thead>
            <tbody>{files.map((f) => (
              <tr key={`${f.type}-${f.id}`}>
                <td style={{ width: 64 }}>{f.thumbUrl ? <Thumb src={f.thumbUrl} /> : null}</td>
                <td><a href={f.url} target="_blank" rel="noreferrer">{f.name}</a></td>
                <td>{f.type === "screenshot" ? "Screenshot" : f.kind}</td>
                <td className="mono r">{size(f.sizeBytes)}</td>
                <td>{when(f.createdAt)}</td>
                <td className="sub">{f.note}</td>
                <td className="r"><form action={deleteFileAction}><input type="hidden" name="type" value={f.type} /><input type="hidden" name="id" value={f.id} /><button className="btn ghost sm" aria-label={`${f.name} löschen`}>Löschen</button></form></td>
              </tr>))}</tbody>
          </table></div>
        </section>
      )}
    </>
  );
}
