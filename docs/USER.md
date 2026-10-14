# Admin-Kurzanleitung

## Start
`cp .env.example .env`, Werte setzen (`AUTH_SECRET` mit `openssl rand -base64 32`, `SYSTEMADMIN_EMAILS`, `TRAVIAN_ALLIANCE_ID=36`), `docker compose up -d`. Health: `/api/health`.

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

Kanäle und Tags: folgen mit M4.
