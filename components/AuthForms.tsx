"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useT } from "@/lib/i18n/client";

function useSubmit(url: string, build: (f: FormData) => unknown, redirectTo: string, validate?: (f: FormData) => string | undefined) {
  const router = useRouter();
  const t = useT();
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
    if (!res.ok) return setError(data.error ?? data.message ?? t("auth.failed"));
    router.push(redirectTo);
    router.refresh();
  }
  return { onSubmit, error, busy };
}

const col = { display: "flex", flexDirection: "column", gap: 12 } as const;

export function LoginForm({ guestHref = "/register" }: { guestHref?: string }) {
  const t = useT();
  const { onSubmit, error, busy } = useSubmit("/api/auth/sign-in/email", (f) => ({ email: f.get("email"), password: f.get("password") }), "/");
  return (
    <form onSubmit={onSubmit} style={col}>
      <div><label className="lbl" htmlFor="le">{t("auth.email")}</label><input id="le" name="email" className="field" type="email" required autoComplete="email" /></div>
      <div><label className="lbl" htmlFor="lp">{t("auth.password")}</label><input id="lp" name="password" className="field" type="password" required autoComplete="current-password" /></div>
      {error && <p className="errtext" role="alert">{error}</p>}
      <button disabled={busy} className="btn">{t("auth.login.submit")}</button>
      <div className="row between">
        <Link href="/forgot" style={{ fontSize: 13 }}>{t("auth.login.forgot")}</Link>
        <Link href={guestHref} style={{ fontSize: 13 }}>{t("auth.login.register")}</Link>
      </div>
    </form>
  );
}

/** `inviteToken` gesetzt: Name kommt vom Spieler, Ziel ist die Übersicht. Sonst Gast-Registrierung → /claim. */
export function RegisterForm({ inviteToken, players = [] }: { inviteToken?: string; players?: string[] }) {
  const t = useT();
  const { onSubmit, error, busy } = useSubmit(
    "/api/register",
    (f) => ({ email: f.get("email"), name: f.get("name") || undefined, playerName: f.get("playerName") || undefined, password: f.get("password"), inviteToken, setupCode: f.get("setupCode") || undefined }),
    inviteToken ? "/" : "/claim",
    (f) => (f.get("password") !== f.get("password2") ? t("auth.mismatch") : undefined),
  );
  return (
    <form onSubmit={onSubmit} style={col}>
      {!inviteToken && <div><label className="lbl" htmlFor="rp">{t("auth.register.player")}</label><input id="rp" name="playerName" className="field" autoComplete="off" list="reg-players" aria-describedby="rph" /><datalist id="reg-players">{players.map((n) => <option key={n} value={n} />)}</datalist><div id="rph" className="sub" style={{ fontSize: 12, marginTop: 4 }}>{t("auth.register.playerHint")}</div></div>}
      {!inviteToken && <div><label className="lbl" htmlFor="rn">{t("auth.displayName")}</label><input id="rn" name="name" className="field" minLength={2} autoComplete="nickname" /></div>}
      <div><label className="lbl" htmlFor="ie">{t("auth.email")}</label><input id="ie" name="email" className="field" type="email" required autoComplete="email" /></div>
      <div><label className="lbl" htmlFor="ip">{t("auth.password")}</label><input id="ip" name="password" className="field" type="password" required minLength={10} autoComplete="new-password" /></div>
      <div><label className="lbl" htmlFor="ip2">{t("auth.passwordRepeat")}</label><input id="ip2" name="password2" className="field" type="password" required minLength={10} autoComplete="new-password" /></div>
      {!inviteToken && (
        <details className="sub">
          <summary style={{ cursor: "pointer" }}>{t("auth.register.setupCode")}</summary>
          <input name="setupCode" type="password" className="field" style={{ marginTop: 8 }} aria-label={t("auth.register.setupCode")} />
        </details>
      )}
      {error && <p className="errtext" role="alert">{error}</p>}
      <button disabled={busy} className="btn">{t("auth.register.submit")}</button>
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const t = useT();
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
      {t("nav.logout")}
    </button>
  );
}

export function ForgotForm() {
  const t = useT();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const email = new FormData(e.currentTarget).get("email");
    const res = await fetch("/api/auth/request-password-reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, redirectTo: "/reset-password" }) });
    setBusy(false);
    if (res.status === 429) return setError(t("auth.tooMany"));
    setSent(true);
  }
  if (sent) return <p className="sub">{t("auth.forgot.sent")}</p>;
  return (
    <form onSubmit={onSubmit} style={col}>
      <div><label className="lbl" htmlFor="fe">{t("auth.email")}</label><input id="fe" name="email" className="field" type="email" required autoComplete="email" /></div>
      {error && <p className="errtext" role="alert">{error}</p>}
      <button disabled={busy} className="btn">{t("auth.forgot.submit")}</button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const t = useT();
  const { onSubmit, error, busy } = useSubmit(
    "/api/auth/reset-password",
    (f) => ({ newPassword: f.get("password"), token }),
    "/login",
    (f) => (f.get("password") !== f.get("password2") ? t("auth.mismatch") : undefined),
  );
  return (
    <form onSubmit={onSubmit} style={col}>
      <div><label className="lbl" htmlFor="np">{t("auth.newPassword")}</label><input id="np" name="password" className="field" type="password" required minLength={10} autoComplete="new-password" /></div>
      <div><label className="lbl" htmlFor="np2">{t("auth.passwordRepeat")}</label><input id="np2" name="password2" className="field" type="password" required minLength={10} autoComplete="new-password" /></div>
      {error && <p className="errtext" role="alert">{error}</p>}
      <button disabled={busy} className="btn">{t("auth.reset.submit")}</button>
    </form>
  );
}
