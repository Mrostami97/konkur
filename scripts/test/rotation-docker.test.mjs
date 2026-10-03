import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

// Opt-in: real isolated PG16 / pinned 2025 MinIO / cached API. No published ports.
// Only this fixture's named resources are removed. No existing stack is selected.
test("internal credential rotation preserves objects/admin/web and recovers from actual DB/storage failures", {
  skip: process.env.ROTATION_SECURITY_DOCKER_TEST !== "1" ? "set ROTATION_SECURITY_DOCKER_TEST=1 for disposable Docker fixtures" : false,
  timeout: 420_000,
}, () => {
  const suffix = randomBytes(6).toString("hex");
  const project = `rotation-fixture-${suffix}`;
  const volume = `${project}-control`;
  const helper = `${project}-helper`;
  const apiImage = process.env.ROTATION_FIXTURE_API_IMAGE || "konkurcom-360-api:latest";
  const minioImage = process.env.ROTATION_FIXTURE_MINIO_IMAGE || "ghcr.io/mrostami97/minio:RELEASE.2025-09-07T16-13-09Z";
  const cli = process.env.ROTATION_DOCKER_CLI_SOURCE || "/mnt/host/wsl/docker-desktop/cli-tools/usr/bin/docker";
  const compose = process.env.ROTATION_DOCKER_COMPOSE_SOURCE || "/mnt/host/wsl/docker-desktop/cli-tools/usr/local/lib/docker/cli-plugins/docker-compose";
  function docker(args, options = {}) {
    const result = spawnSync("docker", args, { encoding: "utf8", timeout: 30_000, ...options });
    assert.equal(result.error, undefined, "Docker fixture invocation failed");
    assert.equal(result.status, 0, "Docker fixture operation failed; no private diagnostics are printed");
    return result.stdout.trim();
  }
  docker(["volume", "create", volume]);
  const controlRoot = JSON.parse(docker(["volume", "inspect", volume]))[0].Mountpoint;
  const fixtureRoot = `${controlRoot}/project`;
  try {
    docker(["run", "-d", "--name", helper, "--pull", "never", "--user", "0", "--entrypoint", "bash",
      "--mount", `type=volume,src=${volume},dst=${controlRoot}`,
      "--mount", `type=bind,src=${resolve(new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u, "$1"))},dst=/source,readonly`,
      "--mount", "type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock",
      "--mount", `type=bind,src=${cli},dst=/usr/local/bin/docker,readonly`,
      "--mount", `type=bind,src=${compose},dst=/usr/local/lib/docker/cli-plugins/docker-compose,readonly`,
      apiImage, "-c", "sleep infinity"]);
    const composeDefinition = {
      name: project,
      services: {
        postgres: { image: "postgres:16", environment: { POSTGRES_USER: "konkur", POSTGRES_DB: "konkurcom", POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:-synthetic_pg_8aKyNTwY}" }, volumes: ["postgres_data:/var/lib/postgresql/data"], healthcheck: { test: ["CMD", "pg_isready", "-U", "konkur", "-d", "konkurcom"], interval: "2s", timeout: "2s", retries: 30 } },
        minio: { image: minioImage, command: ["server", "/data", "--console-address", ":9001"], environment: { MINIO_ROOT_USER: "konkur", MINIO_ROOT_PASSWORD: "${MINIO_ROOT_PASSWORD:-synthetic_s3_5fGvGvzy}" }, volumes: ["minio_data:/data"], healthcheck: { test: ["CMD", "mc", "ready", "local"], interval: "2s", timeout: "2s", retries: 30 } },
        api: { image: apiImage, depends_on: { postgres: { condition: "service_healthy" }, minio: { condition: "service_healthy" } }, environment: { NODE_ENV: "production", DATABASE_URL: "postgresql://konkur:${POSTGRES_PASSWORD:-synthetic_pg_8aKyNTwY}@postgres:5432/konkurcom?schema=public", PORT: "3001", FRONTEND_URL: "https://fixture.invalid", TRUSTED_PROXY_CIDRS: "", S3_ENDPOINT: "minio", S3_PORT: "9000", S3_USE_SSL: "false", S3_ACCESS_KEY: "konkur", S3_SECRET_KEY: "${MINIO_ROOT_PASSWORD:-synthetic_s3_5fGvGvzy}", S3_BUCKET: "konkurcom-media", BOOTSTRAP_ADMIN_PHONE: "09990000000", BOOTSTRAP_ADMIN_PASSWORD: "${BOOTSTRAP_ADMIN_PASSWORD:-}" } },
        web: { image: apiImage, entrypoint: ["node", "-e", "setInterval(()=>{},1000)"], environment: { INTERNAL_API_URL: "http://api:3001" } },
      }, volumes: { postgres_data: {}, minio_data: {} },
    };
    const fixture = `set -euo pipefail
umask 077
mkdir -p '${fixtureRoot}/ops/backups' '${fixtureRoot}/scripts'
cd '${fixtureRoot}'
chmod 700 ops/backups
cp /source/ops/rotate-internal-credentials.sh ops/
cp /source/ops/rotate-internal-credentials.mjs ops/
cp /source/ops/backup.sh ops/
cp /source/scripts/check-production-config.mjs scripts/
cat > docker-compose.yml <<'COMPOSE'
${JSON.stringify(composeDefinition)}
COMPOSE
# Mirror the confirmed production legacy omission; defaults exist only here.
printf '%s\n' 'BOOTSTRAP_ADMIN_PHONE=09990000000' 'BOOTSTRAP_ADMIN_PASSWORD=synthetic_admin_p7nDSvwu' > .env
chmod 600 .env
docker compose up -d --no-build --pull never > ops/backups/fixture-private.log 2>&1
for attempt in $(seq 1 50); do
  if docker compose exec -T api node -e 'fetch("http://127.0.0.1:3001/healthz").then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))' < /dev/null >/dev/null 2>&1; then break; fi
  sleep 2
done
docker compose exec -T api node <<'NODE' > /dev/null 2>&1
const { Client } = require("minio");
const c = new Client({ endPoint: process.env.S3_ENDPOINT, port: 9000, useSSL: false, accessKey: process.env.S3_ACCESS_KEY, secretKey: process.env.S3_SECRET_KEY });
c.putObject(process.env.S3_BUCKET, "synthetic-existing-object.txt", Buffer.from("synthetic object retained across credential rotation")).catch(()=>process.exit(1));
NODE
docker compose exec -T minio sh -ec 'mc alias set fixture http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null; mc admin user add fixture synthetic-iam-user synthetic_iam_9zLeTsfc >/dev/null; mc admin policy attach fixture readwrite --user synthetic-iam-user >/dev/null; mc alias remove fixture >/dev/null' < /dev/null >/dev/null 2>&1
bash ops/backup.sh < /dev/null >> ops/backups/fixture-private.log 2>&1
web_before="$(docker compose ps --quiet web)"
run_rotation() { ROTATE_INTERNAL_CREDENTIALS=1 bash ops/rotate-internal-credentials.sh < /dev/null; }
run_rotation > ops/backups/success-summary.txt 2>&1
grep -q 'old credentials rejected' ops/backups/success-summary.txt
test "$(stat -c '%a' .env)" = 600
test "$(docker compose ps --quiet web)" = "$web_before"
if grep -q '^BOOTSTRAP_ADMIN_' .env; then exit 1; fi
cp .env ops/backups/environment.after-success
# The administrator's original login password remains valid after bootstrap removal.
docker compose exec -T api node <<'NODE' > /dev/null 2>&1
const { PrismaClient } = require("@prisma/client"); const { scryptSync, timingSafeEqual } = require("node:crypto");
const p = new PrismaClient({log:[]});
(async()=>{const u = await p.user.findUnique({where:{phone:"09990000000"}}); const [format,salt,key]=u.passwordHash.split("$"); if(format!=="scrypt" || !timingSafeEqual(scryptSync("synthetic_admin_p7nDSvwu",Buffer.from(salt,"hex"),64),Buffer.from(key,"hex")))process.exitCode=1; await p.$disconnect();})().catch(()=>process.exit(1));
NODE
docker compose exec -T api node <<'NODE' >/dev/null 2>&1
const {Client}=require("minio"); const c=new Client({endPoint:"minio",port:9000,useSSL:false,accessKey:"synthetic-iam-user",secretKey:"synthetic_iam_9zLeTsfc"}); c.getObject("konkurcom-media","synthetic-existing-object.txt").then(async stream=>{for await(const bytes of stream){} }).catch(()=>process.exit(1));
NODE
# Wrong on-disk config and absent backup must stop before changing real services.
sed -i 's/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=synthetic_wrong_config/' .env
if run_rotation > ops/backups/wrong-config-summary.txt 2>&1; then exit 1; fi
grep -q 'credentials were not changed' ops/backups/wrong-config-summary.txt
cp ops/backups/environment.after-success .env
if ROTATION_SQL_BACKUP="$PWD/ops/backups/absent.sql.gz" run_rotation > ops/backups/missing-backup-summary.txt 2>&1; then exit 1; fi
grep -q 'credentials were not changed' ops/backups/missing-backup-summary.txt
# Remove ADMIN roles only from this disposable fixture, then prove refusal.
docker compose exec -T api node <<'NODE' >/dev/null 2>&1
const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient({log:[]}); (async()=>{await p.userRole.deleteMany({where:{role:"ADMIN"}}); await p.$disconnect();})().catch(()=>process.exit(1));
NODE
if run_rotation > ops/backups/no-admin-summary.txt 2>&1; then exit 1; fi
grep -q 'credentials were not changed' ops/backups/no-admin-summary.txt
docker compose exec -T api node <<'NODE' >/dev/null 2>&1
const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient({log:[]}); (async()=>{const u=await p.user.findUnique({where:{phone:"09990000000"}}); await p.userRole.create({data:{userId:u.id,role:"ADMIN"}}); await p.$disconnect();})().catch(()=>process.exit(1));
NODE
# A narrow Docker boundary wrapper creates real failures after actual mutations.
mkdir -p fixture-bin
cat > fixture-bin/docker <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
fixture_root="${fixtureRoot}"
if [[ "$*" = *'exec -T postgres psql'* ]] && [ -f "$fixture_root/fixture-db-fail" ]; then
  input="$(mktemp "$fixture_root/ops/backups/.sql-fixture-XXXXXX")"
  cat > "$input"
  if grep -q '^ALTER ROLE ' "$input"; then
    /usr/local/bin/docker "$@" < "$input" >/dev/null 2>&1
    rm -- "$input" "$fixture_root/fixture-db-fail"
    exit 17
  fi
  /usr/local/bin/docker "$@" < "$input"
  rm -- "$input"
elif [[ "$*" = *'exec -T api node'* ]] && [ -f "$fixture_root/fixture-s3-fail" ]; then
  input="$(mktemp "$fixture_root/ops/backups/.probe-fixture-XXXXXX")"
  cat > "$input"
  if grep -q '^const oldS3Secret = "' "$input"; then
    /usr/local/bin/docker compose --project-directory "$fixture_root" --project-name '${project}' --file "$fixture_root/docker-compose.yml" --env-file "$fixture_root/.env" stop minio >/dev/null 2>&1
    rm -- "$input"
    exit 18
  fi
  /usr/local/bin/docker "$@" < "$input"
  rm -- "$input"
else exec /usr/local/bin/docker "$@"; fi
WRAPPER
chmod 700 fixture-bin/docker
touch fixture-db-fail
if DOCKER_BIN="$PWD/fixture-bin/docker" run_rotation > ops/backups/db-failure-summary.txt 2>&1; then exit 1; fi
grep -q 'original configuration, database credential and service access restored' ops/backups/db-failure-summary.txt
cmp .env ops/backups/environment.after-success
touch fixture-s3-fail
if DOCKER_BIN="$PWD/fixture-bin/docker" run_rotation > ops/backups/s3-failure-summary.txt 2>&1; then exit 1; fi
rm -- fixture-s3-fail
grep -q 'original configuration, database credential and service access restored' ops/backups/s3-failure-summary.txt
cmp .env ops/backups/environment.after-success
test "$(docker compose ps --quiet web)" = "$web_before"
echo 'PASS credential rotation, existing object, unchanged administrator password/web, wrong config, missing backup, missing ADMIN, DB rollback and storage rollback'
`;
    const result = spawnSync("docker", ["exec", "-i", helper, "bash", "-s"], { input: fixture, encoding: "utf8", timeout: 370_000 });
    assert.equal(result.error, undefined, "Fixture timed out or failed; private diagnostics retained only locally until cleanup");
    if (result.status !== 0) {
      const privateDebug = resolve("ops/backups", `fixture-debug-${suffix}`);
      mkdirSync(privateDebug, { recursive: true });
      spawnSync("docker", ["cp", `${helper}:${fixtureRoot}/ops/backups/.`, privateDebug], { encoding: "utf8", timeout: 30_000 });
      // Show only the last redacted stage summary, never .env/SQL/container logs.
      const summaries = spawnSync("docker", ["exec", helper, "bash", "-c", `for f in '${fixtureRoot}'/ops/backups/*summary.txt; do [ ! -f "$f" ] || tail -n 3 "$f"; done`], { encoding: "utf8" });
      assert.fail(`Rotation fixture failed (${result.status}): ${(summaries.stdout || result.stderr).slice(-2000)}`);
    }
    assert.match(result.stdout, /PASS credential rotation/);
  } finally {
    // The exact random fixture project is the only stack eligible for deletion.
    spawnSync("docker", ["exec", helper, "bash", "-c", `cd '${fixtureRoot}' && docker compose --project-name '${project}' down --volumes --remove-orphans`], { encoding: "utf8", timeout: 60_000 });
    spawnSync("docker", ["rm", "--force", helper], { encoding: "utf8", timeout: 30_000 });
    spawnSync("docker", ["volume", "rm", volume], { encoding: "utf8", timeout: 30_000 });
  }
});
