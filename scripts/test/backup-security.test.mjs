import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

// Opt-in Linux filesystem fixture: no socket mount, network or real database.
// pg_dump's command boundary is controlled here; real restore is a separate gate.
test("backup is private, validated and published only after complete success", {
  skip: process.env.BACKUP_SECURITY_DOCKER_TEST !== "1" ? "set BACKUP_SECURITY_DOCKER_TEST=1 to use cached postgres:16" : false,
}, () => {
  const source = readFileSync(new URL("../../ops/backup.sh", import.meta.url), "utf8").replaceAll("\r\n", "\n");
  const encoded = Buffer.from(source).toString("base64");
  const fixture = `set -euo pipefail
export FIXTURE_ROOT=/tmp/backup-security-fixture
export DUMP_MODE=success
mkdir -p "$FIXTURE_ROOT/project/ops/backups" "$FIXTURE_ROOT/bin"
chmod 755 "$FIXTURE_ROOT/project/ops/backups"
printf '%s' '${encoded}' | base64 -d > "$FIXTURE_ROOT/project/ops/backup.sh"
export COMPOSE_FILE="$FIXTURE_ROOT/compose.yaml"
printf '%s\n' 'fixture only; never read by fake docker' > "$COMPOSE_FILE"
cat > "$FIXTURE_ROOT/bin/docker" <<'DOCKER'
#!/usr/bin/env bash
set -euo pipefail
test "$*" = "compose --file $FIXTURE_ROOT/compose.yaml exec -T postgres pg_dump -U konkur -d konkurcom"
case "$DUMP_MODE" in
  success) printf '%s\n' 'CREATE TABLE synthetic_fixture (id integer);' 'INSERT INTO synthetic_fixture VALUES (1);' ;;
  partial-failure) printf '%s\n' 'incomplete dump'; exit 17 ;;
  empty) exit 0 ;;
  signal) kill -TERM "$PPID"; exit 17 ;;
  *) exit 19 ;;
esac
DOCKER
cat > "$FIXTURE_ROOT/bin/date" <<'DATE'
#!/usr/bin/env bash
printf '%s\n' '20261002-141000'
DATE
chmod +x "$FIXTURE_ROOT/bin/docker" "$FIXTURE_ROOT/bin/date"
export PATH="$FIXTURE_ROOT/bin:$PATH"
backup="$FIXTURE_ROOT/project/ops/backup.sh"
cd /tmp
bash "$backup" > /dev/null
directory="$FIXTURE_ROOT/project/ops/backups"
test "$(stat -c '%a' "$directory")" = 700
first="$(find "$directory" -type f -name '*.sql.gz')"
test "$(stat -c '%a' "$first")" = 600
gzip -t "$first"
test "$(gzip -cd "$first" | wc -c)" -gt 0
printf 'unrelated file\n' > "$directory/.unrelated.tmp"
printf 'retained old backup\n' > "$directory/existing.sql.gz"
for mode in partial-failure empty signal; do
  if DUMP_MODE="$mode" bash "$backup" > /dev/null 2>&1; then echo "unexpected success: $mode" >&2; exit 1; fi
  test "$(find "$directory" -type f -name '*.sql.gz' | wc -l)" -eq 2
  test "$(find "$directory" -type f -name '.konkurcom-*.tmp' | wc -l)" -eq 0
  test "$(cat "$directory/.unrelated.tmp")" = 'unrelated file'
  test "$(cat "$directory/existing.sql.gz")" = 'retained old backup'
done
cat > "$FIXTURE_ROOT/bin/gzip" <<'GZIP'
#!/usr/bin/env bash
if [ "$#" -eq 0 ]; then cat > /dev/null; printf 'corrupt compressed bytes'; else exec /usr/bin/gzip "$@"; fi
GZIP
chmod +x "$FIXTURE_ROOT/bin/gzip"
if bash "$backup" > /dev/null 2>&1; then echo 'corrupt gzip accepted' >&2; exit 1; fi
test "$(find "$directory" -type f -name '*.sql.gz' | wc -l)" -eq 2
test "$(find "$directory" -type f -name '.konkurcom-*.tmp' | wc -l)" -eq 0
rm -- "$FIXTURE_ROOT/bin/gzip"
bash "$backup" > /dev/null & a=$!
bash "$backup" > /dev/null & b=$!
wait "$a"
wait "$b"
test "$(find "$directory" -type f -name '*.sql.gz' | wc -l)" -eq 4
test "$(find "$directory" -type f -name '.konkurcom-*.tmp' | wc -l)" -eq 0
test "$(find "$directory" -type f -name 'konkurcom-*.sql.gz' ! -perm 600 | wc -l)" -eq 0
cat > "$FIXTURE_ROOT/bin/sudo" <<'SUDO'
#!/usr/bin/env bash
test "$1" = --
shift
unset COMPOSE_FILE
exec "$@"
SUDO
chmod +x "$FIXTURE_ROOT/bin/sudo"
# The selector must survive sudo environment filtering as a separate argument.
cp "$FIXTURE_ROOT/bin/docker" "$FIXTURE_ROOT/bin/selected docker"
DOCKER_BIN="$FIXTURE_ROOT/bin/selected docker" DOCKER_USE_SUDO=1 bash "$backup" > /dev/null
test "$(find "$directory" -type f -name '*.sql.gz' | wc -l)" -eq 5
if DOCKER_USE_SUDO=unexpected bash "$backup" > /dev/null 2>&1; then echo 'invalid sudo mode accepted' >&2; exit 1; fi
printf '%s\n' 'PASS private modes, partial failure, empty dump, invalid gzip, signal cleanup, unrelated preservation and simultaneous backups'
`;
  const result = spawnSync("docker", ["run", "--rm", "--pull=never", "--network=none", "--interactive", "--entrypoint", "bash", "postgres:16", "-s"], {
    input: fixture, encoding: "utf8", timeout: 30_000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /PASS private modes/);
});
