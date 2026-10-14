import Link from "next/link";
import { ResetForm } from "@/components/AuthForms";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Neues Passwort</h1>
      {token && !error ? <ResetForm token={token} /> : <p className="sub">Der Link ist ungültig oder abgelaufen. <Link href="/forgot">Neuen Link anfordern</Link></p>}
    </>
  );
}
