export function Sparkline({ values, width = 320, height = 64 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <p className="text-sm text-zinc-500">Noch zu wenig Verlaufsdaten.</p>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 4 - ((v - min) / span) * (height - 8)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-xl" role="img" aria-label="Bevölkerungsverlauf">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400" />
    </svg>
  );
}
