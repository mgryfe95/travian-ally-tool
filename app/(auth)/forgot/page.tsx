import Link from "next/link";
import { ForgotForm } from "@/components/AuthForms";
import { mailEnabled } from "@/lib/mail";

export default function ForgotPage() {
  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Passwort vergessen?</h1>
      {mailEnabled() ? (
        <>
          <p className="sub" style={{ margin: "0 0 16px" }}>Wir schicken dir einen Link zum Zurücksetzen an deine E-Mail-Adresse.</p>
          <ForgotForm />
        </>
      ) : (
        <p className="sub" style={{ margin: "0 0 16px" }}>E-Mail-Versand ist auf diesem Server nicht eingerichtet. Bitte einen Admin um Hilfe.</p>
      )}
      <p style={{ marginTop: 16 }}><Link href="/login">Zurück zur Anmeldung</Link></p>
    </>
  );
}
