import Link from "next/link";

export default function ForgotPage() {
  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Passwort vergessen?</h1>
      <p className="sub" style={{ margin: "0 0 16px" }}>
        Der automatische Passwort-Reset per E-Mail wird gerade eingerichtet. Bis dahin kann dir ein Admin einen neuen Einladungslink erzeugen.
      </p>
      <Link className="btn ghost" href="/login">Zurück zur Anmeldung</Link>
    </>
  );
}
