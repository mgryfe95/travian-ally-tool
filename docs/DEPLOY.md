# Deploy (VPS, Docker Compose) — humans-travian.com

Annahme: Ubuntu 22.04/24.04 oder Debian 12, Root- oder sudo-Zugang, DNS-A-Record `humans-travian.com` (und optional `www`) zeigt auf den Server.

## 0. Ablauf in Kürze
Server vorbereiten → Deploy-Key → Klonen → `.env` → `docker compose up` → Nginx/Apache → TLS → Systemadmin registrieren → Allianzen markieren → Backup-Cron.

## 1. Server vorbereiten
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git nginx certbot python3-certbot-nginx ufw curl
sudo systemctl enable --now docker nginx
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw --force enable
```
(Apache statt Nginx: siehe Abschnitt 6b.) Port 3000 (änderbar über `APP_PORT` in der `.env`, dann auch im Proxy) wird nur an `127.0.0.1` gebunden und ist von außen nicht erreichbar.

## 2. Deploy-Key (Lesezugriff auf das Repo)
```bash
ssh-keygen -t ed25519 -C "deploy-humans-travian" -f ~/.ssh/travian_deploy -N ""
cat >> ~/.ssh/config <<'CFG'
Host github-travian
  HostName github.com
  User git
  IdentityFile ~/.ssh/travian_deploy
  IdentitiesOnly yes
CFG
chmod 600 ~/.ssh/config ~/.ssh/travian_deploy
cat ~/.ssh/travian_deploy.pub     # → bei GitHub: Repo → Settings → Deploy keys → Add deploy key (ohne Schreibrecht)
```
Danach testen: `ssh -T git@github-travian` (erwartet: „Hi mgryfe95/travian-ally-tool!“, danach beendet es sich).
Das passiert **auf dem Server**, im Home-Ordner des Benutzers, der später `git clone`/`deploy.sh` ausführt.

## 3. Klonen
```bash
sudo mkdir -p /opt/travian-ally-tool && sudo chown "$USER": /opt/travian-ally-tool
git clone -b main git@github-travian:mgryfe95/travian-ally-tool.git /opt/travian-ally-tool
cd /opt/travian-ally-tool
```
Solange der PR nicht gemergt ist, statt `main` den Branch `claude/new-session-hlffy1` nehmen (`-b claude/new-session-hlffy1`).

## 4. `.env` erzeugen
```bash
cp .env.example .env
SECRET=$(openssl rand -base64 32); PGPW=$(openssl rand -hex 16); SETUP=$(openssl rand -hex 12)
sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=$SECRET|; \
        s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$PGPW|; \
        s|^DATABASE_URL=.*|DATABASE_URL=postgresql://ally:$PGPW@db:5432/ally|; \
        s|^APP_URL=.*|APP_URL=https://humans-travian.com|; \
        s|^SYSTEMADMIN_EMAILS=.*|SYSTEMADMIN_EMAILS=DEINE@MAIL.DE|; \
        s|^SYSTEMADMIN_SETUP_CODE=.*|SYSTEMADMIN_SETUP_CODE=$SETUP|" .env
chmod 600 .env
echo "Setup-Code für den ersten Admin-Login: $SETUP"     # notieren!
nano .env     # prüfen: TRAVIAN_SERVER_URL, TRAVIAN_ALLIANCE_ID (z. B. 36 oder 36,7), optional SMTP_*
```
Wichtig: `APP_URL` muss exakt die öffentliche URL sein (sonst lehnt die Anmeldung ab). `SYSTEMADMIN_EMAILS` = deine Adresse(n), kommagetrennt.

## 5. Starten
```bash
docker compose build && docker compose up -d
docker compose ps                      # db, app, worker → "healthy"/"running"
docker compose logs -f --tail=50 app worker     # Strg+C beendet nur die Anzeige
curl -s http://127.0.0.1:3000/api/health          # {"status":"ok","db":true,…}
```
Der app-Container migriert die Datenbank beim Start und legt Rechte-Defaults, die 8 Kanäle und Tags an. Der Worker lädt sofort die erste `map.sql` und prüft danach stündlich (`IMPORT_CRON`, Minute :15); importiert wird nur, wenn sich die Datei geändert hat. Travian veröffentlicht map.sql täglich zwischen 23:55 und 0:05 (Serverzeit); zusätzlich holt der Worker sie gezielt um `MAP_RELEASE_TIME` (Standard 00:05) sowie +5 und +15 Minuten in der Zeitzone `GAME_TIMEZONE` (Standard Europe/Berlin – bei anderer Serveruhr anpassen). Erster Import in den Worker-Logs: `[worker] import { status: 'imported', … }`.

**Fehler „port is already allocated“:** Port 3000 ist belegt (`ss -ltnp | grep :3000`). In der `.env` `APP_PORT=3010` setzen, `docker compose up -d` und in den Proxy-Direktiven `3000` → `3010` ändern.

## 6a. Nginx
```bash
sudo tee /etc/nginx/sites-available/humans-travian.com >/dev/null <<'NGINX'
server {
    listen 80;
    server_name humans-travian.com www.humans-travian.com;
    client_max_body_size 210m;                     # Chat-Uploads (10 Dateien à max. 20 MB)

    location /socket.io/ {                         # Realtime-Chat (WebSocket)
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 240s;
    }
}
NGINX
sudo ln -sf /etc/nginx/sites-available/humans-travian.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d humans-travian.com -d www.humans-travian.com --redirect -m DEINE@MAIL.DE --agree-tos -n
```
Certbot ergänzt TLS und die Weiterleitung auf HTTPS und erneuert das Zertifikat automatisch (`systemctl list-timers | grep certbot`).

## 6b. Apache (statt Nginx)
```bash
sudo apt install -y apache2 certbot python3-certbot-apache
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite headers ssl
sudo tee /etc/apache2/sites-available/humans-travian.com.conf >/dev/null <<'APACHE'
<VirtualHost *:80>
    ServerName humans-travian.com
    ServerAlias www.humans-travian.com
    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "http"
    LimitRequestBody 220000000
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule ^/socket.io/(.*) ws://127.0.0.1:3000/socket.io/$1 [P,L]
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
    ProxyTimeout 240
</VirtualHost>
APACHE
sudo a2ensite humans-travian.com && sudo apache2ctl configtest && sudo systemctl reload apache2
sudo certbot --apache -d humans-travian.com -d www.humans-travian.com --redirect -m DEINE@MAIL.DE --agree-tos -n
```
Certbot kopiert den vhost nach 443; dort muss `RequestHeader set X-Forwarded-Proto "https"` stehen (`sudo sed -i 's/"http"/"https"/' /etc/apache2/sites-available/humans-travian.com-le-ssl.conf && sudo systemctl reload apache2`).

## 7. Erster Login und Einrichtung
1. `https://humans-travian.com/register` → Anzeigename, E-Mail aus `SYSTEMADMIN_EMAILS`, Passwort (≥ 10 Zeichen), aufklappen „Setup-Code“ → den Code von oben eintragen. Du bist damit Systemadmin.
2. **Admin → Allianzen:** deine Allianz(en) als „Eigene Allianz“, verbündete als „Allianz“ markieren (oder gleich `TRAVIAN_ALLIANCE_ID=36,7` in der `.env`).
3. **Admin → Mitglieder & Einladungen:** „Alle Uneingeladenen: Links erzeugen“ → IGM-Texte kopieren und ingame verschicken (nur jetzt sichtbar!).
4. Optional SMTP in `.env` (dann `docker compose up -d`), damit „Passwort vergessen?“ funktioniert.

## 8. Backup einrichten
```bash
./scripts/backup.sh                                   # Testlauf → ./backups/
( crontab -l 2>/dev/null; echo '30 3 * * * cd /opt/travian-ally-tool && ./scripts/backup.sh >> /var/log/ally-backup.log 2>&1' ) | crontab -
```
Das sichert Datenbank-Dump, Chat-Anhänge und `.env` (14 Tage, `KEEP_DAYS` änderbar). Kopiere `./backups` zusätzlich regelmäßig **außerhalb** des Servers (z. B. `rsync`). Wiederherstellen: `docker compose exec -T db pg_restore -U ally -d ally --clean --if-exists < backups/db-….dump` und `docker compose exec -T app tar xzf - -C /app/storage < backups/storage-….tar.gz`.

## 9. Updates
```bash
cd /opt/travian-ally-tool && git pull && ./scripts/deploy.sh
```
Das Skript sichert zuerst (Datenbank, Dateien, `.env`), holt den Code, baut, startet (Migrationen laufen beim Start) und prüft danach selbst: Container gesund, Health-Check, Migrationen, Login-Seite im neuen Design, Anmelde-Endpunkt (antwortet auf falsche Zugangsdaten statt zu hängen), Chat-API, Worker, Kartendaten, Spieldaten, Fehler in den Logs. Am Ende steht **„✔ Deployment erfolgreich“** oder **„✘ Deployment fehlgeschlagen“** mit den Gründen und den letzten App-Logzeilen. Der Lauf geschieht im Hintergrund und überlebt einen SSH-Abbruch; das Ergebnis zeigt danach `./scripts/deploy.sh --status`, Details stehen in `deploy.log`. Anderer Branch: `./scripts/deploy.sh <branch>` (Standard: der aktuell ausgecheckte).

## 10. Spielwelt endet / neue Welt
- Ist `map.sql` ~36 Stunden in Folge nicht abrufbar, markiert der Worker die Welt als **beendet**: oben erscheint ein Hinweis, der Stand bleibt als Archiv sichtbar, Chat und Konten funktionieren weiter. Kommt die Datei wieder, setzt sich der Status automatisch zurück.
- **Neue Welt:** `./scripts/backup.sh`, dann in der `.env` `TRAVIAN_SERVER_URL` und `TRAVIAN_ALLIANCE_ID` anpassen und
  `docker compose exec app npx tsx scripts/new-world.ts --confirm && docker compose up -d --force-recreate`.
  Das leert Karte, Statistik, Ereignisse, Verknüpfungen, Einladungen, Allianz-Typen und Dörfer-Daten; Konten, Rollen, Rechte und Chat bleiben. Normale Member werden zu Gästen und verknüpfen sich neu (Einladung/Dorfname). Moderatoren/Admins behalten ihre Rolle.

## 11. Spieldaten-Wissensdatenbank (Analyse)
Der Server hat Internet, meine Entwicklungsumgebung nicht. Deshalb dort ausführen:
```bash
docker compose exec app npx tsx scripts/probe-knowledgebase.ts
docker compose cp app:/app/storage/gamedata-raw ./gamedata-raw && tar czf gamedata-raw.tgz gamedata-raw
```
`gamedata-raw.tgz` (enthält `REPORT.md` + Rohseiten) zurückgeben; daraus baue ich den Parser. Import danach nur manuell: `docker compose exec app npx tsx scripts/import-gamedata.ts datei.json` (Format: `docs/gamedata-format.md`). Ein halbjährlicher Abruf (Cron im Worker) ist vorgesehen, sobald Struktur und Erlaubnis von Travian Games geklärt sind.

## Fehlersuche
| Symptom | Prüfen |
| --- | --- |
| 502 vom Proxy | `docker compose ps`, `docker compose logs --tail=100 app` |
| Anmeldung „Invalid origin“ | `APP_URL` exakt wie die Browser-URL (https, ohne Slash am Ende) |
| Chat lädt, aber kein Live-Update | Nginx-Block `/socket.io/` bzw. Apache-`RewriteRule` für WebSocket |
| Uploads brechen ab | `client_max_body_size` / `LimitRequestBody` |
| Keine Inaktiven | brauchen ≥ `INACTIVE_DAYS`+1 Tagesstände (ca. 4 Tage nach dem ersten Import) |
| Import-Fehler | `docker compose logs worker`, `curl -I $TRAVIAN_SERVER_URL/map.sql` |

## Screenshots in S3 (optional)
Privaten Bucket anlegen (kein öffentlicher Zugriff; Zugriffsschlüssel nur mit Lesen/Schreiben/Löschen auf diesen Bucket) und in der `.env` eintragen: `S3_BUCKET_SCREENSHOTS`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, bei Nicht-AWS zusätzlich `S3_ENDPOINT` (MinIO: `S3_FORCE_PATH_STYLE=true`). Danach `docker compose up -d`. Neue Screenshots landen im Bucket, ältere lokale bleiben les- und löschbar. Die Auslieferung läuft weiter über die App (Rechteprüfung), der Bucket bleibt privat.
