#!/usr/bin/env bash
# Dumps the compose Postgres database to ops/backups/<timestamp>.sql.gz
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="ops/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${BACKUP_DIR}/konkurcom-${TIMESTAMP}.sql.gz"

docker compose exec -T postgres pg_dump -U konkur -d konkurcom | gzip > "$OUT_FILE"

echo "Backup written to $OUT_FILE"
