import { RegisterForm } from "@/components/AuthForms";
import { loadRegistrablePlayers } from "@/lib/alliance-group";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const { t } = await getT();
  const players = await loadRegistrablePlayers(db).catch(() => []);
  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>{t("auth.register.title")}</h1>
      <p className="sub" style={{ margin: "0 0 16px" }}>{t("auth.register.intro")}</p>
      <RegisterForm players={players.map((p) => p.name)} />
    </>
  );
}
