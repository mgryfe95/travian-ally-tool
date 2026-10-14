export function Sparkline({ values, width = 320, height = 64 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <p className="sub">Noch zu wenig Verlaufsdaten.</p>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 4 - ((v - min) / span) * (height - 8)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", maxWidth: 560 }} role="img" aria-label="Bevölkerungsverlauf">
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" />
    </svg>
  );
}
