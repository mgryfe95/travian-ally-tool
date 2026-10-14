#!/usr/bin/env bash
# Update-Deploy: Backup → Code holen → neu bauen → starten → Health prüfen. Aufruf: ./scripts/deploy.sh [branch]
set -euo pipefail
cd "$(dirname "$0")/.."
BRANCH="${1:-main}"

echo "==> Backup"
./scripts/backup.sh
echo "==> Code holen ($BRANCH)"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
echo "==> Bauen und starten (Migrationen laufen beim Start des app-Containers)"
docker compose build
docker compose up -d
echo "==> Health"
for i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then echo "OK: $(curl -fsS http://127.0.0.1:3000/api/health)"; exit 0; fi
  sleep 3
done
echo "FEHLER: Health-Check schlägt fehl. Logs: docker compose logs --tail=100 app" >&2
exit 1
