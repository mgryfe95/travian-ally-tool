import { getT } from "@/lib/i18n/server";

export async function Sparkline({ values, width = 320, height = 64 }: { values: number[]; width?: number; height?: number }) {
  const { t } = await getT();
  if (values.length < 2) return <p className="sub">{t("overview.sparkline.empty")}</p>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 4 - ((v - min) / span) * (height - 8)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", maxWidth: 560 }} role="img" aria-label={t("overview.sparkline.label")}>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" />
    </svg>
  );
}
