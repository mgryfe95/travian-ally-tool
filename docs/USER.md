# Admin-Kurzanleitung

## Start
`cp .env.example .env`, Werte setzen (`AUTH_SECRET` mit `openssl rand -base64 32`, `SYSTEMADMIN_EMAILS`, `TRAVIAN_ALLIANCE_ID=36`), `docker compose up -d`. Health: `/api/health`.

## E-Mail-Versand (Passwort vergessen)
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` in der `.env` setzen. Ohne `SMTP_HOST` zeigt „Passwort vergessen?“ nur einen Hinweis. Der Reset-Link ist eine Stunde gültig, einmalig und beendet alle Sitzungen. Ob eine Adresse existiert, wird nie verraten.

## Erster Login (Admin)
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
Rollen: ADMIN > MODERATOR > MEMBER > GUEST. Admins sind gleichberechtigt: Sie haben immer alle Rechte, vergeben und ändern jede Rolle (auch andere Admins) und bearbeiten die Rechte-Matrix (Admin → Rechte) für Moderator, Mitglied und Gast. Nicht möglich: das eigene Konto sperren/löschen. Adressen in `SYSTEMADMIN_EMAILS` (.env) sind ein Notzugang: Diese Konten sind immer Admin und lassen sich nicht sperren oder löschen – so kommst du im Zweifel wieder an. Alle Änderungen stehen im Audit-Log.

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

## Task-Forces: Einladungen und Rollen
Wer eine Task-Force anlegt, ist **Gründer**. Im Kanal **Task-Force › Verwalten** lädt der Gründer (oder ein **Lead**) Allianzmitglieder ein; sie sehen die Einladung oben im Chat und **nehmen an oder lehnen ab** – erst nach Annahme sehen sie den Kanal. Rollen: **Gründer** (alles, nicht entfernbar), **Lead** (einladen, Mitglieder/Leser entfernen), **Mitglied** (lesen und schreiben), **Leser** (nur lesen). **Rollen ändert nur der Gründer** (Admins als Notausgang); auch das Archivieren ist dem Gründer vorbehalten. Mitglieder können die Task-Force selbst verlassen.

## Nachrichten (Messenger)
Menü **Nachrichten** (getrennt von den Kanälen, mit Ungelesen-Zähler in der Navigation). **Direkt:** 1:1-Unterhaltungen mit allen Mitgliedern (Gäste ausgeschlossen); „Neue Nachricht an …“ wählen, Enter sendet. **Rundnachrichten:** Moderatoren und Admins schreiben an alle Mitglieder, ab einer Rolle, eine Task-Force oder eine Auswahl. Empfänger lesen sie im Tab „Rundnachrichten“ und können per **Antworten** dem Absender eine Direktnachricht schicken (kein Antwort-an-alle). Absender sehen unter „Gesendet“, wie viele die Nachricht gelesen haben. Neue Nachrichten erscheinen live.

## Meine Bilder & Dateien
Link „Meine Bilder & Dateien“ links unten unter Deinem Namen. Dort siehst Du alle eigenen Screenshots und Chat-Anhänge mit Vorschau, Größe und Verwendung und kannst sie löschen (Screenshots samt daraus entstandener Lern-Beispiele). Bilder werden beim Hochladen komprimiert (WebP, ohne Metadaten; Screenshots in voller Auflösung, ca. 70–80 % kleiner). Screenshots löscht das System nach `SCREENSHOT_RETENTION_DAYS` (Standard 30) Tagen, außer sie sind Lern-Beispiele.

## Sprache
Unten in der Seitenleiste (und auf der Anmeldeseite) lässt sich zwischen Englisch und Deutsch wechseln. Die Wahl wird am Konto gespeichert; ohne Wahl gilt die Browsersprache, sonst Englisch.

## Speicherplatz
Jeder Nutzer hat 50 MB für Screenshots und Chat-Dateien. Unter „Meine Bilder & Dateien“ siehst du die Belegung und kannst Dateien löschen; im Chat bleibt dann der Hinweis „Datei vom Uploader entfernt“. Screenshots siehst du nur selbst (Admins ausgenommen).

## Registrierung & Verifizierung
Registrieren können sich nur Spieler unserer Allianz(en) und enger Bündnispartner (Admin → Allianzen → Typ „Enger Bündnispartner“). Nach dem Login sehen unverifizierte Konten nur die Verifizierungsseite: Dorf in den angezeigten Code umbenennen, dann „Verlinkung nachweisen“. Neue Kartendaten gibt es etwa einmal täglich; der Knopf prüft sofort, was schon da ist. Moderatoren können manuell bestätigen (Admin → Konten/Mitglieder).

## Schedule: Termin, Sendezeit, Typen, Vorlagen
- **Termin** = wann der Angriff/Ereignis stattfindet (steht als `{zeit}` im Text). **Nachricht senden am** = wann der Call in den Kanal gepostet wird; leer = nur auf Knopfdruck (einmal möglich).
- **Bearbeiten/Absagen:** Ändert oder sagt man einen schon gesendeten Call ab, meldet das Tool das automatisch im Kanal; optional zusätzlich als Rundmail (nur mit SMTP).
- **Call-Typen:** eigene Typen (z. B. Ressourcen) unter „Call-Typen“ anlegen, dann Vorlagen dafür erstellen (Ziel-Kanal wählbar, optional zusätzlich als Direktnachricht).

## Chat: Erwähnungen und Antworten
- `@Name` erwähnt jemanden (Leerzeichen im Namen als `_`; beim Tippen von `@` erscheint eine Auswahl). Erwähnte sehen die Nachricht unter **Meine Erwähnungen** (Profilmenü) und springen mit einem Klick direkt zur Nachricht.
- **Antworten** (Knopf an der Nachricht) gehen eine Ebene tief; die Zitatzeile springt zum Original.
- Tags werden nach Tag-Typ gruppiert angezeigt.
- Screenshots: Kontingent 50 MB; das Bild wird nach der Auswertung gelöscht (nur Lern-Beispiele bleiben, max. 30 je Art).

