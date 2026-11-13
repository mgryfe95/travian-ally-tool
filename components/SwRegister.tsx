"use client";

import { useEffect } from "react";

/** Registriert den Service Worker (Installierbarkeit als App, Push, Offline-Hinweis). */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
