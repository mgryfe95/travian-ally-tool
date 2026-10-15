# Admin-Kurzanleitung

## Start
`cp .env.example .env`, Werte setzen (`AUTH_SECRET` mit `openssl rand -base64 32`, `SYSTEMADMIN_EMAILS`, `TRAVIAN_ALLIANCE_ID=36`), `docker compose up -d`. Health: `/api/health`.

## E-Mail-Versand (Passwort vergessen)
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` in der `.env` setzen. Ohne `SMTP_HOST` zeigt „Passwort vergessen?“ nur einen Hinweis. Der Reset-Link ist eine Stunde gültig, einmalig und beendet alle Sitzungen. Ob eine Adresse existiert, wird nie verraten.

## Erster Login (Systemadmin)
Unter `/register` mit einer Adresse aus `SYSTEMADMIN_EMAILS` registrieren. Dafür ist der **Setup-Code** nötig (`SYSTEMADMIN_SETUP_CODE`, sonst der Wert von `AUTH_SECRET`), damit niemand die Admin-Adresse vorab belegen kann. SYSTEMADMIN gilt nur, solange die Adresse in der ENV-Liste steht; er ist im UI nicht änderbar.

## Allianz-Gruppe festlegen (Admin → Allianzen)
Allianzen, die zusammengehören, als **Eigene Allianz** oder **Allianz** markieren. Alle so markierten bilden zusammen die „eigene Gruppe“ und zählen überall als eine Allianz (Einladungen, Abgleich, Inaktiven-Suche blendet sie aus).

## Mitglieder einladen (Admin → Mitglieder)
1. Der Abgleich listet alle Spieler der Gruppe und ob sie ein verifiziertes Konto haben.
2. Bei Spielern ohne Konto auf **Einladung** klicken → der fertige IGM-Text mit Einmal-Link erscheint **nur jetzt** (7 Tage gültig). Kopieren und ingame schicken.
3. Wer den Link einlöst und sich registriert, ist sofort **verifiziert** und **Member**.
4. Ohne Einladung registrierte Nutzer sind **Gast**. Unter „Mein Konto“ beanspruchen sie einen Spieler und bekommen einen Code `ALLY-XXXX`, den sie als Teil eines Dorfnamens setzen. Nach dem nächsten Kartenimport werden sie automatisch verifiziert. Alternativ bestätigt ein Moderator unter „Ausstehende Verifizierungen“.
5. Duals sind erlaubt (mehrere Konten pro Spieler).
6. Verlässt ein Spieler die Gruppe, erscheint sein Konto unter „Konten außerhalb der Gruppe“ (nur Markierung, keine Sperre).

## Rollen & Rechte
Rollen: SYSTEMADMIN > ADMIN > MODERATOR > MEMBER > GUEST. ADMIN vergibt Rollen unterhalb von ADMIN; ADMINs ernennt nur SYSTEMADMIN. Die Rechte-Matrix (Admin → Rechte) ist editierbar; `permissions.edit` und `roles.assign` der Rolle ADMIN ändert nur SYSTEMADMIN. Alle Änderungen stehen im Audit-Log.

## Chat (Admin → Kanäle & Tags)
- **Kanäle:** Die 8 Standardkanäle (Deff-Call, Deff-Reports, Off-Call, Off-Reports, Ressources, Settlement, Sitter, Mixed topics) lassen sich umbenennen, sortieren (↑/↓) und archivieren; neue Kanäle legst du unten an. Je Kanal gilt „lesen ab“ und „schreiben ab“ (Gast/Member/Moderator/Admin). Gäste sehen nur Kanäle mit „lesen ab = Gast“ (Standard: Mixed topics). Recht: `settings.edit`.
- **Tags:** Name + Farbe aus einem vorgegebenen Farbsatz (Kontrast garantiert). Recht: `tags.manage`. Tags sind optional, 0..n pro Nachricht (im Chat Standard: einer).
- **Sammelraum „Alle“:** zeigt Nachrichten aller Allianz-Kanäle, die du lesen darfst; Task-Forces erscheinen dort nie. Beim Schreiben im Sammelraum muss ein Kanal gewählt werden.
- **Task-Forces:** „+“ in der Kanalliste (Recht `taskforce.create`). Es entsteht ein eigener Kanal nur für Mitglieder (Admins sehen alle). Leads und Admins verwalten Mitglieder unter „Verwalten“ im Kanalkopf; archivieren blendet die Task-Force aus.
- **Anhänge:** 📎, Drag & Drop oder Strg+V (Screenshots), bis zu 10 Dateien pro Nachricht. Erlaubt: PNG, JPG, WebP, GIF, PDF, TXT/CSV/LOG (Bild max. 10 MB, sonst 20 MB; per ENV änderbar). Bilder werden ohne EXIF/Metadaten neu gespeichert, Vorschau und Lightbox inklusive. Dateien sind nur für Leser des Kanals abrufbar. Recht: `chat.upload` (Member aufwärts). Nicht gesendete Uploads werden nach 24 h automatisch gelöscht.
- **Moderation:** Eigene Nachrichten bearbeiten/löschen; mit `chat.moderate` auch fremde löschen (Anhänge werden mitgelöscht, im Audit-Log vermerkt).

## Truppenübersicht (Admin/Moderator)
Unter **Truppen** (Recht `troops.view`, Standard: Moderator und Admin) sehen Moderatoren und Admins die Truppen aller Mitglieder der Allianz-Gruppe mit Summen je Einheit, je Mitglied und je Dorf; veraltete Stände sind markiert (Schwelle `staleDays`, Standard 2 Tage). Grundlage sind die Stände, die Mitglieder im Dorf-Dashboard eintragen (später per Screenshot-Erkennung). Mitglieder werden darauf hingewiesen (Einladungsseite und Dorf-Dashboard); jede Einsicht steht im Audit-Log. Das Recht lässt sich in der Rechte-Matrix ändern.

## Screenshots (Erkennung & Lernmodus)
Unter **Screenshots** lädst du Bilder hoch (oder Strg+V). Art und Gerät werden erkannt. Am Anfang prüfst du jede Lesung: **„Stimmt, übernehmen“** oder mit Häkchen **„Werte korrigieren“** (JSON anpassen). Jede Bestätigung wird zum Lernbeispiel. Nach `VISION_LEARNING_MIN` (Standard 10) bestätigten Screenshots einer Art werden sehr sichere Lesungen automatisch übernommen; auffällige (Summen passen nicht, Dorf nicht zuordenbar) landen weiter in der Prüfung. Emojis/Kürzel für die KI: `npx tsx scripts/vision-alias.ts add "<Begriff>" "<Bedeutung>"`.

## Konto direkt einem Spieler zuordnen
**Admin → Konten:** In der Spalte „Spieler“ den Travian-Spieler der eigenen Gruppe wählen und **Zuordnen** (Recht `members.approve`, Moderator+). Das Konto gilt sofort als verifiziert (Gäste werden Mitglied), der Vorgang steht im Audit-Log. Gilt auch für Systemadmins.

## Tag-Typen & Tags (Admin → Kanäle & Tags)
Ein **Tag-Typ** ist eine Achse wie „Priorität“ oder „Status“ mit eigenen Tags. Je Typ legst Du fest: **ein Tag** (Einzelauswahl) oder **mehrere**, **Pflicht** (Nachricht braucht ein Tag dieses Typs), **Task-Forces** (auch in Task-Force-Kanälen anbieten) und die **Kanäle**, in denen er gilt. Beim Schreiben erscheinen nur die Typen des gewählten Kanals. Ein Typ lässt sich löschen, sobald er keine Tags mehr hat. Vorhandene Tags liegen im Typ „Kategorie“ (Einzelauswahl, alle Allianz-Kanäle).

## Allianz-Schedule (Calls)
Menü **Schedule** (alle Mitglieder sehen die anstehenden Calls). Admins (`schedule.manage`) legen Calls an: **Art** (Angriff, Deff-Unterstützung, Angriffstag, Sonstiges), **Koordinaten** `x|y`, optional **Zeit** (MEZ/MESZ) – leer = „auf Abruf“, nur per **Jetzt senden**. Spieler, Dorf und Link zur Spielerseite werden aus den Koordinaten ermittelt (letzte map.sql). Der Text kommt aus einer **Vorlage** (unten auf der Seite editierbar, Platzhalter `{art} {titel} {spieler} {dorf} {koordinaten} {zeit} {link} {notiz}`) und wird in den Kanal der Vorlage gepostet (überschreibbar). Geplante Calls sendet der Server automatisch (Prüfung alle 30 s). Abbrechen/Löschen jederzeit vor dem Senden.
