import { requirePermission } from "@/lib/session";

export default async function Page() {
  await requirePermission("map.view");
  return (
    <>
      <header>
        <h1>Chat</h1>
      </header>
      <section className="card">
        <p className="sub">Kanäle, Sammelraum „Alle“, Tags, Anhänge und Task-Forces folgen mit M4.</p>
      </section>
    </>
  );
}
