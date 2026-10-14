import { requirePermission } from "@/lib/session";

export default async function Page() {
  await requirePermission("map.view");
  return (
    <>
      <header>
        <h1>Meine Dörfer</h1>
      </header>
      <section className="card">
        <p className="sub">Dorf-Dashboards mit Screenshot-Upload, Ist-Zustand und KI-Instruktionen folgen mit M5 / Phase 2.</p>
      </section>
    </>
  );
}
