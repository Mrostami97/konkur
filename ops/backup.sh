#!/usr/bin/env bash
# Dumps the compose Postgres database to a private, validated, atomic backup.
set -euo pipefail
umask 077

cd "$(dirname "$0")/.."

# Keep executable paths and arguments separate, including an optional sudo.
DOCKER_BIN="${DOCKER_BIN:-docker}"
DOCKER_CMD=("$DOCKER_BIN")
case "${DOCKER_USE_SUDO:-0}" in
  0) ;;
  1) DOCKER_CMD=(sudo -- "$DOCKER_BIN") ;;
  *) echo "DOCKER_USE_SUDO must be 0 or 1." >&2; exit 1 ;;
esac
COMPOSE_ARGS=(compose)
# Explicit argv survives sudo's environment filtering and the script's cd.
if [ -n "${COMPOSE_FILE:-}" ]; then COMPOSE_ARGS+=(--file "$COMPOSE_FILE"); fi
if [ -n "${COMPOSE_PROJECT_NAME:-}" ]; then COMPOSE_ARGS+=(--project-name "$COMPOSE_PROJECT_NAME"); fi

BACKUP_DIR="ops/backups"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
TMP_FILE=""
cleanup() {
  # Only this invocation's temporary file; never another backup or media file.
  if [ -n "$TMP_FILE" ]; then rm -f -- "$TMP_FILE"; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
TMP_FILE="$(mktemp "${BACKUP_DIR}/.konkurcom-${TIMESTAMP}-XXXXXX.tmp")"
TMP_NAME="${TMP_FILE##*/}"
OUT_FILE="${BACKUP_DIR}/${TMP_NAME#.}"
OUT_FILE="${OUT_FILE%.tmp}.sql.gz"

"${DOCKER_CMD[@]}" "${COMPOSE_ARGS[@]}" exec -T postgres pg_dump -U konkur -d konkurcom | gzip > "$TMP_FILE"
test -s "$TMP_FILE"
gzip -t "$TMP_FILE"
if [ "$(gzip -cd "$TMP_FILE" | wc -c)" -eq 0 ]; then
  echo "Backup failed: pg_dump produced no SQL." >&2
  exit 1
fi
test ! -e "$OUT_FILE"
mv -- "$TMP_FILE" "$OUT_FILE"
TMP_FILE=""

echo "Backup written to $OUT_FILE"
