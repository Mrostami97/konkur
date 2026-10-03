#!/usr/bin/env bash
# Planned, site-local PostgreSQL / MinIO password rotation. No builds, pulls or volume removal.
set -euo pipefail
umask 077

if [ "${ROTATE_INTERNAL_CREDENTIALS:-0}" != 1 ]; then
  echo "Set ROTATE_INTERNAL_CREDENTIALS=1 for the reviewed internal credential rotation." >&2
  exit 1
fi
ROOT="$(pwd -P)"
case "$ROOT" in /|/opt|/var|/usr|/root|/home|/etc|/tmp) echo "An existing deployment directory is required." >&2; exit 1 ;; esac
for path in .env ops ops/backups; do
  if [ ! -e "$path" ] || [ -L "$path" ]; then echo "Private preparation is required before rotation." >&2; exit 1; fi
done
if [ "$(stat -c '%a:%u' .env)" != "600:$(id -u)" ] || [ "$(stat -c '%a:%u' ops/backups)" != "700:$(id -u)" ]; then
  echo "Private, current-user-owned configuration and backup directory are required." >&2; exit 1
fi
COMPOSE_PATH="${COMPOSE_FILE:-$ROOT/docker-compose.yml}"
HELPER_PATH="${ROTATION_HELPER_PATH:-$ROOT/ops/rotate-internal-credentials.mjs}"
VALIDATOR_PATH="${ROTATION_VALIDATOR_PATH:-$ROOT/scripts/check-production-config.mjs}"
for path in "$COMPOSE_PATH" "$HELPER_PATH" "$VALIDATOR_PATH"; do
  if [[ "$path" != /* ]] || [ ! -f "$path" ] || [ -L "$path" ]; then echo "Reviewed regular helper and Compose files are required." >&2; exit 1; fi
done
DOCKER_BIN="${DOCKER_BIN:-docker}"
DOCKER_CMD=("$DOCKER_BIN")
if ! "${DOCKER_CMD[@]}" info >/dev/null 2>&1; then
  if ! sudo -n -- "$DOCKER_BIN" info >/dev/null 2>&1; then echo "The existing Docker daemon is unavailable." >&2; exit 1; fi
  DOCKER_CMD=(sudo -n -- "$DOCKER_BIN")
fi
# A caller's ambient credential variables must not override the reviewed .env.
docker_private() {
  timeout --signal=TERM --kill-after=5s 20s env -i "PATH=$PATH" "HOME=$HOME" "DOCKER_HOST=${DOCKER_HOST:-}" "DOCKER_CONTEXT=${DOCKER_CONTEXT:-}" \
    "DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}" "COMPOSE_DISABLE_ENV_FILE=1" "DOCKER_CLI_HINTS=false" \
    "${DOCKER_CMD[@]}" "$@"
}
INITIAL=(compose --project-directory "$ROOT" --file "$COMPOSE_PATH" --env-file "$ROOT/.env")
if [ -n "${COMPOSE_PROJECT_NAME:-}" ]; then INITIAL+=(--project-name "$COMPOSE_PROJECT_NAME"); fi
LOCK="$ROOT/ops/backups/.credential-rotation.lock"
exec 9>"$LOCK"
if ! flock --nonblock 9; then echo "Another rotation requires local review." >&2; exit 1; fi
STATE="$(mktemp -d "$ROOT/ops/backups/.credential-rotation-XXXXXX")"
chmod 700 "$STATE"
LOG="$STATE/private.log"
: > "$LOG"
MUTATED=0
PHASE=preflight
ENV_TMP=""
PROJECT=""
CURRENT=()
OLD=()

atomic_env() {
  ENV_TMP="$(mktemp "$ROOT/.env.rotation-XXXXXX")" || return 1
  cp -- "$1" "$ENV_TMP" || return 1
  chmod 600 "$ENV_TMP" || return 1
  mv -Tf -- "$ENV_TMP" "$ROOT/.env" || return 1
  ENV_TMP=""
}
wait_services() {
  local attempt service cid status deadline=$((SECONDS + 90))
  for attempt in $(seq 1 45); do
    local ready=1
    for service in postgres minio; do
      [ "$SECONDS" -lt "$deadline" ] || return 1
      cid="$(docker_private "${CURRENT[@]}" ps --quiet "$service" 2>>"$LOG")" || return 1
      [ -n "$cid" ] || { ready=0; continue; }
      status="$(docker_private inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>>"$LOG")" || return 1
      [[ "$status" = healthy || "$status" = running ]] || ready=0
    done
    [ "$ready" -eq 1 ] && return 0
    sleep 2
  done
  return 1
}
probe_api() {
  local source="$1" output="$2" attempt
  for attempt in $(seq 1 3); do
    if docker_private "${CURRENT[@]}" exec -T api node < "$source" > "$output" 2>>"$LOG"; then return 0; fi
    sleep 2
  done
  return 1
}
wait_api() {
  local attempt deadline=$((SECONDS + 90))
  for attempt in $(seq 1 45); do
    [ "$SECONDS" -lt "$deadline" ] || return 1
    if docker_private "${CURRENT[@]}" exec -T api node -e '
      const http = require("node:http");
      const timer = setTimeout(() => process.exit(1), 5000);
      const request = http.get("http://127.0.0.1:3001/healthz", response => {
        response.resume(); clearTimeout(timer); process.exit(response.statusCode === 200 ? 0 : 1);
      });
      request.on("error", () => process.exit(1));
    ' < /dev/null >>"$LOG" 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}
storage_admin_check() {
  docker_private "${CURRENT[@]}" exec -T minio sh -ec '
    umask 077
    check_dir=$(mktemp -d /tmp/minio-credential-check-XXXXXX)
    trap '\''rm -rf -- "$check_dir"'\'' EXIT
    cat > "$check_dir/config.json"
    mc --config-dir "$check_dir" --json admin user list rotation
    mc --config-dir "$check_dir" --json admin policy list rotation
  ' < "$1" > "$2" 2>>"$LOG"
}
rollback() {
  docker_private "${CURRENT[@]}" stop api >>"$LOG" 2>&1 || return 1
  atomic_env "$STATE/.env.old" || return 1
  CURRENT=("${OLD[@]}")
  docker_private "${CURRENT[@]}" up -d --no-deps --no-build --pull never --force-recreate postgres minio >>"$LOG" 2>&1 || return 1
  wait_services || return 1
  docker_private "${CURRENT[@]}" exec -T postgres psql -U konkur -d konkurcom -X -v ON_ERROR_STOP=1 < "$STATE/pg-rollback.sql" >>"$LOG" 2>&1 || return 1
  docker_private "${CURRENT[@]}" up -d --no-deps --no-build --pull never --force-recreate api >>"$LOG" 2>&1 || return 1
  wait_api || return 1
  probe_api "$STATE/probe-rollback.cjs" "$STATE/rollback-check.json" || return 1
  storage_admin_check "$STATE/mc-config.old.json" "$STATE/iam-rollback.json" || return 1
  offline check-iam-rollback || return 1
}
finish() {
  local code=$?
  trap - EXIT INT TERM
  if [ "$code" -ne 0 ]; then
    if [ "$MUTATED" -eq 1 ]; then
      if rollback; then echo "Rotation failed during $PHASE; original configuration, database credential and service access restored." >&2
      else echo "Rotation failed during $PHASE; automatic recovery failed. Keep the private rotation state and perform local recovery." >&2; fi
    else echo "Rotation preflight failed during $PHASE; credentials were not changed." >&2; fi
  fi
  if [ -n "$ENV_TMP" ]; then rm -f -- "$ENV_TMP"; fi
  flock --unlock 9
  exit "$code"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cp -- "$ROOT/.env" "$STATE/.env.old"
chmod 600 "$STATE/.env.old"
IDS=()
for service in postgres minio api; do
  cid="$(docker_private "${INITIAL[@]}" ps --status running --quiet "$service" 2>>"$LOG")"
  if [[ ! "$cid" =~ ^[a-f0-9]{12,64}$ ]]; then exit 1; fi
  IDS+=("$cid")
done
docker_private inspect "${IDS[@]}" > "$STATE/containers.json" 2>>"$LOG"
PROJECT="$(docker_private inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "${IDS[2]}" 2>>"$LOG")"
API_IMAGE="$(docker_private inspect --format '{{.Image}}' "${IDS[2]}" 2>>"$LOG")"
[[ "$PROJECT" =~ ^[a-z0-9][a-z0-9_-]*$ ]] && [[ "$API_IMAGE" =~ ^sha256:[a-f0-9]{64}$ ]]
BASE=(compose --project-directory "$ROOT" --project-name "$PROJECT" --file "$COMPOSE_PATH" --env-file "$ROOT/.env")
CURRENT=("${BASE[@]}")
docker_private "${CURRENT[@]}" config --format json > "$STATE/compose-existing.json" 2>>"$LOG"
docker_private "${CURRENT[@]}" exec -T minio sh -ec '
  for credential_file in "$MINIO_ROOT_USER_FILE" "$MINIO_ROOT_PASSWORD_FILE" "$MINIO_ACCESS_KEY_FILE" "$MINIO_SECRET_KEY_FILE" "$MINIO_KMS_SECRET_KEY_FILE" "$MINIO_CONFIG_ENV_FILE"; do
    if [ -n "$credential_file" ] && [ -e "$credential_file" ]; then exit 1; fi
  done
' < /dev/null >>"$LOG" 2>&1
offline() {
  docker_private run --rm --pull never --network none --user "$(id -u):$(id -g)" --entrypoint node \
    --mount "type=bind,src=$STATE,dst=/state" \
    --mount "type=bind,src=$HELPER_PATH,dst=/helper/ops/rotate-internal-credentials.mjs,readonly" \
    --mount "type=bind,src=$VALIDATOR_PATH,dst=/helper/scripts/check-production-config.mjs,readonly" \
    "$API_IMAGE" /helper/ops/rotate-internal-credentials.mjs "$1" /state >>"$LOG" 2>&1
}
PHASE=offline-plan
offline plan

PHASE=backup-validation
SQL_BACKUP="${ROTATION_SQL_BACKUP:-}"
if [ -z "$SQL_BACKUP" ]; then
  SQL_BACKUP="$(find "$ROOT/ops/backups" -maxdepth 1 -type f -name 'konkurcom-*.sql.gz' -mmin -120 -printf '%T@ %p\n' | sort -nr | awk 'NR == 1 {sub(/^[^ ]+ /, ""); print}')"
fi
if [[ "$SQL_BACKUP" != "$ROOT/ops/backups/"* ]] || [ ! -f "$SQL_BACKUP" ] || [ -L "$SQL_BACKUP" ] \
  || [ "$(stat -c '%a:%u' "$SQL_BACKUP")" != "600:$(id -u)" ]; then exit 1; fi
age=$(( $(date +%s) - $(stat -c '%Y' "$SQL_BACKUP") ))
[ "$age" -ge 0 ] && [ "$age" -le 7200 ]
gzip -t "$SQL_BACKUP" >>"$LOG" 2>&1
gzip -cd "$SQL_BACKUP" | awk '/^-- PostgreSQL database dump$/ { start=1 } /^-- PostgreSQL database dump complete$/ { end=1 } END { exit !(start && end && NR>10) }' >>"$LOG" 2>&1
docker_private "${CURRENT[@]}" exec -T minio minio --version < /dev/null > "$STATE/minio-version.txt" 2>>"$LOG"
grep -q 'RELEASE.2025-09-07T16-13-09Z' "$STATE/minio-version.txt"
media_kib="$(docker_private "${CURRENT[@]}" exec -T minio du -sk /data < /dev/null 2>>"$LOG" | awk '{print $1}')"
available="$(df -PB1 "$STATE" | awk 'NR == 2 {print $4}')"
sql_bytes="$(stat -c '%s' "$SQL_BACKUP")"
for value in "$media_kib" "$available" "$sql_bytes"; do [[ "$value" =~ ^(0|[1-9][0-9]{0,14})$ ]]; done
[ "$available" -gt $((media_kib * 2048 + sql_bytes * 2 + 104857600)) ]

PHASE=existing-access
storage_admin_check "$STATE/mc-config.old.json" "$STATE/iam-before.json"
docker_private "${CURRENT[@]}" exec -T api node < "$STATE/probe-before.cjs" > "$STATE/baseline.json" 2>>"$LOG"
docker_private "${CURRENT[@]}" exec -T postgres psql -U konkur -d konkurcom -AtX -v ON_ERROR_STOP=1 \
  -c "SELECT rolpassword FROM pg_authid WHERE rolname = 'konkur';" < /dev/null > "$STATE/pg-verifier.old" 2>>"$LOG"
offline prepare
OLD=("${BASE[@]}" --file "$STATE/compose.old.json")
NEXT=("${BASE[@]}" --file "$STATE/compose.next.json")
docker_private "${NEXT[@]}" config --quiet >>"$LOG" 2>&1
echo "Existing administrator, storage access, private SQL backup and disk checks passed."

PHASE=media-backup
MUTATED=1
docker_private "${CURRENT[@]}" stop api minio >>"$LOG" 2>&1
timeout --signal=TERM --kill-after=5s 120s "${DOCKER_CMD[@]}" cp "${IDS[1]}:/data" - 2>>"$LOG" | gzip > "$STATE/minio-data.tar.gz"
gzip -t "$STATE/minio-data.tar.gz" >>"$LOG" 2>&1
tar -tzf "$STATE/minio-data.tar.gz" > "$STATE/minio-data.entries" 2>>"$LOG"
[ -s "$STATE/minio-data.tar.gz" ] && [ -s "$STATE/minio-data.entries" ]
# A legacy root-encrypted backend requires an independently planned migration.
if grep -Eq '(^|/)(config-encrypted|backend-encrypted)(/|$)' "$STATE/minio-data.entries"; then exit 1; fi

PHASE=database-password
# PostgreSQL volume initialization variables do not rotate an existing role.
# Send a SCRAM verifier over stdin; plaintext passwords never enter SQL or argv.
docker_private "${CURRENT[@]}" exec -T postgres psql -U konkur -d konkurcom -X -v ON_ERROR_STOP=1 \
  < "$STATE/pg-forward.sql" >>"$LOG" 2>&1
PHASE=environment-replacement
atomic_env "$STATE/.env.new"
CURRENT=("${NEXT[@]}")
PHASE=service-restart
docker_private "${CURRENT[@]}" up -d --no-deps --no-build --pull never --force-recreate postgres minio >>"$LOG" 2>&1
wait_services
storage_admin_check "$STATE/mc-config.new.json" "$STATE/iam-after.json"
offline check-iam-after
docker_private "${CURRENT[@]}" up -d --no-deps --no-build --pull never --force-recreate api >>"$LOG" 2>&1
PHASE=access-verification
wait_api
probe_api "$STATE/probe-after.cjs" "$STATE/after-check.json"
MUTATED=0
echo "Internal database and storage credentials rotated; existing administrator credential and stored object verified; old credentials rejected."
echo "Private rollback state and media backup retained locally under ops/backups."
