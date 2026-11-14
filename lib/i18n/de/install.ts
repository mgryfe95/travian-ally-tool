import type en from "../en/install";
const install: Record<keyof typeof en, string> = {
  "install.nav": "App",
  "install.title": "App & Benachrichtigungen",
  "install.eyebrow": "Handy & Tablet",
  "install.intro": "Richte das Tool als App auf deinem Handy ein (ohne App-Store, ohne Datei-Download) – dann bekommst du Push-Benachrichtigungen für alles, was du unten auswählst.",
  "install.button": "Jetzt installieren",
  "install.installed": "Die App ist auf diesem Gerät installiert.",
  "install.android.title": "Android (Chrome)",
  "install.android.1": "{url} in Chrome öffnen und anmelden.",
  "install.android.2": "Menü ⋮ (oben rechts) → „App installieren“ (manchmal „Zum Startbildschirm hinzufügen“).",
  "install.android.3": "Das Tool über das neue Symbol öffnen.",
  "install.ios.title": "iPhone / iPad (Safari, ab iOS 16.4)",
  "install.ios.1": "{url} in Safari öffnen und anmelden.",
  "install.ios.2": "Teilen (Quadrat mit Pfeil) → „Zum Home-Bildschirm“ → „Hinzufügen“.",
  "install.ios.3": "Das Tool über das neue Symbol öffnen – nur dort gibt es Push-Benachrichtigungen, nicht im normalen Safari-Tab.",
  "install.push": "Das Tool über das App-Symbol auf dem Handy öffnen (iPhone: nur dort möglich), dann „Auf diesem Gerät einschalten“ tippen. Auf jedem Handy bzw. Browser einzeln.",
};
export default install;
