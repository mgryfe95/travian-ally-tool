"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

function useSubmit(url: string, build: (f: FormData) => unknown, redirectTo: string, validate?: (f: FormData) => string | undefined) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const invalid = validate?.(form);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(undefined);
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(build(form)) });
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    setBusy(false);
    if (!res.ok) return setError(data.error ?? data.message ?? "Fehlgeschlagen");
    router.push(redirectTo);
    router.refresh();
  }
  return { onSubmit, error, busy };
}

const col = { display: "flex", flexDirection: "column", gap: 12 } as const;

export function LoginForm({ guestHref = "/register" }: { guestHref?: string }) {
  const { onSubmit, error, busy } = useSubmit("/api/auth/sign-in/email", (f) => ({ email: f.get("email"), password: f.get("password") }), "/");
  return (
    <form onSubmit={onSubmit} style={col}>
      <div><label className="lbl" htmlFor="le">E-Mail</label><input id="le" name="email" className="field" type="email" required autoComplete="email" /></div>
      <div><label className="lbl" htmlFor="lp">Passwort</label><input id="lp" name="password" className="field" type="password" required autoComplete="current-password" /></div>
      {error && <p className="errtext" role="alert">{error}</p>}
      <button disabled={busy} className="btn">Anmelden</button>
      <div className="row between">
        <Link href="/forgot" style={{ fontSize: 13 }}>Passwort vergessen?</Link>
        <Link href={guestHref} style={{ fontSize: 13 }}>Ohne Einladung registrieren</Link>
      </div>
    </form>
  );
}

/** `inviteToken` gesetzt: Name kommt vom Spieler, Ziel ist die Übersicht. Sonst Gast-Registrierung → /claim. */
export function RegisterForm({ inviteToken }: { inviteToken?: string }) {
  const { onSubmit, error, busy } = useSubmit(
    "/api/register",
    (f) => ({ email: f.get("email"), name: f.get("name") || undefined, password: f.get("password"), inviteToken, setupCode: f.get("setupCode") || undefined }),
    inviteToken ? "/" : "/claim",
    (f) => (f.get("password") !== f.get("password2") ? "Die Passwörter stimmen nicht überein" : undefined),
  );
  return (
    <form onSubmit={onSubmit} style={col}>
      {!inviteToken && <div><label className="lbl" htmlFor="rn">Anzeigename</label><input id="rn" name="name" className="field" required minLength={2} autoComplete="nickname" /></div>}
      <div><label className="lbl" htmlFor="ie">E-Mail</label><input id="ie" name="email" className="field" type="email" required autoComplete="email" /></div>
      <div><label className="lbl" htmlFor="ip">Passwort</label><input id="ip" name="password" className="field" type="password" required minLength={10} autoComplete="new-password" /></div>
      <div><label className="lbl" htmlFor="ip2">Passwort wiederholen</label><input id="ip2" name="password2" className="field" type="password" required minLength={10} autoComplete="new-password" /></div>
      {!inviteToken && (
        <details className="sub">
          <summary style={{ cursor: "pointer" }}>Setup-Code (nur für Systemadmin-Adressen)</summary>
          <input name="setupCode" type="password" className="field" style={{ marginTop: 8 }} aria-label="Setup-Code" />
        </details>
      )}
      {error && <p className="errtext" role="alert">{error}</p>}
      <button disabled={busy} className="btn">Account erstellen</button>
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      style={{ background: "none", border: 0, padding: 0, color: "var(--link)", cursor: "pointer" }}
      onClick={async () => {
        await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        router.push("/login");
        router.refresh();
      }}
    >
      Abmelden
    </button>
  );
}
