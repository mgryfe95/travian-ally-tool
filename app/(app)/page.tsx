import Link from "next/link";
import { requireUser } from "@/lib/session";

export default async function Overview() {
  const user = await requireUser();
  return (
    <>
      <header>
        <div className="sub">Übersicht</div>
        <h1>Willkommen, {user.name}</h1>
      </header>
      <section className="card">
        <h2>Deine Dörfer</h2>
        <p className="sub" style={{ marginTop: 6 }}>
          Dörfer, Ist-Zustand aus Screenshots, KI-Instruktionen und Empfehlungen folgen mit M5 / Phase 2.
          Bis dahin findest du Inaktive in deiner Nähe unter <Link href="/inactive">Inaktive</Link>.
        </p>
      </section>
    </>
  );
}
