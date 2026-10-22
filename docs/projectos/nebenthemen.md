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
- **Screenflow kam erst nach M3:** UI wurde nachträglich angeglichen; künftig vor dem Bauen prüfen, ob `docs/ui/screenflow.html` vorliegt.
- **Abweichungen vom Screenflow:** (1) „IGM-Text kopieren“ bei offener Einladung geht nicht (nur Hash gespeichert) → Button „Neuen Link erzeugen“. (2) Rechte-Matrix zeigt alle 15 Rechte statt 10 (chat.read, taskforce.manage, map.view, settings.edit, alliances.classify zusätzlich). (3) Admin-Tabs Allianzen, Konten, Audit zusätzlich. (4) Nachrichten-/Kanal-Tab ist bis M4 Platzhalter. (5) Importzeit im Gast-Screen aus `IMPORT_CRON` (stündlich xx:15) statt „02:15“.
- **Datenschutz Google Fonts:** Die Vorlage lädt Cinzel/IBM Plex vom Google-CDN (IP-Übertragung, DSGVO-relevant). Empfehlung: Fonts selbst hosten (`next/font` mit lokalen Dateien); braucht Internetzugriff beim Build bzw. Font-Dateien im Repo. Entscheidung offen.
- **SMTP (eingeplant):** Passwort-Reset und E-Mail-Verifizierung via `nodemailer`; ENV `SMTP_HOST/PORT/USER/PASS/FROM`; dann ließe sich auch der Setup-Code für Systemadmin durch E-Mail-Verifizierung ersetzen.
- **Task-Force „+“ im Screenflow** ist als eigene Seite `/chat/tf/new` umgesetzt (Vorlage zeigt keinen Dialog). Mitglieder-Verwaltung unter `/chat/tf/[id]`.
- **Anhänge „Signierte Links“:** nicht gebaut — Cookie-Auth reicht für `<img>`/Lightbox, es gibt keine öffentlichen URLs. Bei späterem Bedarf (z. B. Teilen außerhalb) nachrüstbar.
- **PDF-Vorschau** rendert fremde PDFs mit `pdftoppm` (Timeout 20 s, temporäres Verzeichnis). Für maximale Härte später in Sandbox/Container-Limit auslagern.
- **Gelöschte Nachrichten** bleiben als Zeile (`deletedAt`), der Text wird nicht geleert (Moderation/Audit). Bei DSGVO-Löschwunsch Body überschreiben — Entscheidung offen.
- **Kein Verlauf bearbeiteter Texte**; „bearbeitet“-Marker genügt (Auftrag verlangt nichts anderes).
- **Mobile Chat:** Kanal-Select + Tab-Bar wie im Screenflow; Touch-Ziele ≥ 44 px per CSS.
- **Spieldaten-Schritt 1 offen** (Netz blockiert). Blockiert auch Kosten/Nutzen in Dorf-Dashboard und KI-Tipps. Rechtliche Anfrage an Travian Games (To-do Max) weiterhin offen.
- **Mockup „Dörferstatistik-Upload“** auf der Übersicht ist ein generischer Screenshot-Upload ohne Dorfbezug (`villageId` leer); die Zuordnung der Dörfer aus dem Bild folgt mit der echten Pipeline.
- **Spieldaten-Seite ist für alle mit `map.view` sichtbar** (nur lesen); Bearbeiten (`gamedata.edit`) hat noch keine Oberfläche, weil es noch keine Daten gibt.
- **Produktion/h in der Dörfertabelle** zeigt „–“, bis Ressourcen-Screenshots ausgewertet werden.
- **Scraper für Spieldaten (halbjährlich):** vom Nutzer gewünscht; weicht vom Auftrag ab („kein fortlaufendes Scraping“). Voraussetzungen: Erlaubnis/Klärung mit Travian Games (To-do Max), Datenstruktur aus `probe-knowledgebase.ts`; dann Cron im Worker (`GAMEDATA_REFRESH_CRON`, standardmäßig aus), höflich (robots.txt, Pausen, Kennung) und mit Diff-Bericht statt automatischem Überschreiben.
- **Session-Report:** statt in `projectos-reporter` (nicht im Session-Scope) unter `docs/reports/` abgelegt. Bei Bedarf manuell ins Report-Repo kopieren (Frontmatter nach CLAUDE.md ergänzen).
- **Docker-Build** konnte hier nicht ausgeführt werden (kein Docker-Daemon); die Build-Env-Korrektur wurde per `next build` ohne `.env` verifiziert. Erster echter `docker compose build` bitte aufmerksam beobachten.
- **Screenshot-Erkennung (offen):** Muster fehlen für Kampfberichte-Varianten, Gebäudeansicht-Details (Slot/Name), Hospital/Ausbildung mit Inhalt, andere Völker/Sprachen; „Truppen in Dörfern“ und Kampfbericht werden gelesen, aber noch nicht in den Dorfzustand übernommen. Einheitennamen sind Spaltenpositionen, bis Spieldaten je Volk vorliegen. Die Produktionstabelle (Desktop) gibt Getreide brutto an, Dorfzustand speichert brutto getrennt (`productionGross`).
- **Datenschutz Lernmodus:** bestätigte Screenshots werden als Beispiele an die Anthropic-API gesendet (auch bei Lesungen anderer Mitglieder). Hinweis in Nutzungsbedingungen/Onboarding aufnehmen; Beispiel-Bilder enthalten Dorfnamen/Koordinaten.
- **Laufzeit Upload:** Erkennung läuft synchron (2 Durchläufe, ca. 20–60 s); Reverse-Proxy braucht `proxy_read_timeout ≥ 180s (DEPLOY.md: 240s)` für `/api/screenshots`. Später ggf. Warteschlange im Worker.
- **Völker/Einheitennamen:** Das Volk steht je Spieler in der map.sql (`Player.tribe`), die Erkennung bestimmt es nicht. Sie liefert nur den Einheitenplatz 1–10 (+Held) je Spalte; Namen je Volk/Platz kommen aus den Spieldaten (Volk des Spielers + Platz). Bei Unterstützungszeilen („Truppen von X“) ist X der Spieler, dessen Volk gilt.
- **Messenger-Datenschutz:** DMs sind nicht Ende-zu-Ende-verschlüsselt und für DB-Admins technisch lesbar; Hinweis in Onboarding/Nutzungsbedingungen aufnehmen. Offen: Anhänge/Markdown in DMs, Blockieren, Löschen/Aufbewahrungsfristen, Push-Benachrichtigung (E-Mail/Discord).
- **Task-Force-Gründerwechsel:** Gründerrolle ist nicht übertragbar (nur Archivieren); bei Bedarf „Gründer übertragen“ ergänzen.
- **Schedule:** Optional Wiederholungen (täglich/wöchentlich), Erinnerung vor Call, Rundnachricht zusätzlich zum Kanal-Post (war als Option besprochen, noch nicht gebaut).
- **Spieldaten – Stand 2026-10-15:** Die Entwicklungsumgebung erreicht travian.com nicht (DNS/Proxy blockiert); frei im Netz findbare Tabellen sind inoffiziell, versionsgemischt (Legends/Kingdoms) und widersprüchlich → nicht verwendbar. Nächster Schritt: `scripts/probe-knowledgebase.ts` auf dem Server ausführen, Rohdaten zurückgeben, dann Parser + Import. Halbjährlicher Scraper (`GAMEDATA_REFRESH_CRON`) erst danach, mit Welt-Bindung (`lib/world-profile.ts`) und Diff-Bericht statt Überschreiben; Erlaubnis von Travian Games weiterhin offen (To-do Max). Einheitennamen = Volk (aus map.sql) + Einheitenplatz → bis dahin „Einheit N“.
- **Truppen-Spieldaten fehlen:** Die Legends-Wissensdatenbank kennt nur Gebäude und Helden-Ausrüstung. Für Einheitennamen/-werte (je Volk, Platz 1–10) braucht es eine andere Quelle (z. B. Support-Artikel/Hilfe-Seiten) oder eine händisch gepflegte Namensliste (nur Namen, keine Werte). Entscheidung offen.

## 2026-10-15 · i18n (umgesetzt, siehe CHANGELOG)
- Englisch = Basissprache (Spieldaten sind englisch), Deutsch als Übersetzung; Sprache pro Nutzer am Konto, Default aus Browser. Eigener Extraktionsschritt, Pflicht für Beta.

## 2026-10-15 · KI-Advisor
- Advisor ist nur Stub (leere Liste, kein Cron, kein Stream). Offen: Datenbasis (Gebäude, Truppen, Dörfer, map.sql), Lauf 1–2×/Tag im Worker, gespeicherte Tipps + UI, Ausgabe in Nutzersprache (User.locale).

## 2026-10-16 · Redesign
- Nach Umsetzung des Backlogs und Deploy: komplettes Redesign des Tools. Inspiration: Gemini-Logo „HUMANS – Community · Humanity · Support“ (Pergament-Beige, Dunkelblau/Stahl, Gold-Banner, Weizen-Grün/Lorbeer, Keltischer Knoten, warme Sonne). Offen: Logo als Asset (Datei vom Nutzer), Dark/Light, Typografie.

## 2026-10-16 · Backlog
- S3 (Hetzner Object Storage) für Screenshots später anschließen: Bucket + Zugangsdaten in `.env` (siehe docs/DEPLOY.md); Code ist vorbereitet, derzeit lokale Ablage.

- 2026-10-16: Offen (Wunsch): Call-Typen frei anlegbar (z. B. Ressourcen), Ziel-Kanal je neuer Vorlage, optional Direktnachricht je Vorlage; Erwähnungen (@), Antworten eine Ebene tief, Seite „Meine Erwähnungen“ mit Sprung zur Nachricht.


## 2026-10-18 · Backlog-Stand
Erledigt seit 16.10.: S3 (Pflicht), Call-Typen/Vorlagen-Kanal/DM, Erwähnungen/Antworten/„Meine Erwähnungen“, Termin vs. Sendezeit, Tabellen-Prüfung mit Marken auf dem Bild, Kern-Beispiele, Import täglich 0:10 Serverzeit.
Offen:
1. KI-Advisor (Stub): Datenbasis, Lauf 1–2×/Tag im Worker, gespeicherte Tipps + UI, Nutzersprache.
2. Produktionsberechnung: Felder + Gebäudeboni + Gold-25 %-Schalter je Dorf + Oasen; Abgleich mit Screenshot-Produktion.
3. Truppen-Spieldaten (Werte/Unterhalt je Einheit) – Quelle offen; nötig für Getreide-Netto.
4. Erkennung: „Truppen in Dörfern“ und Kampfbericht in den Dorfzustand übernehmen; Upload asynchron (Worker-Warteschlange).
5. Schedule: Wiederholungen, Erinnerung vor Call; Entscheidung „nur für Admins sichtbar?“.
6. Eigene Rolle für enge Bündnispartner (weniger Rechte).
7. Messenger: Anhänge/Markdown, Blockieren, Aufbewahrung, Push (E-Mail/Discord).
8. Task-Force: Gründer übertragen.
9. Datenschutz-Hinweise (Lern-Beispiele an Anthropic-API, DMs nicht E2E) in Onboarding/Nutzungsbedingungen.
10. Deploy-Skript: Prüfung auf Container-Neustarts.
11. Spieldaten-Scraper halbjährlich (Erlaubnis Travian Games offen).
12. Session-Report nach `projectos-reporter` (Pflicht laut CLAUDE.md).

## 2026-10-20 · Menü & E-Mail
- Chat: Kanalliste steht jetzt doppelt (Seitenleiste + Chat-Spalte). Chat-Spalte auf Desktop ausblenden? (Sie enthält „Task-Force anlegen“ und Live-Ungelesen-Zähler; die Seitenleiste zählt nur beim Seitenwechsel.)
- Schedule für Mitglieder/Gäste (nur `schedule.view`) bleibt Hauptpunkt, weil sie keinen Admin-Bereich haben – bestätigen oder Schedule für sie ausblenden.
- `/villages` (alte Route „Meine Dörfer“) leitet weiter aufs größte Dorf; kann später entfallen.
- Live-Ungelesen-Zähler auch in der Seitenleiste (Socket) wäre ein Folgeschritt.

## 2026-10-22 · Betrieb
- Backups liegen im Repo-Verzeichnis auf demselben Datenträger. Besser: Ziel außerhalb (z. B. `/var/backups/ally` oder S3) und Aufbewahrung prüfen (`KEEP_DAYS`).
- Bereits gebaute alte Images enthielten `backups/` inkl. `.env`-Kopien → nach erfolgreichem Deploy mit `docker image prune -af` entfernen; Images nie in eine Registry pushen.
