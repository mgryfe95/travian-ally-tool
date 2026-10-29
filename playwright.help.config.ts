import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

/** Nimmt die Kurzvideos der Hilfeseite auf (public/help/<bereich>.webm). Läuft gegen dieselben Testdaten wie die e2e-Tests: erst `npm run e2e`, dann `npm run help:videos`. */
export default defineConfig({ ...base, testDir: "e2e-help", globalSetup: undefined, outputDir: "test-results-help", use: { ...base.use, viewport: { width: 1280, height: 720 } } });
