/** Platzhalter-Wappen im Stil des Humans-Logos (Krone, Schild, Marine-Ring, Gold). Wird durch die echte Logo-Datei ersetzt, sobald sie vorliegt. */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="22" r="16" fill="#1e3556" stroke="#c8962e" strokeWidth="2.5" />
      <path d="M13 14h14v8c0 5-4 8-7 9-3-1-7-4-7-9z" fill="#f4ebd6" stroke="#8a9aaa" strokeWidth="1.5" />
      <path d="M11 9l3 4 3-5 3 5 3-5 3 4-1 3H12z" fill="#c8962e" />
      <path d="M16 21h8M20 17v8" stroke="#1e3556" strokeWidth="2" />
    </svg>
  );
}

export function LogoEmblem({ size = 200, label = "Humans" }: { size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 150 150" role="img" aria-label={label}>
      <circle cx="75" cy="82" r="62" fill="#1e3556" stroke="#8a9aaa" strokeWidth="4" />
      <circle cx="75" cy="82" r="52" fill="#f1e3b8" stroke="#c8962e" strokeWidth="3" />
      <g stroke="#e6c26a" strokeWidth="2"><path d="M75 82 L75 36M75 82 L40 50M75 82 L110 50M75 82 L28 82M75 82 L122 82" /></g>
      <path d="M52 118c0-26 10-40 23-40s23 14 23 40z" fill="#5e7f3a" opacity=".85" />
      <path d="M58 96l17-14 17 14v14H58z" fill="#8a6b3e" stroke="#4a3a20" strokeWidth="2" />
      <path d="M52 14l9 12 14-16 14 16 9-12 4 18H48z" fill="#c8962e" stroke="#8a6414" strokeWidth="2" />
      <path d="M12 128c20-6 36-6 63-6s43 0 63 6l-8 16c-20-5-34-5-55-5s-35 0-55 5z" fill="#e6c26a" stroke="#8a6414" strokeWidth="2.5" />
      <text x="75" y="138" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="700" fontSize="17" letterSpacing="2" fill="#14253e">HUMANS</text>
    </svg>
  );
}
