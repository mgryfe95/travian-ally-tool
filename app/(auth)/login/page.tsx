import Link from "next/link";
import { LoginForm } from "@/components/AuthForms";
import { safeNext } from "@/lib/help";
import { getT } from "@/lib/i18n/server";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { t } = await getT();
  const next = safeNext((await searchParams).next) ?? "/";
  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>{t("auth.login.title")}</h1>
      <LoginForm next={next} />
      <p style={{ marginTop: 14, fontSize: 13 }}><Link href="/help">{t("help.link")}</Link></p>
    </>
  );
}
