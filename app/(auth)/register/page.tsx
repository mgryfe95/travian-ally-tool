import { RegisterForm } from "@/components/AuthForms";
import { getT } from "@/lib/i18n/server";

export default async function RegisterPage() {
  const { t } = await getT();
  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>{t("auth.register.title")}</h1>
      <p className="sub" style={{ margin: "0 0 16px" }}>{t("auth.register.intro")}</p>
      <RegisterForm />
    </>
  );
}
