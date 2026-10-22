/* eslint-disable @next/next/no-img-element -- statische Wappen-Dateien aus public/ (transparent, aus dem Humans-Logo) */
/** Wappen klein (Seitenleiste, Kopfzeile); Datei: public/logo-small.png (160 px). */
export function LogoMark({ size = 40, alt = "Humans" }: { size?: number; alt?: string }) {
  return <img src="/logo-small.png" alt={alt} width={size} height={size} style={{ display: "block", objectFit: "contain" }} />;
}

/** Wappen groß (Anmeldeseiten); Datei: public/logo.png (640 px). */
export function LogoEmblem({ size = 300, label = "Humans" }: { size?: number; label?: string }) {
  return <img src="/logo.png" alt={label} width={size} height={size} style={{ display: "block", objectFit: "contain", maxWidth: "100%", height: "auto" }} />;
}
