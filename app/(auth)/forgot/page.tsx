import Link from "next/link";
import { ForgotForm } from "@/components/AuthForms";
import { getT } from "@/lib/i18n/server";
import { mailEnabled } from "@/lib/mail";

export default async function ForgotPage() {
  const { t } = await getT();
  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>{t("auth.forgot.title")}</h1>
      {mailEnabled() ? (
        <>
          <p className="sub" style={{ margin: "0 0 16px" }}>{t("auth.forgot.intro")}</p>
          <ForgotForm />
        </>
      ) : (
        <p className="sub" style={{ margin: "0 0 16px" }}>{t("auth.forgot.noMail")}</p>
      )}
      <p style={{ marginTop: 16 }}><Link href="/login">{t("auth.forgot.back")}</Link></p>
    </>
  );
}
