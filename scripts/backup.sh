#!/usr/bin/env bash
# Backup: Postgres-Dump + Chat-Anhänge (Volume "storage"). Aufruf im Projektordner: ./scripts/backup.sh [Zielordner]
# Cron-Beispiel (täglich 03:30, 14 Tage behalten):  30 3 * * * cd /opt/travian-ally-tool && ./scripts/backup.sh >> /var/log/ally-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
DEST="${1:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%dT%H%M)"
mkdir -p "$DEST"

docker compose exec -T db pg_dump -U ally -Fc ally > "$DEST/db-$STAMP.dump"
# Anhänge (Volume "storage") direkt aus dem laufenden app-Container streamen
docker compose exec -T app tar czf - -C /app/storage . > "$DEST/storage-$STAMP.tar.gz"
cp .env "$DEST/env-$STAMP.bak" && chmod 600 "$DEST/env-$STAMP.bak"

find "$DEST" -type f \( -name 'db-*.dump' -o -name 'storage-*.tar.gz' -o -name 'env-*.bak' \) -mtime +"$KEEP_DAYS" -delete
echo "Backup fertig: $DEST ($STAMP)"
