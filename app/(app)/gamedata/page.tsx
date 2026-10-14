import { requirePermission } from "@/lib/session";

export default async function Page() {
  await requirePermission("map.view");
  return (
    <>
      <header>
        <h1>Spieldaten</h1>
      </header>
      <section className="card">
        <p className="sub">Gebäude, Truppen und Völker kommen aus dem freigegebenen Datenimport (Phase 2, nach Freigabe der Quelle).</p>
      </section>
    </>
  );
}
