import { LoginForm } from "@/components/AuthForms";
import { getT } from "@/lib/i18n/server";

export default async function LoginPage() {
  const { t } = await getT();
  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>{t("auth.login.title")}</h1>
      <LoginForm />
    </>
  );
}
