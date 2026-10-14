import { RegisterForm } from "@/components/AuthForms";

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Registrieren</h1>
      <p className="mt-1 text-sm text-zinc-400">Ohne Einladung startest du als Gast. Danach kannst du unter „Mein Konto“ deinen Spieler beanspruchen.</p>
      <RegisterForm />
    </main>
  );
}
