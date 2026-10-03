#!/usr/bin/env bash
# Disable only an unused host RPC listener after proving the site is healthy.
set -euo pipefail
umask 077

if [ "${RPC_HARDENING:-0}" != 1 ]; then
  echo "Set RPC_HARDENING=1 for the reviewed unused-RPC service change." >&2
  exit 1
fi
ROOT="$(pwd -P)"
case "$ROOT" in /|/opt|/var|/usr|/root|/home|/etc|/tmp) echo "An existing deployment directory is required." >&2; exit 1 ;; esac
ETC_DIR=/etc
PROC_DIR=/proc
if [ "${RPC_HARDENING_FIXTURE:-0}" = 1 ]; then
  # The isolated test container supplies only these explicitly selected paths.
  FIXTURE_ROOT="${RPC_FIXTURE_ROOT:-}"
  case "$FIXTURE_ROOT" in /tmp/rpcbind-hardening-fixture-*) ;; *) echo "Invalid isolated fixture directory." >&2; exit 1 ;; esac
  if [ -L "$FIXTURE_ROOT" ] || [ "$(cd "$FIXTURE_ROOT" && pwd -P)" != "$FIXTURE_ROOT" ] || [ "$ROOT" != "$FIXTURE_ROOT/project" ] \
    || [ -L "$FIXTURE_ROOT/.rpcbind-hardening-fixture" ] || [ "$(cat "$FIXTURE_ROOT/.rpcbind-hardening-fixture")" != isolated-rpcbind-fixture ]; then
    echo "An explicit isolated fixture marker is required." >&2; exit 1
  fi
  ETC_DIR="$FIXTURE_ROOT/etc"
  PROC_DIR="$FIXTURE_ROOT/proc"
  for tool in id systemctl ss curl findmnt rpcinfo; do
    if [ ! -f "$FIXTURE_ROOT/bin/$tool" ] || [ -L "$FIXTURE_ROOT/bin/$tool" ] || [ ! -x "$FIXTURE_ROOT/bin/$tool" ]; then
      echo "An isolated fixture command is unavailable." >&2; exit 1
    fi
  done
  ID_BIN="$FIXTURE_ROOT/bin/id"
  SYSTEMCTL="$FIXTURE_ROOT/bin/systemctl"
  SS_BIN="$FIXTURE_ROOT/bin/ss"
  CURL_BIN="$FIXTURE_ROOT/bin/curl"
  FINDMNT_BIN="$FIXTURE_ROOT/bin/findmnt"
  RPCINFO_BIN="$FIXTURE_ROOT/bin/rpcinfo"
else
  if [ "${RPC_HARDENING_FIXTURE:-0}" != 0 ] || [ -n "${RPC_FIXTURE_ROOT:-}" ]; then
    echo "Fixture selectors require the explicit isolated fixture mode." >&2; exit 1
  fi
  PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
  export PATH
  for tool in id systemctl ss curl findmnt rpcinfo; do command -v "$tool" >/dev/null || { echo "A required host inspection command is unavailable; no services changed." >&2; exit 1; }; done
  ID_BIN="$(command -v id)"
  SYSTEMCTL="$(command -v systemctl)"
  SS_BIN="$(command -v ss)"
  CURL_BIN="$(command -v curl)"
  FINDMNT_BIN="$(command -v findmnt)"
  RPCINFO_BIN="$(command -v rpcinfo)"
fi
for tool in stat mktemp flock timeout awk grep find; do command -v "$tool" >/dev/null || { echo "A required local inspection command is unavailable." >&2; exit 1; }; done
if [ "$("$ID_BIN" -u)" != 0 ]; then echo "Root access is required; no services changed." >&2; exit 1; fi
for file in .env ops ops/backups; do
  if [ ! -e "$file" ] || [ -L "$file" ]; then echo "Private deployment preparation is required." >&2; exit 1; fi
done
if [ ! -f .env ] || [ ! -d ops ] || [ ! -d ops/backups ] || [ "$(stat -c '%a:%u' .env)" != 600:0 ] || [ "$(stat -c '%a:%u' ops/backups)" != 700:0 ]; then
  echo "Private root-owned configuration and backup directory are required." >&2; exit 1
fi
LOCK="$ROOT/ops/backups/.rpcbind-hardening.lock"
if [ -L "$LOCK" ] || { [ -e "$LOCK" ] && { [ ! -f "$LOCK" ] || [ "$(stat -c '%a:%u' "$LOCK")" != 600:0 ]; }; }; then
  echo "The private operation lock requires local review." >&2; exit 1
fi
exec 9>"$LOCK"
if ! flock --nonblock 9; then echo "Another RPC service operation is active; no services changed." >&2; exit 1; fi
STATE="$(mktemp -d "$ROOT/ops/backups/.rpcbind-hardening-XXXXXX")"
chmod 700 "$STATE"
: > "$STATE/errors.txt"
: > "$STATE/actions.txt"
: > "$STATE/unit-state.tsv"
PHASE=configuration
MUTATED=0
QUERY_COUNT=0
declare -A ORIGINAL_ACTIVE ORIGINAL_ENABLED
RPC_UNITS=(rpcbind.socket rpcbind.service)

query_unit() {
  local unit="$1" line key value keys=0
  [[ "$unit" =~ ^[A-Za-z0-9_.@:-]+\.(service|socket|target|mount|automount|timer|path|scope|slice)$ ]] || return 1
  QUERY_COUNT=$((QUERY_COUNT + 1))
  [ "$QUERY_COUNT" -le 96 ] || return 1
  LOAD="" ACTIVE="" ENABLED="" REQUIRED="" WANTED="" CONSISTS="" BOUND="" PROPAGATES="" TRIGGERED=""
  local output="$STATE/unit-$QUERY_COUNT.txt"
  timeout --signal=TERM --kill-after=2s 10s "$SYSTEMCTL" --system show --property=LoadState,ActiveState,UnitFileState,RequiredBy,WantedBy,ConsistsOf,BoundBy,PropagatesStopTo,TriggeredBy -- "$unit" > "$output" 2>> "$STATE/errors.txt" || return 1
  declare -A seen=()
  while IFS= read -r line || [ -n "$line" ]; do
    key="${line%%=*}"; value="${line#*=}"
    [ "$key" != "$line" ] && [ -z "${seen[$key]:-}" ] || return 1
    seen[$key]=1
    case "$key" in LoadState) LOAD="$value" ;; ActiveState) ACTIVE="$value" ;; UnitFileState) ENABLED="$value" ;; RequiredBy) REQUIRED="$value" ;; WantedBy) WANTED="$value" ;; ConsistsOf) CONSISTS="$value" ;; BoundBy) BOUND="$value" ;; PropagatesStopTo) PROPAGATES="$value" ;; TriggeredBy) TRIGGERED="$value" ;; *) return 1 ;; esac
    keys=$((keys + 1))
  done < "$output"
  [ "$keys" -eq 9 ] || return 1
}
inactive_consumer() {
  # Enabled consumers could restart RPC after boot even if idle at inspection.
  [ "$LOAD" = loaded ] && [ "$ACTIVE" = inactive ] && [[ "$ENABLED" = disabled || "$ENABLED" = static ]]
}
missing_unit() {
  [ "$LOAD" = not-found ] && [ "$ACTIVE" = inactive ] && [ -z "$ENABLED$REQUIRED$WANTED$CONSISTS$BOUND$PROPAGATES$TRIGGERED" ]
}
health_ok() {
  local prefix="$1" status
  status="$(timeout --signal=TERM --kill-after=2s 20s "$CURL_BIN" --silent --show-error --fail --connect-timeout 5 --max-time 15 --max-filesize 524288 \
    --noproxy '*' --resolve "$DOMAIN:443:127.0.0.1" --output "$STATE/$prefix-health.json" --write-out '%{http_code}' "https://$DOMAIN/api/healthz" 2>> "$STATE/errors.txt")" || return 1
  [ "$status" = 200 ] || return 1
  grep -Eq '^[[:space:]]*\{[[:space:]]*"status"[[:space:]]*:[[:space:]]*"ok"[[:space:]]*[,}]' "$STATE/$prefix-health.json" || return 1
  status="$(timeout --signal=TERM --kill-after=2s 20s "$CURL_BIN" --silent --show-error --fail --connect-timeout 5 --max-time 15 --max-filesize 524288 \
    --noproxy '*' --resolve "$DOMAIN:443:127.0.0.1" --output "$STATE/$prefix-home.html" --write-out '%{http_code}' "https://$DOMAIN/" 2>> "$STATE/errors.txt")" || return 1
  [ "$status" = 200 ] && [ -s "$STATE/$prefix-home.html" ]
}
snapshot_ports() {
  local prefix="$1" flag
  for flag in -ltn4 -ltn6 -lun4 -lun6; do
    timeout --signal=TERM --kill-after=2s 10s "$SS_BIN" -H "$flag" 'sport = :111' > "$STATE/$prefix-$flag.txt" 2>> "$STATE/errors.txt" || return 1
  done
}
restore_original() {
  local unit ok=1
  for unit in "${RPC_UNITS[@]}"; do
    if [ "${ORIGINAL_ACTIVE[$unit]}" = inactive ]; then timeout --signal=TERM --kill-after=2s 20s "$SYSTEMCTL" --system stop -- "$unit" >> "$STATE/actions.txt" 2>&1 || ok=0; fi
  done
  for unit in "${RPC_UNITS[@]}"; do
    if [ "${ORIGINAL_ENABLED[$unit]}" = enabled ]; then timeout --signal=TERM --kill-after=2s 20s "$SYSTEMCTL" --system enable -- "$unit" >> "$STATE/actions.txt" 2>&1 || ok=0; fi
  done
  for unit in "${RPC_UNITS[@]}"; do
    if [ "${ORIGINAL_ENABLED[$unit]}" = disabled ]; then timeout --signal=TERM --kill-after=2s 20s "$SYSTEMCTL" --system disable -- "$unit" >> "$STATE/actions.txt" 2>&1 || ok=0; fi
  done
  for unit in "${RPC_UNITS[@]}"; do
    if [ "${ORIGINAL_ACTIVE[$unit]}" = active ]; then timeout --signal=TERM --kill-after=2s 20s "$SYSTEMCTL" --system start -- "$unit" >> "$STATE/actions.txt" 2>&1 || ok=0; fi
  done
  for unit in "${RPC_UNITS[@]}"; do
    if query_unit "$unit"; then
      [ "$LOAD" = loaded ] && [ "$ACTIVE" = "${ORIGINAL_ACTIVE[$unit]}" ] && [ "$ENABLED" = "${ORIGINAL_ENABLED[$unit]}" ] || ok=0
    else ok=0; fi
  done
  health_ok rollback || ok=0
  [ "$ok" -eq 1 ]
}
finish() {
  local code=$?
  trap - EXIT INT TERM
  if [ "$code" -ne 0 ]; then
    if [ "$MUTATED" -eq 1 ]; then
      if restore_original; then echo "RPC hardening failed during $PHASE; original RPC unit state restored and site health confirmed." >&2
      else echo "RPC hardening failed during $PHASE; automatic rollback failed. Preserve the private state for local recovery." >&2; fi
    else echo "RPC hardening preflight failed during $PHASE; no services changed." >&2; fi
  fi
  printf '%s\n' "$code" > "$STATE/exit-status.txt"
  flock --unlock 9 || true
  exit "$code"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Read just a literal domain; never source or evaluate the environment file.
DOMAIN=""
domain_count=0
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  if [[ "$line" =~ ^[[:space:]]*WEB_DOMAIN[[:space:]]*=[[:space:]]*(.*)$ ]]; then
    domain_count=$((domain_count + 1))
    DOMAIN="${BASH_REMATCH[1]}"
    DOMAIN="${DOMAIN#"${DOMAIN%%[![:space:]]*}"}"
    DOMAIN="${DOMAIN%"${DOMAIN##*[![:space:]]}"}"
    if [[ "$DOMAIN" = \"*\" && "$DOMAIN" = *\" ]]; then DOMAIN="${DOMAIN:1:${#DOMAIN}-2}";
    elif [[ "$DOMAIN" = \'*\' && "$DOMAIN" = *\' ]]; then DOMAIN="${DOMAIN:1:${#DOMAIN}-2}"; fi
  fi
done < .env
[ "$domain_count" -eq 1 ] && [ "${#DOMAIN}" -le 253 ] && [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ && "$DOMAIN" = *.* ]] || exit 1
DOMAIN="${DOMAIN,,}"
IFS=. read -r -a labels <<< "$DOMAIN"
for label in "${labels[@]}"; do [ "${#label}" -le 63 ] && [[ "$label" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]] || exit 1; done
[[ "$DOMAIN" != .* && "$DOMAIN" != *. && "$DOMAIN" != *..* && "${labels[${#labels[@]}-1]}" =~ ^[a-z] ]] || exit 1

PHASE=unit-state
for unit in "${RPC_UNITS[@]}"; do
  query_unit "$unit"
  # rpcinfo must not activate a previously inactive socket-backed daemon during
  # supposedly read-only preflight. This remedy targets the observed live pair.
  [ "$LOAD" = loaded ] && [ "$ACTIVE" = active ] && [[ "$ENABLED" = enabled || "$ENABLED" = disabled ]] || exit 1
  ORIGINAL_ACTIVE[$unit]="$ACTIVE"
  ORIGINAL_ENABLED[$unit]="$ENABLED"
  printf '%s\t%s\t%s\n' "$unit" "$ACTIVE" "$ENABLED" >> "$STATE/unit-state.tsv"
done

PHASE=network-filesystems
timeout --signal=TERM --kill-after=2s 10s "$FINDMNT_BIN" --raw --noheadings --output FSTYPE > "$STATE/mount-types.txt" 2>> "$STATE/errors.txt"
[ -s "$STATE/mount-types.txt" ] || exit 1
awk 'NF != 1 || $1 !~ /^[A-Za-z0-9_.+-]+$/ || $1 ~ /^(nfs|nfs4|cifs|smb3|autofs)$/ { exit 1 }' "$STATE/mount-types.txt"
[ -f "$ETC_DIR/fstab" ] && [ ! -L "$ETC_DIR/fstab" ] && [ -r "$ETC_DIR/fstab" ] || exit 1
awk '/^[[:space:]]*(#|$)/ { next } NF < 4 || NF > 6 || $3 ~ /^(nfs|nfs4|cifs|smb3|autofs)$/ || $1 ~ /:/ || $1 ~ /^\/\// { exit 1 }' "$ETC_DIR/fstab"

PHASE=exports
check_export_file() {
  local file="$1"
  [ -f "$file" ] && [ ! -L "$file" ] && [ -r "$file" ] || return 1
  awk '/^[[:space:]]*(#|$)/ { next } { exit 1 }' "$file"
}
if [ -e "$ETC_DIR/exports" ] || [ -L "$ETC_DIR/exports" ]; then check_export_file "$ETC_DIR/exports"; fi
if [ -e "$ETC_DIR/exports.d" ] || [ -L "$ETC_DIR/exports.d" ]; then
  [ -d "$ETC_DIR/exports.d" ] && [ ! -L "$ETC_DIR/exports.d" ] || exit 1
  find "$ETC_DIR/exports.d" -mindepth 1 -maxdepth 1 -print0 > "$STATE/export-entries.txt"
  export_count=0
  while IFS= read -r -d '' file; do export_count=$((export_count + 1)); [ "$export_count" -le 128 ] || exit 1; check_export_file "$file"; done < "$STATE/export-entries.txt"
fi
PHASE=kernel-nfs
if [ -e "$PROC_DIR/fs/nfsd/threads" ] || [ -L "$PROC_DIR/fs/nfsd/threads" ]; then
  [ -f "$PROC_DIR/fs/nfsd/threads" ] && [ ! -L "$PROC_DIR/fs/nfsd/threads" ] && [ -r "$PROC_DIR/fs/nfsd/threads" ] || exit 1
  [ "$(cat "$PROC_DIR/fs/nfsd/threads")" = 0 ] || exit 1
fi
PHASE=auxiliary-services
for unit in autofs.service rpc-statd.service nfs-server.service; do
  query_unit "$unit"
  if missing_unit; then continue; fi
  inactive_consumer || exit 1
done

PHASE=rpc-registry
timeout --signal=TERM --kill-after=2s 10s "$RPCINFO_BIN" -p 127.0.0.1 > "$STATE/rpc-registry.txt" 2>> "$STATE/errors.txt"
awk 'NR == 1 { if ($1 != "program" || $2 != "vers" || $3 != "proto" || $4 != "port") exit 1; next } NF < 4 || NF > 5 || $1 != "100000" || $2 !~ /^[0-9]+$/ || ($3 != "tcp" && $3 != "udp") || $4 != "111" { exit 1 } { count++ } END { if (count < 1) exit 1 }' "$STATE/rpc-registry.txt"

PHASE=reverse-dependencies
queue=(rpcbind.socket rpcbind.service rpcbind.target autofs.service rpc-statd.service nfs-server.service)
declare -A visited=()
index=0
enqueue_dependency() {
  local kind="$1" dependent="$2"
  [[ "$dependent" =~ ^[A-Za-z0-9_.@:-]+\.(service|socket|target|mount|automount|timer|path|scope|slice)$ ]] || return 1
  if [ "$kind" = grouping ]; then
    # Generic targets group independent services. These edges do not imply stop
    # propagation; traversing them would classify SSH/Docker as RPC consumers.
    case "$dependent" in *.target) return 0 ;; esac
  else
    case "$dependent" in
      rpcbind.service|rpcbind.socket) ;;
      *)
        if [ "$kind" = trigger ]; then
          case "$dependent" in *.timer|*.path|*.socket|*.automount) ;; *) return 1 ;; esac
        fi
        # Check before visited filtering: a later stop edge to an already
        # inspected grouping target must still refuse its active/enabled state.
        query_unit "$dependent" || return 1
        inactive_consumer || return 1
        ;;
    esac
  fi
  if [ -z "${visited[$dependent]:-}" ]; then queue+=("$dependent"); [ "${#queue[@]}" -le 32 ] || return 1; fi
}
while [ "$index" -lt "${#queue[@]}" ]; do
  [ "$index" -lt 32 ] || exit 1
  unit="${queue[$index]}"; index=$((index + 1))
  [ -z "${visited[$unit]:-}" ] || continue
  visited[$unit]=1
  query_unit "$unit"
  case "$unit" in rpcbind.target|autofs.service|rpc-statd.service|nfs-server.service) if missing_unit; then continue; fi ;; esac
  [ "$LOAD" = loaded ] && [[ "$ACTIVE" = active || "$ACTIVE" = inactive ]] || exit 1
  case "$unit" in rpcbind.service|rpcbind.socket|rpcbind.target) ;; *) inactive_consumer || exit 1 ;; esac
  # Child queries overwrite query globals, so retain all three edge lists first.
  read -r -a dependencies <<< "$REQUIRED $WANTED"
  read -r -a stop_dependencies <<< "$CONSISTS $BOUND $PROPAGATES"
  read -r -a triggers <<< "$TRIGGERED"
  for dependent in "${dependencies[@]}"; do
    enqueue_dependency grouping "$dependent" || exit 1
  done
  for dependent in "${stop_dependencies[@]}"; do
    enqueue_dependency stop "$dependent" || exit 1
  done
  for dependent in "${triggers[@]}"; do
    enqueue_dependency trigger "$dependent" || exit 1
  done
done

# Reserve bounded queries for post-change validation and exact rollback checks.
[ "$QUERY_COUNT" -le 90 ] || exit 1
PHASE=baseline-health
health_ok baseline
snapshot_ports baseline
PHASE=disable-rpc
MUTATED=1
timeout --signal=TERM --kill-after=2s 20s "$SYSTEMCTL" --system disable -- rpcbind.socket rpcbind.service >> "$STATE/actions.txt" 2>&1
timeout --signal=TERM --kill-after=2s 20s "$SYSTEMCTL" --system stop -- rpcbind.socket rpcbind.service >> "$STATE/actions.txt" 2>&1
PHASE=verify-closed
for unit in "${RPC_UNITS[@]}"; do query_unit "$unit"; [ "$LOAD" = loaded ] && [ "$ACTIVE" = inactive ] && [ "$ENABLED" = disabled ] || exit 1; done
snapshot_ports after
for flag in -ltn4 -ltn6 -lun4 -lun6; do [ ! -s "$STATE/after-$flag.txt" ] || exit 1; done
PHASE=post-change-health
health_ok after
echo "Unused RPC listener disabled; TCP/UDP port 111 closed in IPv4/IPv6; site and API health confirmed."
