import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("RPC hardening refuses live dependencies and restores exact state after failures", {
  skip: process.env.RPC_HARDENING_DOCKER_TEST !== "1" ? "set RPC_HARDENING_DOCKER_TEST=1 for the isolated cached Linux fixture" : false,
}, () => {
  const script = new URL("../../ops/disable-unused-rpcbind.sh", import.meta.url);
  const source = existsSync(script) ? readFileSync(script, "utf8").replaceAll("\r\n", "\n") : "#!/usr/bin/env bash\nexit 99\n";
  const encoded = Buffer.from(source).toString("base64");
  const fixture = `set -euo pipefail
umask 077
base=/tmp/rpcbind-hardening-fixture-test
mkdir -p "$base"
printf '%s' '${encoded}' | base64 -d > "$base/script.sh"
case_count=0
new_case() {
  case_count=$((case_count + 1))
  export RPC_FIXTURE_ROOT="$base/case-$case_count"
  export RPC_HARDENING_FIXTURE=1 RPC_HARDENING=1
  mkdir -p "$RPC_FIXTURE_ROOT/project/ops/backups" "$RPC_FIXTURE_ROOT/bin" "$RPC_FIXTURE_ROOT/etc/exports.d" "$RPC_FIXTURE_ROOT/proc/fs/nfsd" "$RPC_FIXTURE_ROOT/state"
  printf '%s\n' isolated-rpcbind-fixture > "$RPC_FIXTURE_ROOT/.rpcbind-hardening-fixture"
  printf '%s\n' WEB_DOMAIN=fixture.example > "$RPC_FIXTURE_ROOT/project/.env"
  chmod 600 "$RPC_FIXTURE_ROOT/project/.env"
  chmod 700 "$RPC_FIXTURE_ROOT/project/ops/backups"
  : > "$RPC_FIXTURE_ROOT/etc/fstab"
  : > "$RPC_FIXTURE_ROOT/etc/exports"
  printf '0\n' > "$RPC_FIXTURE_ROOT/proc/fs/nfsd/threads"
  printf 'ext4\n' > "$RPC_FIXTURE_ROOT/state/mounts"
  printf '    program vers proto   port  service\n     100000    4   tcp    111  portmapper\n     100000    4   udp    111  portmapper\n' > "$RPC_FIXTURE_ROOT/state/registry"
  : > "$RPC_FIXTURE_ROOT/state/actions"
  printf '0\n' > "$RPC_FIXTURE_ROOT/state/uid"
  unit rpcbind.service active enabled
  unit rpcbind.socket active enabled
  unit nfs-client.target active enabled
  unit rpcbind.target active static
  unit autofs.service inactive disabled
  unit rpc-statd.service inactive disabled
  unit nfs-server.service inactive disabled
  printf 'nfs-client.target rpcbind.target\n' > "$RPC_FIXTURE_ROOT/state/rpcbind.service.WantedBy"
  for tool in id systemctl ss curl findmnt rpcinfo; do cp "$base/$tool" "$RPC_FIXTURE_ROOT/bin/$tool"; done
  chmod +x "$RPC_FIXTURE_ROOT/bin/"*
  cd "$RPC_FIXTURE_ROOT/project"
}
unit() {
  printf '%s\n' loaded > "$RPC_FIXTURE_ROOT/state/$1.LoadState"
  printf '%s\n' "$2" > "$RPC_FIXTURE_ROOT/state/$1.ActiveState"
  printf '%s\n' "$3" > "$RPC_FIXTURE_ROOT/state/$1.UnitFileState"
  : > "$RPC_FIXTURE_ROOT/state/$1.RequiredBy"
  : > "$RPC_FIXTURE_ROOT/state/$1.WantedBy"
  : > "$RPC_FIXTURE_ROOT/state/$1.ConsistsOf"
  : > "$RPC_FIXTURE_ROOT/state/$1.BoundBy"
  : > "$RPC_FIXTURE_ROOT/state/$1.PropagatesStopTo"
  : > "$RPC_FIXTURE_ROOT/state/$1.TriggeredBy"
}
expect_block() {
  if bash "$base/script.sh" > "$RPC_FIXTURE_ROOT/result" 2>&1; then echo 'unsafe prereq accepted' >&2; exit 1; fi
  test ! -s "$RPC_FIXTURE_ROOT/state/actions"
}
expect_rollback() {
  if bash "$base/script.sh" > "$RPC_FIXTURE_ROOT/result" 2>&1; then echo 'failed mutation accepted' >&2; exit 1; fi
  grep -q 'original RPC unit state restored' "$RPC_FIXTURE_ROOT/result"
  test "$(cat "$RPC_FIXTURE_ROOT/state/rpcbind.service.ActiveState")" = active
  test "$(cat "$RPC_FIXTURE_ROOT/state/rpcbind.socket.ActiveState")" = active
  test "$(cat "$RPC_FIXTURE_ROOT/state/rpcbind.service.UnitFileState")" = enabled
  test "$(cat "$RPC_FIXTURE_ROOT/state/rpcbind.socket.UnitFileState")" = enabled
}
cat > "$base/id" <<'ID'
#!/usr/bin/env bash
test "$*" = '-u'
cat "$RPC_FIXTURE_ROOT/state/uid"
ID
cat > "$base/systemctl" <<'SYSTEMCTL'
#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = --system ]; then shift; fi
action="$1"; shift
if [ "$action" = show ]; then
  properties="$(printf '%s' "$1" | cut -d= -f2 | tr ',' ' ')"
  while [ "$#" -gt 1 ]; do shift; done
  unit="$1"
  [ ! -e "$RPC_FIXTURE_ROOT/state/query-failure" ] || exit 21
  for key in $properties; do
    value="$(cat "$RPC_FIXTURE_ROOT/state/$unit.$key" 2>/dev/null)" || exit 22
    printf '%s=%s\n' "$key" "$value"
  done
  exit 0
fi
if [ "$#" -gt 0 ] && [ "$1" = -- ]; then shift; fi
case "$action" in enable|disable|stop|start) ;; *) exit 23 ;; esac
printf '%s %s\n' "$action" "$*" >> "$RPC_FIXTURE_ROOT/state/actions"
for unit in "$@"; do
  case "$unit" in rpcbind.service|rpcbind.socket) ;; *) echo 'unrelated unit mutated' >&2; exit 24 ;; esac
  if [ "$action" = start ] && [ -e "$RPC_FIXTURE_ROOT/state/rollback-failure" ]; then exit 25; fi
  case "$action" in
    enable) printf 'enabled\n' > "$RPC_FIXTURE_ROOT/state/$unit.UnitFileState" ;;
    disable) printf 'disabled\n' > "$RPC_FIXTURE_ROOT/state/$unit.UnitFileState" ;;
    stop) printf 'inactive\n' > "$RPC_FIXTURE_ROOT/state/$unit.ActiveState" ;;
    start) printf 'active\n' > "$RPC_FIXTURE_ROOT/state/$unit.ActiveState" ;;
  esac
  if [ "$action" = stop ] && [ -e "$RPC_FIXTURE_ROOT/state/stop-failure" ]; then rm "$RPC_FIXTURE_ROOT/state/stop-failure"; exit 26; fi
done
SYSTEMCTL
cat > "$base/ss" <<'SS'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$RPC_FIXTURE_ROOT/state/ss-calls"
test "$#" = 3
test "$1" = -H
test "$3" = 'sport = :111'
case "$2" in -ltn4|-ltn6|-lun4|-lun6) ;; *) exit 27 ;; esac
if grep -q active "$RPC_FIXTURE_ROOT/state/rpcbind.service.ActiveState" && ! grep -q inactive "$RPC_FIXTURE_ROOT/state/rpcbind.service.ActiveState"; then printf 'LISTEN 0 4096 *:111 *:*\n';
elif [ "$2" = -lun6 ] && [ -e "$RPC_FIXTURE_ROOT/state/lingering-port" ]; then printf 'UNCONN 0 0 [::]:111 [::]:*\n'; fi
SS
cat > "$base/curl" <<'CURL'
#!/usr/bin/env bash
set -euo pipefail
output=''; url=''; resolve=''; noproxy=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    -k|--insecure|-L|--location) echo 'unsafe curl option' >&2; exit 28 ;;
    --output) output="$2"; shift ;;
    --resolve) resolve="$2"; shift ;;
    --noproxy) noproxy="$2"; shift ;;
    --max-time|--connect-timeout|--max-filesize|--write-out) shift ;;
    https://*) url="$1" ;;
    --silent|--show-error|--fail) ;;
    *) exit 29 ;;
  esac
  shift
done
test "$resolve" = fixture.example:443:127.0.0.1
test "$noproxy" = '*'
test -n "$output"
case "$url" in https://fixture.example/|https://fixture.example/api/healthz) ;; *) exit 30 ;; esac
printf '%s\n' "$url" >> "$RPC_FIXTURE_ROOT/state/curl-calls"
if [ -e "$RPC_FIXTURE_ROOT/state/baseline-health-failure" ]; then exit 31; fi
if [ -e "$RPC_FIXTURE_ROOT/state/post-health-failure" ] && grep -q '^inactive$' "$RPC_FIXTURE_ROOT/state/rpcbind.service.ActiveState"; then printf '{"status":"degraded"}\n' > "$output"; printf 503; exit 0; fi
case "$url" in */api/healthz) printf '{"status":"ok","checks":{"db":{"status":"ok"}}}\n' > "$output" ;; *) printf '<html>synthetic site</html>\n' > "$output" ;; esac
printf 200
CURL
cat > "$base/findmnt" <<'FINDMNT'
#!/usr/bin/env bash
cat "$RPC_FIXTURE_ROOT/state/mounts"
FINDMNT
cat > "$base/rpcinfo" <<'RPCINFO'
#!/usr/bin/env bash
test "$*" = '-p 127.0.0.1'
cat "$RPC_FIXTURE_ROOT/state/registry"
RPCINFO

new_case
bash "$base/script.sh" > "$RPC_FIXTURE_ROOT/result" 2>&1
test "$(cat "$RPC_FIXTURE_ROOT/state/rpcbind.service.ActiveState")" = inactive
test "$(cat "$RPC_FIXTURE_ROOT/state/rpcbind.socket.ActiveState")" = inactive
test "$(cat "$RPC_FIXTURE_ROOT/state/rpcbind.service.UnitFileState")" = disabled
test "$(cat "$RPC_FIXTURE_ROOT/state/rpcbind.socket.UnitFileState")" = disabled
test "$(cat "$RPC_FIXTURE_ROOT/state/nfs-client.target.ActiveState")" = active
test "$(wc -l < "$RPC_FIXTURE_ROOT/state/actions")" = 2
grep -q '^disable rpcbind.socket rpcbind.service$' "$RPC_FIXTURE_ROOT/state/actions"
grep -q '^stop rpcbind.socket rpcbind.service$' "$RPC_FIXTURE_ROOT/state/actions"
for flag in -ltn4 -ltn6 -lun4 -lun6; do grep -q -- "$flag" "$RPC_FIXTURE_ROOT/state/ss-calls"; done
state="$(find ops/backups -maxdepth 1 -type d -name '.rpcbind-hardening-*' | head -n1)"
test -n "$state"
test "$(stat -c '%a' "$state")" = 700
test "$(find "$state" -type f ! -perm 600 | wc -l)" = 0
grep -q 'rpcbind.service.*active.*enabled' "$state/unit-state.tsv"
printf 'PASS success and private exact-state snapshot\n'

new_case; printf '1001\n' > "$RPC_FIXTURE_ROOT/state/uid"; expect_block
new_case; RPC_HARDENING=0 expect_block
new_case; rm "$RPC_FIXTURE_ROOT/bin/rpcinfo"; expect_block
for filesystem in nfs nfs4 cifs smb3; do new_case; printf '%s\n' "$filesystem" > "$RPC_FIXTURE_ROOT/state/mounts"; expect_block; done
new_case; printf '%s\n' 'server:/export /mnt nfs4 noauto,x-systemd.automount 0 0' > "$RPC_FIXTURE_ROOT/etc/fstab"; expect_block
new_case; printf '%s\n' '//server/share /mnt cifs noauto 0 0' > "$RPC_FIXTURE_ROOT/etc/fstab"; expect_block
new_case; printf '%s\n' '/data client(rw)' > "$RPC_FIXTURE_ROOT/etc/exports"; expect_block
new_case; printf '%s\n' '/data client(ro)' > "$RPC_FIXTURE_ROOT/etc/exports.d/site.exports"; expect_block
new_case; printf '8\n' > "$RPC_FIXTURE_ROOT/proc/fs/nfsd/threads"; expect_block
for unit in autofs.service rpc-statd.service nfs-server.service; do new_case; printf 'active\n' > "$RPC_FIXTURE_ROOT/state/$unit.ActiveState"; expect_block; done
new_case; unit consumer.service active enabled; printf 'consumer.service\n' > "$RPC_FIXTURE_ROOT/state/rpcbind.socket.RequiredBy"; expect_block
new_case; unit bridge.service inactive disabled; unit consumer.service active enabled; printf 'bridge.service\n' > "$RPC_FIXTURE_ROOT/state/rpcbind.socket.WantedBy"; printf 'consumer.service\n' > "$RPC_FIXTURE_ROOT/state/bridge.service.RequiredBy"; expect_block
for relation in ConsistsOf BoundBy PropagatesStopTo; do
  new_case; unit consumer.service active disabled; printf 'consumer.service\n' > "$RPC_FIXTURE_ROOT/state/rpcbind.service.$relation"; expect_block
  new_case; unit consumer.target active static; printf 'consumer.target\n' > "$RPC_FIXTURE_ROOT/state/rpcbind.socket.$relation"; expect_block
  new_case; unit bridge.service inactive disabled; printf 'bridge.service\n' > "$RPC_FIXTURE_ROOT/state/rpcbind.socket.RequiredBy"; printf 'rpcbind.target\n' > "$RPC_FIXTURE_ROOT/state/bridge.service.$relation"; expect_block
done
for enabled in enabled enabled-runtime; do
  for auxiliary in autofs.service rpc-statd.service nfs-server.service; do
    new_case; printf '%s\n' "$enabled" > "$RPC_FIXTURE_ROOT/state/$auxiliary.UnitFileState"; expect_block
  done
  for relation in RequiredBy WantedBy ConsistsOf BoundBy PropagatesStopTo; do
    new_case; unit consumer.service inactive "$enabled"; printf 'consumer.service\n' > "$RPC_FIXTURE_ROOT/state/rpcbind.service.$relation"; expect_block
  done
done
for trigger in consumer.timer consumer.path consumer.socket consumer.automount; do
  new_case; unit consumer.service inactive disabled; unit "$trigger" active disabled; printf 'consumer.service\n' > "$RPC_FIXTURE_ROOT/state/rpcbind.service.RequiredBy"; printf '%s\n' "$trigger" > "$RPC_FIXTURE_ROOT/state/consumer.service.TriggeredBy"; expect_block
  for enabled in enabled enabled-runtime; do
    new_case; unit consumer.service inactive static; unit "$trigger" inactive "$enabled"; printf 'consumer.service\n' > "$RPC_FIXTURE_ROOT/state/rpcbind.service.WantedBy"; printf '%s\n' "$trigger" > "$RPC_FIXTURE_ROOT/state/consumer.service.TriggeredBy"; expect_block
  done
done
new_case; unit autofs.timer active enabled; printf 'autofs.timer\n' > "$RPC_FIXTURE_ROOT/state/autofs.service.TriggeredBy"; expect_block
new_case; unit consumer.timer inactive disabled; printf 'consumer.timer\n' > "$RPC_FIXTURE_ROOT/state/rpcbind.service.TriggeredBy"; unit nested.path active static; printf 'nested.path\n' > "$RPC_FIXTURE_ROOT/state/consumer.timer.TriggeredBy"; expect_block
for relation in BoundBy PropagatesStopTo TriggeredBy; do
  new_case; unit safe.service inactive disabled; unit unsafe.timer active disabled
  printf 'safe.service\n' > "$RPC_FIXTURE_ROOT/state/rpcbind.service.ConsistsOf"
  printf 'unsafe.timer\n' > "$RPC_FIXTURE_ROOT/state/rpcbind.service.$relation"
  expect_block
done
for enabled in disabled static; do
  new_case
  unit consumer.service inactive "$enabled"
  unit consumer.timer inactive "$enabled"
  printf 'consumer.service\n' > "$RPC_FIXTURE_ROOT/state/rpcbind.service.RequiredBy"
  printf 'consumer.timer\n' > "$RPC_FIXTURE_ROOT/state/consumer.service.TriggeredBy"
  printf 'rpcbind.socket\n' > "$RPC_FIXTURE_ROOT/state/rpcbind.service.TriggeredBy"
  bash "$base/script.sh" > "$RPC_FIXTURE_ROOT/result" 2>&1
  test "$(cat "$RPC_FIXTURE_ROOT/state/consumer.service.ActiveState")" = inactive
  test "$(cat "$RPC_FIXTURE_ROOT/state/consumer.service.UnitFileState")" = "$enabled"
  test "$(cat "$RPC_FIXTURE_ROOT/state/consumer.timer.UnitFileState")" = "$enabled"
  test "$(cat "$RPC_FIXTURE_ROOT/state/nfs-client.target.ActiveState")" = active
  test "$(wc -l < "$RPC_FIXTURE_ROOT/state/actions")" = 2
done
new_case
for repeat in $(seq 1 84); do printf 'rpc-statd.service '; done > "$RPC_FIXTURE_ROOT/state/nfs-server.service.PropagatesStopTo"
expect_block
state="$(find ops/backups -maxdepth 1 -type d -name '.rpcbind-hardening-*' | head -n1)"
queries="$(find "$state" -maxdepth 1 -type f -name 'unit-*.txt' | wc -l)"
test "$queries" -gt 90
test "$queries" -le 96
new_case; touch "$RPC_FIXTURE_ROOT/state/query-failure"; expect_block
new_case; printf '100024 1 udp 600 status\n' >> "$RPC_FIXTURE_ROOT/state/registry"; expect_block
for state in static masked enabled-runtime; do new_case; printf '%s\n' "$state" > "$RPC_FIXTURE_ROOT/state/rpcbind.service.UnitFileState"; expect_block; done
new_case; printf 'activating\n' > "$RPC_FIXTURE_ROOT/state/rpcbind.service.ActiveState"; expect_block
for unit in rpcbind.service rpcbind.socket; do new_case; printf 'inactive\n' > "$RPC_FIXTURE_ROOT/state/$unit.ActiveState"; expect_block; done
new_case; touch "$RPC_FIXTURE_ROOT/state/baseline-health-failure"; expect_block
new_case; printf '%s\n' 'WEB_DOMAIN=$(touch /tmp/rpcbind-hardening-unwanted)' > .env; expect_block; test ! -e /tmp/rpcbind-hardening-unwanted
printf 'PASS blocked network filesystems, future mounts, exports, kernel server, consumers, registry, unknown states and unsafe domain\n'

new_case; touch "$RPC_FIXTURE_ROOT/state/post-health-failure"; expect_rollback
new_case; touch "$RPC_FIXTURE_ROOT/state/stop-failure"; expect_rollback
new_case; touch "$RPC_FIXTURE_ROOT/state/lingering-port"; expect_rollback
new_case
printf 'disabled\n' > "$RPC_FIXTURE_ROOT/state/rpcbind.socket.UnitFileState"
touch "$RPC_FIXTURE_ROOT/state/post-health-failure"
if bash "$base/script.sh" > "$RPC_FIXTURE_ROOT/result" 2>&1; then exit 32; fi
grep -q 'original RPC unit state restored' "$RPC_FIXTURE_ROOT/result"
test "$(cat "$RPC_FIXTURE_ROOT/state/rpcbind.service.UnitFileState")" = enabled
test "$(cat "$RPC_FIXTURE_ROOT/state/rpcbind.socket.UnitFileState")" = disabled
test "$(cat "$RPC_FIXTURE_ROOT/state/rpcbind.service.ActiveState")" = active
test "$(cat "$RPC_FIXTURE_ROOT/state/rpcbind.socket.ActiveState")" = active
new_case; touch "$RPC_FIXTURE_ROOT/state/post-health-failure" "$RPC_FIXTURE_ROOT/state/rollback-failure"
if bash "$base/script.sh" > "$RPC_FIXTURE_ROOT/result" 2>&1; then exit 33; fi
grep -q 'automatic rollback failed' "$RPC_FIXTURE_ROOT/result"
new_case
exec 8> ops/backups/.rpcbind-hardening.lock
flock --nonblock 8
expect_block
flock --unlock 8
printf 'PASS health and partial-stop recovery, IPv6 UDP listener detection, mixed enablement, honest rollback failure and exclusive lock\n'
printf 'PASS %s bounded RPC scenarios\n' "$case_count"
`;
  const result = spawnSync("docker", ["run", "--rm", "--pull=never", "--network=none", "--interactive", "--entrypoint", "bash", "postgres:16", "-s"], {
    input: fixture, encoding: "utf8", timeout: 60_000, maxBuffer: 256 * 1024,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout || "RPC implementation did not satisfy the fixture");
  assert.match(result.stdout, /PASS success and private exact-state snapshot/);
  assert.match(result.stdout, /PASS health and partial-stop recovery/);
  assert.match(result.stdout, /PASS 79 bounded RPC scenarios/);
  console.info(result.stdout.trim());
});
