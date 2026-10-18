#!/usr/bin/env bash
# Update-Deploy mit Prüfbericht. Aufruf im Projektordner:  ./scripts/deploy.sh [branch]
#   ./scripts/deploy.sh --status   zeigt das Ergebnis des letzten Laufs (z. B. nach einem SSH-Abbruch)
# Der Lauf selbst geschieht im Hintergrund (überlebt einen Verbindungsabbruch); das Terminal zeigt Fortschritt und am Ende
# ein Ergebnis mit Haken je Prüfung. Details stehen in deploy.log.
set -uo pipefail
cd "${ALLY_ROOT:-$(dirname "$0")/..}"
LOG="deploy.log"; RESULT="deploy.result"
if [ -t 1 ]; then G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; B=$'\e[1m'; N=$'\e[0m'; else G=; R=; Y=; B=; N=; fi

if [ "${1:-}" = "--status" ]; then cat "$RESULT" 2>/dev/null || echo "Noch kein Ergebnis vorhanden."; exit 0; fi

if [ "${1:-}" != "--run" ]; then
  BRANCH_ARG="${1:-}"
  : > "$LOG"; rm -f "$RESULT"
  # Kopie ausführen: `git pull` darf das laufende Skript nicht unter den Füßen ändern
  cp "$0" .deploy-run.sh
  ALLY_ROOT="$(pwd)" nohup bash .deploy-run.sh --run "$BRANCH_ARG" >> "$LOG" 2>&1 &
  PID=$!
  echo "Deploy läuft im Hintergrund (Log: $LOG). Bei Verbindungsabbruch später: ./scripts/deploy.sh --status"
  # Fortschritt anzeigen, bis der Lauf fertig ist
  tail -n +1 -f "$LOG" --pid="$PID" 2>/dev/null | awk '/^═/{exit} {print; fflush()}'
  while kill -0 "$PID" 2>/dev/null; do sleep 1; done
  cat "$RESULT" 2>/dev/null
  grep -q "Deployment erfolgreich" "$RESULT" 2>/dev/null
  exit $?
fi

# ───────────────────────── eigentlicher Lauf ─────────────────────────
BRANCH="${2:-$(git rev-parse --abbrev-ref HEAD)}"
START_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
FAILS=(); WARNS=(); OUT=""
say()  { printf '%s\n' "$*"; }
step() { say "▶ $*"; }
ok()   { say "  ✔ $*"; }
bad()  { say "  ✘ $*"; FAILS+=("$*"); }
warn() { say "  ⚠ $*"; WARNS+=("$*"); }
detail() { printf '%s\n' "$1" | sed 's/^/     /' | head -"${2:-12}"; }

fatal() {  # Abbruch während der Schritte: Bericht + Ende
  bad "$1"
  [ -n "${2:-}" ] && detail "$2" 25
  finish
}

finish() {
  {
    say "═══════════════════════════════════════════════"
    if [ ${#FAILS[@]} -eq 0 ]; then
      say "  ${G}${B}✔ Deployment erfolgreich${N}  ($(git rev-parse --short HEAD) · $BRANCH)"
      [ ${#WARNS[@]} -gt 0 ] && { say "  Hinweise:"; for w in "${WARNS[@]}"; do say "   - $w"; done; }
    else
      say "  ${R}${B}✘ Deployment fehlgeschlagen${N}"
      say "  Gründe:"; for f in "${FAILS[@]}"; do say "   - $f"; done
      say "  Letzte App-Logzeilen:"; docker compose logs --tail=25 app 2>&1 | sed 's/^/     /'
      say "  Rollback: git checkout <vorheriger-commit> && docker compose build && docker compose up -d   (Backup in ./backups)"
    fi
    say "═══════════════════════════════════════════════"
  } | tee "$RESULT"
  [ ${#FAILS[@]} -eq 0 ]; exit $?
}

# 1. Backup
step "Backup"
if OUT=$(./scripts/backup.sh 2>&1); then ok "Datenbank, Dateien und .env gesichert"; else warn "Backup fehlgeschlagen – weiter ohne frisches Backup"; detail "$OUT"; fi

# 2. Code
step "Code holen ($BRANCH)"
OLD=$(git rev-parse --short HEAD)
OUT=$(git fetch origin "$BRANCH" 2>&1) || fatal "git fetch fehlgeschlagen" "$OUT"
OUT=$(git checkout "$BRANCH" 2>&1 && git pull --ff-only origin "$BRANCH" 2>&1) || fatal "git pull fehlgeschlagen (lokale Änderungen oder abweichender Verlauf?)" "$OUT"
NEW=$(git rev-parse --short HEAD)
[ "$OLD" = "$NEW" ] && ok "Stand $NEW (keine neuen Commits)" || ok "$OLD → $NEW"

# 2b. S3 ist Pflicht (Screenshots) – vor dem Bauen prüfen
step "S3-Speicher (Pflicht)"
envval() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- | sed 's/[[:space:]]#.*$//' | tr -d '"'"'"; }
S3_MISSING=""; for k in S3_BUCKET_SCREENSHOTS S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY; do [ -z "$(envval $k)" ] && S3_MISSING="$S3_MISSING $k"; done
[ -z "$S3_MISSING" ] && ok "S3 in .env konfiguriert (Bucket $(envval S3_BUCKET_SCREENSHOTS))" || fatal "S3 nicht konfiguriert – in .env fehlen:$S3_MISSING" "Ohne S3 startet die App nicht. Siehe .env.example (S3_ENDPOINT, S3_REGION, S3_FORCE_PATH_STYLE)."

# 3. Bauen und starten
step "Bauen (dauert einige Minuten)"
OUT=$(docker compose build 2>&1) || fatal "Build fehlgeschlagen" "$(printf '%s\n' "$OUT" | tail -25)"
ok "Images gebaut"
step "Starten (Migrationen laufen beim Start)"
OUT=$(docker compose up -d --wait --wait-timeout 240 2>&1) || fatal "Container sind nicht gesund geworden" "$(printf '%s\n' "$OUT" | tail -15)"
ok "Container laufen"

# 4. Prüfungen
PORT=$(grep -E '^APP_PORT=' .env 2>/dev/null | head -1 | cut -d= -f2 | cut -d" " -f1); PORT=${PORT:-3000}
BASE="http://127.0.0.1:$PORT"
APP_URL=$(grep -E '^APP_URL=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')
step "Prüfungen"
restarts() { CID=$(docker compose ps -q "$1" 2>/dev/null); [ -n "$CID" ] && docker inspect -f '{{.RestartCount}}' "$CID" 2>/dev/null || echo 0; }
declare -A RC0; for svc in app worker; do RC0[$svc]=$(restarts "$svc"); done; RC_T0=$(date +%s)

S3T=$(docker compose exec -T app node -e '
const {S3Client,HeadBucketCommand}=require("@aws-sdk/client-s3");
const e=process.env;
new S3Client({region:e.S3_REGION,endpoint:e.S3_ENDPOINT||undefined,forcePathStyle:e.S3_FORCE_PATH_STYLE==="true",credentials:{accessKeyId:e.S3_ACCESS_KEY_ID,secretAccessKey:e.S3_SECRET_ACCESS_KEY}})
 .send(new HeadBucketCommand({Bucket:e.S3_BUCKET_SCREENSHOTS})).then(()=>console.log("ok"),(x)=>{console.log("FEHLER "+(x.name||"")+" "+(x.message||""));process.exit(1)})' 2>&1 | tr -d '\r' | tail -1)
[ "$S3T" = "ok" ] && ok "S3-Bucket erreichbar" || bad "S3-Bucket nicht erreichbar: $S3T"

for svc in db app worker; do
  CID=$(docker compose ps -q "$svc" 2>/dev/null)
  ST=$( [ -n "$CID" ] && docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}-{{end}}' "$CID" 2>/dev/null || echo "fehlt")
  case "$ST" in "running healthy"|"running -") ok "Container $svc: $ST";; *) bad "Container $svc: $ST";; esac
done

H=$(curl -fsS -m 10 "$BASE/api/health" 2>&1) && { echo "$H" | grep -q '"db":true' && ok "Health-Check: Datenbank erreichbar" || bad "Health-Check meldet Datenbank-Problem: $H"; } || bad "Health-Check nicht erreichbar ($BASE/api/health)"

MS=$(docker compose exec -T app npx prisma migrate status 2>&1 | tr -d '\r')
echo "$MS" | grep -q "up to date" && ok "Datenbank-Migrationen: aktuell ($(echo "$MS" | grep -oE '[0-9]+ migrations found' | head -1))" || { bad "Datenbank-Migrationen nicht aktuell"; detail "$MS" 8; }

CODE=$(curl -s -m 15 -o /tmp/ally-login.html -w '%{http_code} %{time_total}' "$BASE/login")
[ "${CODE%% *}" = "200" ] && grep -qi "humans" /tmp/ally-login.html && ok "Login-Seite liefert das neue Design (HTTP 200, ${CODE#* } s)" || bad "Login-Seite: HTTP ${CODE%% *} (erwartet 200 mit Humans-Design)"
ASSET=$(grep -oE '/_next/static/[^"]+\.(js|css)' /tmp/ally-login.html | head -1)
[ -n "$ASSET" ] && [ "$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$BASE$ASSET")" = "200" ] && ok "Statische Dateien (JS/CSS) werden ausgeliefert" || bad "Statische Dateien nicht erreichbar ($ASSET)"

RC=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$BASE/")
case "$RC" in 307|302|303) ok "Startseite leitet ohne Anmeldung auf den Login (HTTP $RC)";; *) bad "Startseite ohne Anmeldung: HTTP $RC (erwartet Weiterleitung)";; esac

AC=$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -H "origin: ${APP_URL:-$BASE}" -d '{"email":"deploy-check@invalid.local","password":"x"}' "$BASE/api/auth/sign-in/email")
case "$AC" in 400|401|403|422|429) ok "Anmelde-Endpunkt antwortet (falsche Zugangsdaten → HTTP $AC)";; *) bad "Anmelde-Endpunkt: HTTP $AC (erwartet 401 für falsche Zugangsdaten; 000 = hängt/Timeout)";; esac

CC=$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{"channelId":1,"body":"x"}' "$BASE/api/chat/messages")
[ "$CC" = "401" ] && ok "Chat-API verlangt Anmeldung (HTTP 401)" || bad "Chat-API ohne Anmeldung: HTTP $CC (erwartet 401)"

docker compose logs --since "$START_TS" worker 2>&1 | grep -q "\[worker\] started" && ok "Worker gestartet (Zeitplan aktiv)" || warn "Worker meldet keinen Start in den Logs"

SQL() { docker compose exec -T db psql -U ally -d ally -tAc "$1" 2>/dev/null | tr -d '\r'; }
SNAP=$(SQL 'SELECT count(*) FROM "Snapshot"'); AGE=$(SQL "SELECT COALESCE(round(extract(epoch FROM (now()-max(\"fetchedAt\")))/3600),-1) FROM \"Snapshot\"")
if [ "${SNAP:-0}" -gt 0 ] 2>/dev/null; then
  [ "${AGE%%.*}" -le 36 ] 2>/dev/null && ok "Kartendaten: $SNAP Stände, letzter vor ca. ${AGE%%.*} h" || warn "Letzte Kartendaten sind ${AGE%%.*} h alt (Worker-Logs prüfen)"
else warn "Noch keine Kartendaten importiert (Worker-Logs prüfen)"; fi
GD=$(SQL "SELECT (SELECT count(*) FROM \"Building\") || ' Gebäude, ' || (SELECT count(*) FROM \"BuildingLevelEffect\") || ' Vorteile, ' || (SELECT count(*) FROM \"UnitName\") || ' Einheitennamen'")
ok "Spieldaten: ${GD:-nicht lesbar}"

ERRS=$(docker compose logs --since "$START_TS" app worker 2>&1 | grep -iE "error|unhandled|ECONNREFUSED|P1001|P2021|P2022" | grep -viE "npm notice|0 errors|prisma:warn" | head -5)
[ -z "$ERRS" ] && ok "Keine Fehler in den Logs seit dem Start" || { warn "Fehlerzeilen in den Logs seit dem Start:"; detail "$ERRS" 5; }

# Neustart-Schleifen erkennen: Container, die nach dem Start (wieder) abstürzen, starten Docker neu und zählen hoch
WAIT=$(( 25 - ($(date +%s) - RC_T0) )); [ "$WAIT" -gt 0 ] && sleep "$WAIT"
for svc in app worker; do
  RC1=$(restarts "$svc")
  [ "${RC1:-0}" -gt "${RC0[$svc]:-0}" ] 2>/dev/null && bad "Container $svc startet wiederholt neu (Neustarts: ${RC0[$svc]} → $RC1) – Logs prüfen" || ok "Container $svc läuft stabil (keine Neustarts seit dem Start)"
done

finish
