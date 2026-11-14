# Entscheidungsvorlage Betrieb · 03./04.11.2026

Projekt `travian-ally-tool` · Notion-Root `3f912988-7097-813a-be0b-e9ee8831f987` · Stand 02.11.2026

Je Punkt: Ist-Stand, Optionen, Empfehlung, Aufwand. Bitte je Punkt eine Option ankreuzen oder kommentieren.

---

## 13 · Backups

**Ist-Stand:** Nur die **Screenshots** liegen auf S3 (Hetzner Object Storage, Pflicht in Produktion). `scripts/backup.sh` legt **Datenbank-Dump, Chat-Anhänge und eine `.env`-Kopie** weiterhin unter `./backups` im Projektordner ab, also auf derselben Platte wie der Server. Fällt die Platte aus, sind Server und Backups gleichzeitig weg.

**Optionen:**
- [ ] **A (empfohlen):** Backups zusätzlich in einen eigenen S3-Bucket hochladen (z. B. `ally-backups`, eigener Schlüssel nur mit Schreibrecht). Den Upload übernimmt `backup.sh` per `rclone` oder `aws s3 cp`. Lokal bleiben nur noch 3 Tage, in S3 30 Tage.
- [ ] B: Backups auf eine zweite Platte bzw. Hetzner Storage Box (rsync).
- [ ] C: so lassen.

**Aufwand:** A ≈ 1 h (Skript, Bucket, `.env`-Variablen). **Kosten:** ein Dump ist wenige MB groß und liegt im Grundpreis von Hetzner S3.

**Hinweis:** Die `.env`-Kopie enthält Geheimnisse. In S3 nur verschlüsselt ablegen (`gpg`/`age`), oder die `.env` getrennt sichern.

---

## 14 · Reverse-DNS (PTR) für den Mailserver

**Ist-Stand:** Mails gehen über `mails.ryfe.de` (Port 465). Ob der PTR-Eintrag der Server-IP auf genau diesen Namen zeigt, ist ungeprüft. Ohne passenden PTR landen Mails bei Gmail/Outlook eher im Spam; bei der ersten Gmail-Mail war genau das ein Problem.

**Optionen:**
- [ ] **A (empfohlen):** Beim Hoster (Hetzner Robot/Cloud → IP → Reverse DNS) den PTR auf `mails.ryfe.de` setzen. Zusätzlich SPF, DKIM und DMARC prüfen, z. B. mit mail-tester.com.
- [ ] B: externer Mailversand (z. B. Brevo/Mailjet, kostenlos bis ca. 300 Mails/Tag), dann ist PTR egal.

**Aufwand:** A ≈ 15 min plus DNS-Wartezeit. Prüfen mit `dig -x <server-ip>`, das Ergebnis muss `mails.ryfe.de.` sein.

---

## 15 · Call-Typen nach dem Deploy freigeben

**Ist-Stand:** Seit heute regelt „Wer darf welchen Call-Typ senden?“ im Kalender **zwei Dinge**: das Senden aus Incidents **und** das Anlegen im Kalender durch Mitglieder. Ohne Freigabe dürfen nur Admins/Moderatoren mit Schedule-Recht senden. Der System-Call „Angriff melden“ läuft unabhängig davon automatisch.

**Vorschlag zum Ankreuzen:**
- [ ] Deff-Unterstützung: ab **Mitglied**
- [ ] Angriff: nur mit Schedule-Recht
- [ ] Angriffstag: nur mit Schedule-Recht
- [ ] Sonstiges: ab **Mitglied**
- [ ] eigene Typen (z. B. Ressourcen): ab **Mitglied**

**Aufwand:** 2 min im Kalender (Admin) nach dem Deploy.

---

## 16 · Hilfevideos und PDF mit echten Daten

**Ist-Stand:** Videos (`public/help/*.webm`) und PDF (`/help/pdf`) zeigen Testdaten. Deshalb findet die Inaktivensuche nichts, und es erscheint der Hinweis „keine KI eingerichtet“.

**Optionen:**
- [ ] **A (empfohlen):** einmalige Aufnahme gegen eine **Kopie** der Produktivdaten auf einer Staging-Instanz mit anonymisierten Spielernamen. Die Aufnahme läuft automatisiert (`npm run help:videos`, PDF per Skript).
- [ ] B: gegen die Produktion mit einem Demo-Konto aufnehmen. Das ist schneller, zeigt aber echte Namen und Truppen.
- [ ] C: so lassen, bis sich die Oberfläche nicht mehr stark ändert.

**Aufwand:** A ≈ 2 h (Staging-DB, Anonymisierung, Aufnahme). Ich würde **C bis zum Ende der aktuellen Umbauten** und danach A empfehlen.

---

## 17 · Hetzner-Preise prüfen

**Ist-Stand:** Unter „KI & Kosten“ steht: 1 TB im Grundpreis enthalten, 8,70 € je weiterem TB-Monat. Die Werte stammen aus Sekundärquellen. Das Tool erinnert alle 6 Monate an die Prüfung.

**Optionen:**
- [ ] **A (empfohlen):** offizielle Preisliste (hetzner.com → Object Storage) öffnen, Werte im Tab „KI & Kosten“ eintragen und „Preise geprüft“ klicken.
- [ ] B: so lassen. Bei der aktuellen Nutzung (wenige GB) wirkt sich das auf das Budget praktisch nicht aus.

**Aufwand:** 5 min.

---

## 18 · Session-Report nach `projectos-reporter`

**Ist-Stand:** Laut CLAUDE.md ist am Ende jeder Session ein Report im Repo `projectos-reporter` Pflicht. Das Repo ist in dieser Cloud-Session nicht freigegeben, deshalb liegen die Reports bisher unter `docs/reports/` (bzw. fehlen seit dem Zurückstellen).

**Optionen:**
- [ ] **A (empfohlen):** `projectos-reporter` für die Session freigeben (GitHub-Zugriff der Claude-App). Dann schreibe ich einen Sammelreport für alle Sessions seit dem 20.10.
- [ ] B: Reports weiter unter `docs/reports/` sammeln; du kopierst sie bei Bedarf rüber.
- [ ] C: Pflicht für dieses Projekt aus CLAUDE.md streichen.

**Aufwand:** A ≈ 20 min nach der Freigabe.

---

## Weitere offene Punkte aus der heutigen Runde (zur Info / Entscheidung)

- **Discord-Push für Direktnachrichten:** nicht gebaut. E-Mail-Hinweise gibt es jetzt (Opt-in unter „Mein Konto“). Discord bräuchte einen Webhook bzw. Bot je Nutzer. → [ ] bauen [ ] nicht nötig
- **Aufbewahrungsfrist Direktnachrichten:** technisch da (`DM_RETENTION_DAYS`), Standard **aus**. Vorschlag: 180 Tage. → [ ] 180 [ ] anders: ___ [ ] aus lassen
- **Spieldaten-Abgleich:** gebaut, Standard **aus**. Einschalten mit `GAMEDATA_REFRESH_CRON="15 4 1 1,7 *"` (1. Januar und 1. Juli), **erst nach Erlaubnis von Travian Games**. Ergebnis ist nur ein Bericht auf der Spieldaten-Seite; übernommen wird von Hand.
