/* eslint-disable @next/next/no-img-element -- geschützte, authentifizierte Auslieferung; next/image bräuchte öffentliche URLs */
export function Thumb({ src, size = 56 }: { src: string; size?: number }) {
  return <img src={src} alt="" width={size} height={size} loading="lazy" style={{ objectFit: "cover", borderRadius: 6 }} />;
}
