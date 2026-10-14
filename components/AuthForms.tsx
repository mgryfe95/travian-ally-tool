"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const input = "w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2";
const btn = "rounded bg-amber-500 px-4 py-2 font-medium text-zinc-950 disabled:opacity-50";

function useSubmit(url: string, build: (f: FormData) => unknown, redirectTo: string) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await fetch(url, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(build(new FormData(e.currentTarget))),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    setBusy(false);
    if (!res.ok) return setError(data.error ?? data.message ?? "Fehlgeschlagen");
    router.push(redirectTo);
    router.refresh();
  }
  return { onSubmit, error, busy };
}

export function LoginForm() {
  const { onSubmit, error, busy } = useSubmit("/api/auth/sign-in/email", (f) => ({ email: f.get("email"), password: f.get("password") }), "/");
  return (
    <form onSubmit={onSubmit} className="mt-4 max-w-sm space-y-3">
      <input name="email" type="email" required placeholder="E-Mail" autoComplete="email" className={input} />
      <input name="password" type="password" required placeholder="Passwort" autoComplete="current-password" className={input} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button disabled={busy} className={btn}>Anmelden</button>
    </form>
  );
}

export function RegisterForm({ inviteToken, defaultName }: { inviteToken?: string; defaultName?: string }) {
  const { onSubmit, error, busy } = useSubmit(
    "/api/register",
    (f) => ({ email: f.get("email"), name: f.get("name"), password: f.get("password"), inviteToken, setupCode: f.get("setupCode") || undefined }),
    "/account",
  );
  return (
    <form onSubmit={onSubmit} className="mt-4 max-w-sm space-y-3">
      <input name="name" required minLength={2} placeholder="Anzeigename" defaultValue={defaultName} className={input} />
      <input name="email" type="email" required placeholder="E-Mail" autoComplete="email" className={input} />
      <input name="password" type="password" required minLength={10} placeholder="Passwort (mind. 10 Zeichen)" autoComplete="new-password" className={input} />
      <details className="text-sm text-zinc-400">
        <summary className="cursor-pointer">Setup-Code (nur für Systemadmin-Adressen)</summary>
        <input name="setupCode" type="password" className={`${input} mt-2`} />
      </details>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button disabled={busy} className={btn}>{inviteToken ? "Konto erstellen & verifizieren" : "Registrieren"}</button>
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="text-zinc-300 hover:text-amber-400"
      onClick={async () => {
        await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        router.push("/");
        router.refresh();
      }}
    >
      Abmelden
    </button>
  );
}
