#!/usr/bin/env bash
# Reversible preparation only: private .env permissions and a validated SQL backup.
# Run from the existing deployment root. The workflow streams the reviewed backup
# helper as base64; it never syncs source or changes credentials/services.
set -euo pipefail
umask 077

DEPLOY_ROOT="$(pwd -P)"
case "$DEPLOY_ROOT" in
  /|/opt|/var|/usr|/root|/home|/etc|/tmp)
    echo "Refusing preparation from a broad system directory." >&2; exit 1 ;;
esac
if [ ! -d ops ] || [ -L ops ] || [ ! -f .env ] || [ -L .env ]; then
  echo "Preparation requires an existing ops directory and regular non-symlink .env." >&2
  exit 1
fi
if [ -n "${COMPOSE_FILE:-}" ]; then
  if [ ! -f "$COMPOSE_FILE" ] || [ -L "$COMPOSE_FILE" ]; then
    echo "The selected compose file must be a regular non-symlink file." >&2; exit 1
  fi
elif [ ! -f docker-compose.yml ] || [ -L docker-compose.yml ]; then
  echo "Preparation requires the existing regular deployment compose file." >&2; exit 1
fi
if [ -e ops/backups ] && { [ ! -d ops/backups ] || [ -L ops/backups ]; }; then
  echo "The backup destination must be a regular directory, never a symlink." >&2; exit 1
fi

# Do not source .env or print its values. This changes permissions only.
chmod 600 -- .env
echo "Environment file permissions are private."

DOCKER_BIN="${DOCKER_BIN:-docker}"
DOCKER_USE_SUDO=0
DOCKER_CMD=("$DOCKER_BIN")
if ! "${DOCKER_CMD[@]}" info >/dev/null 2>&1; then
  if ! command -v sudo >/dev/null 2>&1 || ! sudo -n -- "$DOCKER_BIN" info >/dev/null 2>&1; then
    echo "The existing Docker daemon is unavailable without interactive elevation." >&2; exit 1
  fi
  DOCKER_USE_SUDO=1
  DOCKER_CMD=(sudo -n -- "$DOCKER_BIN")
fi
COMPOSE_ARGS=(compose)
if [ -n "${COMPOSE_FILE:-}" ]; then COMPOSE_ARGS+=(--file "$COMPOSE_FILE"); fi
if [ -n "${COMPOSE_PROJECT_NAME:-}" ]; then COMPOSE_ARGS+=(--project-name "$COMPOSE_PROJECT_NAME"); fi

RUNNING_POSTGRES="$("${DOCKER_CMD[@]}" "${COMPOSE_ARGS[@]}" ps --status running --quiet postgres)"
if [ -z "$RUNNING_POSTGRES" ]; then
  echo "A running existing Postgres service is required; no backup was attempted." >&2; exit 1
fi
DATABASE_BYTES="$("${DOCKER_CMD[@]}" "${COMPOSE_ARGS[@]}" exec -T postgres \
  psql -U konkur -d konkurcom -AtX -v ON_ERROR_STOP=1 \
  -c 'SELECT pg_database_size(current_database());' < /dev/null)"
mkdir -p -- ops/backups
chmod 700 -- ops/backups
AVAILABLE_BYTES="$(df -PB1 "$DEPLOY_ROOT/ops/backups" | awk 'NR == 2 { print $4 }')"
# Eighteen decimal digits keep the 2*x+headroom calculation within signed
# 64-bit Bash arithmetic. Reject NaN, exponent syntax, multiple lines and overflow.
for value in "$DATABASE_BYTES" "$AVAILABLE_BYTES"; do
  if [[ ! "$value" =~ ^(0|[1-9][0-9]{0,17})$ ]]; then
    echo "Database size and available disk must be finite bounded byte counts." >&2; exit 1
  fi
done
REQUIRED_BYTES=$((DATABASE_BYTES * 2 + 100 * 1024 * 1024))
if [ "$AVAILABLE_BYTES" -lt "$REQUIRED_BYTES" ]; then
  echo "Insufficient disk for two database sizes plus 100 MiB; no backup was attempted." >&2
  exit 1
fi
echo "Database size and free-disk safety checks passed."

if [ -z "${PREPARE_BACKUP_BASE64:-}" ] || [[ ! "${PREPARE_BACKUP_SHA256:-}" =~ ^[a-f0-9]{64}$ ]]; then
  echo "A reviewed backup helper and its SHA-256 are required." >&2; exit 1
fi
BACKUP_HELPER=""
cleanup() {
  # Only this invocation's private helper; never old backups or other files.
  if [ -n "$BACKUP_HELPER" ]; then rm -f -- "$BACKUP_HELPER"; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
BACKUP_HELPER="$(mktemp "$DEPLOY_ROOT/ops/.security-backup-XXXXXX.sh")"
printf '%s' "$PREPARE_BACKUP_BASE64" | base64 -d > "$BACKUP_HELPER"
ACTUAL_SHA256="$(sha256sum "$BACKUP_HELPER" | awk '{ print $1 }')"
if [ "$ACTUAL_SHA256" != "$PREPARE_BACKUP_SHA256" ]; then
  echo "The streamed backup helper failed its integrity check." >&2; exit 1
fi
bash -n "$BACKUP_HELPER"
# stdin belongs to the streamed preparation script, not Docker/pg_dump.
DOCKER_BIN="$DOCKER_BIN" DOCKER_USE_SUDO="$DOCKER_USE_SUDO" bash "$BACKUP_HELPER" < /dev/null
echo "Preparation completed: configuration unchanged and private SQL backup validated."
