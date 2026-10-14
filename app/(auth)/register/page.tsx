import { RegisterForm } from "@/components/AuthForms";

export default function RegisterPage() {
  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Registrieren</h1>
      <p className="sub" style={{ margin: "0 0 16px" }}>Ohne Einladung startest du als Gast. Im nächsten Schritt verknüpfst du deinen Travian-Spieler.</p>
      <RegisterForm />
    </>
  );
}
