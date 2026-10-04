import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("remote deployment preserves its script stdin and proves the running release", {
  skip: process.env.DEPLOYMENT_SECURITY_DOCKER_TEST !== "1" ? "set DEPLOYMENT_SECURITY_DOCKER_TEST=1 for the isolated cached Linux fixture" : false,
}, () => {
  const resolver = createRequire(import.meta.url);
  const dependencyRequire = createRequire(resolver.resolve("../../apps/api/node_modules/eslint/package.json"));
  const yaml = dependencyRequire("js-yaml");
  const workflow = yaml.load(readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8"));
  const steps = workflow.jobs["build-test-deploy"].steps;
  const deploy = steps.find(step => step.name === "Deploy to server, then wait for /healthz").run;
  const extract = marker => {
    const needle = "<<'" + marker + "'\n";
    const start = deploy.indexOf(needle);
    assert.ok(start >= 0, marker);
    const body = start + needle.length;
    const end = deploy.indexOf("\n" + marker + "\n", body);
    assert.ok(end > body, marker);
    return deploy.slice(body, end);
  };
  const start = deploy.indexOf("run_remote() {");
  const end = deploy.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, "actual remote transport function");
  const remote = deploy.slice(start, end + 2);
  const caller = deploy.slice(deploy.indexOf("deploy_status=0"));
  const encoded = value => Buffer.from(value).toString("base64");
  const fixture = String.raw`set -euo pipefail
umask 077
export FIXTURE_ROOT=/tmp/deployment-security-fixture
mkdir -p "$FIXTURE_ROOT/bin"
trap 'echo "Isolated deployment fixture failed at line $LINENO" >&2; if [ -f "$FIXTURE_ROOT/diagnostic.txt" ]; then cat "$FIXTURE_ROOT/diagnostic.txt" >&2; fi' ERR
printf '%s' '${encoded(extract("PRELUDE") + "\n")}' | base64 -d > /tmp/prelude.sh
printf '%s' '${encoded(extract("UP") + "\n")}' | base64 -d > /tmp/up.sh
printf '%s' '${encoded(remote + "\n" + caller)}' | base64 -d > "$FIXTURE_ROOT/deploy.sh"
cat > "$FIXTURE_ROOT/bin/ssh-fixture" <<'SSH'
#!/usr/bin/env bash
set -euo pipefail
test "$#" = 2
test "$1" = fixture-host
shift
if [ "$OMIT_COMPLETION" = 1 ]; then cat >/dev/null; exit 0; fi
exec bash -c "$1"
SSH
cat > "$FIXTURE_ROOT/bin/sudo" <<'SUDO'
#!/usr/bin/env bash
set -euo pipefail
export MOCK_VIA_SUDO=1
exec "$@"
SUDO
cat > "$FIXTURE_ROOT/bin/id" <<'ID'
#!/usr/bin/env bash
set -euo pipefail
if [ "$*" = '-u' ]; then [ "$EXPECT_SUDO" = 0 ] && printf 0 || printf 1001; else exec /usr/bin/id "$@"; fi
ID
cat > "$FIXTURE_ROOT/bin/docker" <<'DOCKER'
#!/usr/bin/env bash
set -euo pipefail
consume_stdin() {
  cat > "$FIXTURE_ROOT/child-stdin"
  test ! -s "$FIXTURE_ROOT/child-stdin"
}
case "$*" in
  info) if [ "$EXPECT_SUDO" = 1 ] && [ "$MOCK_VIA_SUDO" = 0 ]; then exit 1; fi; exit 0 ;;
  'compose run --rm --no-deps --entrypoint node api scripts/check-production-config.mjs --require-credentials')
    consume_stdin; echo credentials >> "$FIXTURE_LOG"; test "$CREDENTIAL_FAIL" = 0; exit ;;
  'compose ps --status running --quiet postgres')
    echo postgres-status >> "$FIXTURE_LOG"; [ "$DB_RUNNING" = 0 ] || echo synthetic-postgres; exit 0 ;;
  'compose up -d --no-build') echo up >> "$FIXTURE_LOG"; exit 0 ;;
  'compose ps --status running --quiet api') printf '%s\n' "$API_CID"; exit 0 ;;
  'compose ps --status running --quiet web') printf '%s\n' "$WEB_CID"; exit 0 ;;
  'compose exec -T api id -u')
    consume_stdin; echo api-user >> "$FIXTURE_LOG"; [ "$ROOT_API" = 0 ] && printf 1000 || printf 0; exit 0 ;;
  'compose exec -T web id -u')
    consume_stdin; echo web-user >> "$FIXTURE_LOG"; [ "$ROOT_WEB" = 0 ] && printf 1000 || printf 0; exit 0 ;;
  'compose exec -T nginx sh -ec '*)
    consume_stdin; echo nginx-reload >> "$FIXTURE_LOG"; test "$NGINX_FAIL" = 0; exit ;;
  'image prune '*|'builder prune '*) exit 0 ;;
esac
if [ "$1" = image ] && [ "$2" = inspect ] && [ "$3" = --format ] && [ "$4" = '{{.Id}}' ]; then
  case "$5" in
    "$API_IMAGE") printf '%s\n' "$API_ID" ;;
    "$WEB_IMAGE") printf '%s\n' "$WEB_ID" ;;
    *) exit 21 ;;
  esac
  exit 0
fi
if [ "$1" = inspect ] && [ "$2" = --format ] && [ "$3" = '{{.Image}}' ]; then
  case "$4" in
    "$API_CID") [ "$OLD_API" = 0 ] && printf '%s\n' "$API_ID" || printf '%s\n' "$OLD_ID" ;;
    "$WEB_CID") [ "$OLD_WEB" = 0 ] && printf '%s\n' "$WEB_ID" || printf '%s\n' "$OLD_ID" ;;
    *) exit 22 ;;
  esac
  exit 0
fi
if [ "$1" = run ] && [ "$2" = --rm ] && [ "$3" = --network ] && [ "$4" = host ] && [ "$5" = curlimages/curl:latest ]; then
  case "$*" in
    *'/api/healthz') echo api-health >> "$FIXTURE_LOG"; printf '%s\n' '{"status":"ok"}' ;;
    *'/phase18-probe') echo redirect >> "$FIXTURE_LOG"; printf 'HTTP/1.1 308 Permanent Redirect\r\nLocation: https://kunkurcomputer.ir/phase18-probe\r\n\r\n' ;;
    *) echo web-health >> "$FIXTURE_LOG"; printf 200 ;;
  esac
  exit 0
fi
printf 'unexpected synthetic Docker command: %s\n' "$*" >&2
exit 23
DOCKER
chmod +x "$FIXTURE_ROOT/bin/"*
export PATH="$FIXTURE_ROOT/bin:$PATH"
export SSH="$FIXTURE_ROOT/bin/ssh-fixture" REMOTE=fixture-host
export GITHUB_SHA=1111111111111111111111111111111111111111
export API_IMAGE="ghcr.io/fixture/site-api:$GITHUB_SHA" WEB_IMAGE="ghcr.io/fixture/site-web:$GITHUB_SHA"
export API_ID=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
export WEB_ID=sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
export OLD_ID=sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
export API_CID=dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd
export WEB_CID=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
export DEPLOY_WEB_DOMAIN=kunkurcomputer.ir DEPLOY_API_DOMAIN=api.kunkurcomputer.ir
case_count=0
for scenario in existing first credentials-fail backup-fail sudo proxy old-api old-web root-api root-web nginx-fail missing-completion; do
  case_count=$((case_count + 1))
  export DEPLOY_PATH="$FIXTURE_ROOT/$scenario" FIXTURE_LOG="$FIXTURE_ROOT/$scenario/order.log"
  mkdir -p "$DEPLOY_PATH/ops"
  : > "$FIXTURE_LOG"
  printf 'TRUSTED_PROXY_CIDRS=198.51.100.0/24\n' > "$DEPLOY_PATH/.env"
  cat > "$DEPLOY_PATH/ops/backup.sh" <<'BACKUP'
#!/usr/bin/env bash
set -euo pipefail
test "$DOCKER_BIN" = docker
test "$DOCKER_USE_SUDO" = "$EXPECT_SUDO"
cat > "$FIXTURE_ROOT/backup-stdin"
test ! -s "$FIXTURE_ROOT/backup-stdin"
echo backup >> "$FIXTURE_LOG"
test "$BACKUP_FAIL" = 0
BACKUP
  export DOCKER=docker EXPECT_SUDO=0 DB_RUNNING=1 CREDENTIAL_FAIL=0 BACKUP_FAIL=0 DEPLOY_TRUSTED_PROXY_CIDRS=''
  export MOCK_VIA_SUDO=0
  export OLD_API=0 OLD_WEB=0 ROOT_API=0 ROOT_WEB=0 NGINX_FAIL=0 OMIT_COMPLETION=0
  case "$scenario" in
    first) DB_RUNNING=0 ;;
    credentials-fail) CREDENTIAL_FAIL=1 ;;
    backup-fail) BACKUP_FAIL=1 ;;
    sudo) DOCKER='sudo docker'; EXPECT_SUDO=1 ;;
    proxy) DEPLOY_TRUSTED_PROXY_CIDRS='203.0.113.0/24,2001:db8::/32' ;;
    old-api) OLD_API=1 ;;
    old-web) OLD_WEB=1 ;;
    root-api) ROOT_API=1 ;;
    root-web) ROOT_WEB=1 ;;
    nginx-fail) NGINX_FAIL=1 ;;
    missing-completion) OMIT_COMPLETION=1 ;;
  esac
  if bash "$FIXTURE_ROOT/deploy.sh" > "$DEPLOY_PATH/result" 2>&1; then status=0; else status=$?; fi
  cp "$DEPLOY_PATH/result" "$FIXTURE_ROOT/diagnostic.txt"
  case "$scenario" in
    existing|first|sudo|proxy)
      test "$status" = 0
      grep -Fxq "Deployment complete for release $GITHUB_SHA." "$DEPLOY_PATH/result"
      grep -q '^up$' "$FIXTURE_LOG"
      grep -q '^nginx-reload$' "$FIXTURE_LOG"
      grep -q '^redirect$' "$FIXTURE_LOG"
      ;;
    *) test "$status" -ne 0; ! grep -Fxq "Deployment complete for release $GITHUB_SHA." "$DEPLOY_PATH/result" ;;
  esac
  case "$scenario" in
    credentials-fail) test "$(paste -sd, "$FIXTURE_LOG")" = credentials ;;
    backup-fail) test "$(paste -sd, "$FIXTURE_LOG")" = credentials,postgres-status,backup ;;
    first) ! grep -q '^backup$' "$FIXTURE_LOG" ;;
    missing-completion) test ! -s "$FIXTURE_LOG" ;;
  esac
  case "$scenario" in
    old-api|old-web|root-api|root-web|nginx-fail) ! grep -q '^api-health$' "$FIXTURE_LOG" ;;
  esac
  if [ "$scenario" = proxy ]; then
    grep -Fxq 'TRUSTED_PROXY_CIDRS=203.0.113.0/24,2001:db8::/32' "$DEPLOY_PATH/.env"
  elif [ "$scenario" != missing-completion ]; then
    grep -Fxq 'TRUSTED_PROXY_CIDRS=198.51.100.0/24' "$DEPLOY_PATH/.env"
  fi
  if [ "$scenario" != missing-completion ]; then test "$(stat -c '%a' "$DEPLOY_PATH/.env")" = 600; fi
  test "$(find /tmp -maxdepth 1 -type f -name 'konkur-deploy-*' | wc -l)" = 0
done
printf 'PASS %s isolated deployment transport, release, uid, gateway and completion scenarios\n' "$case_count"
`;
  let syntax = "set -euo pipefail\n";
  for (const [index, step] of steps.filter(step => typeof step.run === "string").entries()) {
    syntax += "printf '%s' '" + encoded(step.run) + "' | base64 -d > /tmp/deployment-syntax-" + index + ".sh\nbash -n /tmp/deployment-syntax-" + index + ".sh\n";
  }
  const result = spawnSync("docker", ["run", "--rm", "--pull=never", "--network=none", "--interactive", "--entrypoint", "bash", "postgres:16", "-s"], {
    input: syntax + fixture, encoding: "utf8", timeout: 30_000, maxBuffer: 512 * 1024,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /PASS 12 isolated deployment/);
  console.info(result.stdout.trim());
});
