# Nebenthemen — travian-ally-tool

Punkte, die Projekt, Aufbau oder andere Bereiche betreffen, aber nicht direkt zum aktuellen Arbeitsschritt gehören.

## 2026-10-14 · [Chat](https://claude.ai/chat/3f8396b4-1960-410b-9762-e96c8eb5b39c)
- **Lens-Gating offen:** Die Master-Direktive ist noch nicht in den Custom Instructions des Claude-Projekts hinterlegt, und das Wissen ist noch nicht eingebunden. Die Session-Row wurde trotzdem angelegt, weil du einen Schnell-Run wolltest.
- **Beta-Tester-Lens gelöscht:** Laut Lifecycle ist sie Standard für `tested → done`. Bei Bedarf aus dem Notion-Papierkorb wiederherstellen.
- **Repo-Schnitt weicht vom Template ab:** ein Monorepo `travian-ally-tool` statt 5 Repos (`projectos-backend` usw.). Die Repos-DB in meta_environment ist noch nicht gepflegt.
- **CC-Auftrag liegt nicht als Feature in Notion:** Claude Code liest laut Konvention nur Notion. Optional als Feature mit Status `approved` in die Features-DB des Klons übernehmen.
- **Kanalname „Ressources“:** wie von dir vorgegeben übernommen, im Admin-UI umbenennbar. Alternativen: Ressourcen / Resources.
- **Annahmen im CC-Auftrag, die du noch bestätigen solltest:**
  - Task-Force-Nachrichten erscheinen nicht im Sammelraum „Alle“.
  - ADMIN und SYSTEMADMIN sehen alle Task-Forces.
  - Tags: 0..n pro Nachricht erlaubt.
- **ToS-Grenze:** keine Spielautomatisierung, kein Scraping eingeloggter Seiten. Bei künftigen Features im Blick behalten, etwa einer Browser-Erweiterung.
- **To-do Max:** Kurze Anfrage an den Travian-Support (Travian Games), ob die Daten aus der Knowledge Base in einem privaten Allianz-Tool verwendet werden dürfen.
- **Mockup:** Die Spieldaten-Screens zeigen Beispielwerte. Nach dem Import mit echten Werten gegenprüfen.

## 2026-10-14 · [Code-Session](https://claude.ai/code/session_01R8U6NZntnAU4Sd6J6QwApM)
- **CLAUDE.md-Template nennt FastAPI/Python**, das Projekt nutzt Next.js: im Repo-CLAUDE.md überschrieben. Notion-Direktive ggf. anpassen.
- **Session-Row:** CLAUDE.md verbietet Notion-Schreiben für Claude Code; Session-Row entsteht über den Reporter. Das Session-Start-Ritual (Schritt „Session-Row anlegen“) ist hier nicht ausgeführt.
- **Lens-Gating weiter offen** (siehe Eintrag oben).
- **`next lint` ist in Next 16 entfernt:** später auf ESLint-CLI migrieren.
- **`main` zeigt auf M1-Stand** (Branch-Kopie), daher enthält der erste PR M1+M2 (Diff nur ab Commit nach `main`). Sauberer Start mit leerem Root-Commit wurde blockiert.
- **Tribe-Mapping Natars:** auf dem Server ist `tribe=5` Natars; 4 (Natur) kommt in den Daten nicht vor.
- **Fixture enthält echte Spielernamen** (öffentliche Kartendaten, ~36 Zeilen) — bei Bedarf anonymisieren.
- **Allianz-Typen angenommen:** OWN, ALLIED, NAP, NEUTRAL, ENEMY (genannt waren nur „Allianz“ und „eigene Allianz“). Weitere Typen bei Bedarf ergänzen.
- **CC-Auftrag M3 ändert sich:** „Spieler der eigenen Allianz“ (Einladungsliste, Rename-Beweis, Austrittsmarkierung) = eigene Gruppe. Auftrag-Text in `docs/projectos/CC_AUFTRAG_MVP.md` ist noch der alte Stand.
- **Setup-Code für SYSTEMADMIN-Registrierung** ist eine Ergänzung zur Spezifikation (neue ENV `SYSTEMADMIN_SETUP_CODE`); ohne sie wäre die Admin-Adresse vorab kapern-bar, weil es keine E-Mail-Verifizierung gibt. Alternative: SMTP + Mail-Verifizierung (neues Infra-Thema).
- **E-Mail-Verifizierung/Passwort-Reset fehlen** (kein Mailversand im Auftrag). Passwort vergessen = Admin muss Konto löschen/neu einladen. Klären, ob SMTP gewünscht ist.
- **`.npmrc legacy-peer-deps`** wegen better-auth-Peers; bei Vitest-Upgrade auf 3 prüfen, ob es entfällt.
- **`next lint`-Deprecation** und **Prisma `package.json#prisma`-Config** (Prisma 7) stehen zur Migration an.
- **AUTH_SECRET-Länge:** Better Auth warnt unter 32 Zeichen; `.env.example` nennt `openssl rand -base64 32`.
