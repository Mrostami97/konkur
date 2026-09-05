#!/usr/bin/env bash
# Restores a backup produced by backup.sh into the compose Postgres database.
# Usage: ops/restore.sh ops/backups/konkurcom-<timestamp>.sql.gz
set -euo pipefail

cd "$(dirname "$0")/.."

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-backup.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "This will DROP and recreate the 'konkurcom' database. Press Ctrl+C to abort, Enter to continue."
read -r _

docker compose exec -T postgres psql -U konkur -d postgres -c "
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity
  WHERE datname = 'konkurcom' AND pid <> pg_backend_pid();
"
docker compose exec -T postgres psql -U konkur -d postgres -c "DROP DATABASE IF EXISTS konkurcom;"
docker compose exec -T postgres psql -U konkur -d postgres -c "CREATE DATABASE konkurcom;"
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U konkur -d konkurcom

echo "Restore complete from $BACKUP_FILE"
