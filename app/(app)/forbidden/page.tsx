import { getT } from "@/lib/i18n/server";

export default async function Forbidden() {
  const { t } = await getT();
  return (
    <>
      <header><h1>{t("nav.forbiddenTitle")}</h1></header>
      <section className="card"><p className="sub">{t("nav.forbiddenBody")}</p></section>
    </>
  );
}
