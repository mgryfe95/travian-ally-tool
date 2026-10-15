import Link from "next/link";
import { ResetForm } from "@/components/AuthForms";
import { getT } from "@/lib/i18n/server";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const { t } = await getT();
  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>{t("auth.reset.title")}</h1>
      {token && !error ? <ResetForm token={token} /> : <p className="sub">{t("auth.reset.invalid")} <Link href="/forgot">{t("auth.reset.request")}</Link></p>}
    </>
  );
}
