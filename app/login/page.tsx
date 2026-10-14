import { LoginForm } from "@/components/AuthForms";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Anmelden</h1>
      <LoginForm />
    </main>
  );
}
