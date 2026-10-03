# Runbook

## Environment

There is one `docker-compose.yml`, and it is the production stack: postgres,
redis, minio, api, web, nginx (TLS termination), a one-shot `certs-init`
bootstrap service, and the Certbot renewal service. There is no separate
dev-only compose file.

```bash
docker compose up -d --build
docker compose exec api pnpm prisma migrate deploy
docker compose exec api pnpm run seed
```

This serves the web app at `https://<WEB_DOMAIN>` (default `https://localhost`)
and the browser API at `https://<WEB_DOMAIN>/api`. `API_DOMAIN` remains an
optional compatibility hostname. Localhost uses a self-signed certificate, so
local browsers and `curl` warn by default (`curl -k` locally). A public
`WEB_DOMAIN` uses Let's Encrypt automatically unless `TLS_MODE=selfsigned` is
set explicitly.

### Runtime secret preflight

Root `.env.example` intentionally leaves `POSTGRES_PASSWORD` and
`MINIO_ROOT_PASSWORD` blank. Supply strong, unique values of at least 16
characters; empty, repeated-character and known placeholder values fail the
production preflight. Use URL-safe random characters for the PostgreSQL
password because Compose embeds it into `DATABASE_URL`.

For an existing Postgres volume, changing `.env` does **not** change the
database user's password. A separately planned rotation must first change
the database credential and then update the configuration consistently.
Do not automatically rotate credentials during deployment. Verify backups,
ownership and service access before a planned credential change.

The API image starts with
`node /app/scripts/check-production-config.mjs --require-credentials` before
migrations and bootstrap. Deployment runs the same offline check before
restarting the stack. It requires valid strong database/S3 credentials and
an HTTPS `FRONTEND_URL`. Administrator bootstrap requires both fields or
neither, with a strong password when supplied. Configured proxy ranges must
be explicit CIDRs with nonzero prefixes; empty remains valid for direct nginx.
Errors name fields without printing secret values. A successful preflight
does not prove service connectivity or change credentials.

Private database and media backups, protected off-site retention, and a
reviewed recovery procedure remain production preflight requirements. The
isolated local backup proof below does not establish production backup or
media recovery readiness.

### Visitor identity behind a CDN

Configure `TRUSTED_PROXY_CIDRS` in the server-side `.env` with the reviewed
egress networks of the CDN that actually proxies this site. Comma-separated
or space-separated IPv4/IPv6 CIDRs are accepted; write individual IPs with
explicit `/32` or `/128` prefixes. Empty means the actual client connected to
nginx, without trusting
an earlier forwarded address. `TRUSTED_PROXY_HOPS` is obsolete and ignored.
Keep the API port unpublished, as in the checked-in Compose stack: the guard
depends on nginx appending its actual peer address.

For ParsPack, use the [official network list](https://parspack.com/cdnips.txt)
and its [whitelist instructions](https://docs.parspack.com/cdn/whitelist-cdn-ip/).
On 2026-10-02 the list contained 49 ranges. Retrieve the current list, inspect
changes and verify the site's active CDN routing before copying the approved
ranges into `TRUSTED_PROXY_CIDRS`. Do not update trust automatically from a
remote list or an incoming `X-Forwarded-For` header. Do not use `/0` networks.

Recreate the API service after changing the setting:

```bash
docker compose up -d --no-build api
docker compose logs --tail 50 api
```

An invalid CIDR prevents startup. With a CDN enabled and an empty trust list,
visitors behind the same CDN peer share that peer's limit; this setting must
be reviewed before production rollout. Application CIDR trust and firewall
allowlisting are separate settings; changing this variable does not change
the server firewall.

### Production authentication

The configured console OTP provider is for development only. With
`NODE_ENV=production`, both OTP request and verification return 503 before
database work, and the provider does not log delivery codes or phone numbers.
Password login remains available. Deploy a real delivery provider through
the existing `OtpProvider` interface and verify it before enabling production
OTP; changing the development flag or relying on console logs is not a
production delivery setup.

## Migrations — up and down

```bash
# apply pending migrations
docker compose exec api pnpm prisma migrate deploy

# roll back only the latest migration (take a backup first)
docker compose exec api pnpm run migrate:down -- 20260906200000_phase9_content_commerce

# roll everything back and re-apply from scratch (dev/staging only — destructive)
docker compose exec api pnpm prisma migrate reset --force
```

`prisma migrate reset` drops the schema, re-runs every migration from zero, then
runs the seed script. New migrations are additive and carry a reviewed
`down.sql` alongside `migration.sql` (for example,
`apps/api/prisma/migrations/20260906120000_password_auth/`). Prisma itself only
executes the up file; the API's `migrate:down` command executes the checked-in
down file only for the latest applied migration and removes its ledger row.
Full reset or restoring the pre-migration backup remains the safer production
rollback path.

### Phase 9 content/commerce migration

Migration 20260906200000_phase9_content_commerce is additive. Existing courses
are backfilled as ENTITLEMENT, existing lessons as non-preview, report-card
consent as false, subject/topic slugs from their existing codes, existing
course products into product_course_grants, and legacy article snapshots as
article.v1.

Before deploy:

    ops/backup.sh
    docker compose exec api pnpm prisma migrate deploy
    docker compose exec api pnpm run seed

The seed is repeatable. It creates the unpublished contributor profile, keeps
the existing paid course grant, and stages the current generated editorial
pages as article.v2 drafts without publishing an unreviewed byline. Once one
of those slugs exists, later seed runs leave its canonical record, workflow
status, source links and revision payload untouched so deployment cannot erase
editorial work. Regenerate the checked-in draft fixture after an intentional
edit to an editorial corpus:

    node scripts/generate-editorial-drafts.mjs

The down migration succeeds only while all Phase 9-only state is still
representable by the previous schema. It intentionally aborts atomically when
it finds resources, resource/bundle products, article.v2, content sources,
contributor profiles, source links, non-default access/taxonomy metadata,
preview lessons, prerequisite links, or a positive report-card publication
consent. Do not delete those records to force a production downgrade; restore
the pre-migration backup instead.

Paid resource delivery is authorized from active Entitlements, proxied by the
API, marked private/no-store, and served with an inline content disposition.
An artifact can be attached or streamed only in `USER_UPLOAD` or
`MIRRORED_WITH_PERMISSION` mode, and only while an active source explicitly has
`mayHost=true` plus a documented hosting-rights basis. `METADATA_ONLY`,
`EXTERNAL_LINK`, and `OFFICIAL_EMBED` never stream a stored artifact. Changing
hosting mode requires clearing incompatible artifact/link fields; the admin UI
does this explicitly and the API rejects an unsafe retained attachment.
The public checksum media route refuses every artifact referenced now or
previously by a Resource, including public, detached, draft, rejected, and
historical revisions. Resource bytes are available only through the authorized
`/resources/:slug/content` endpoint. Public DTOs omit object-storage keys,
artifact identifiers, provenance, and internal source-link identifiers. A
published resource stays canonical and available while its next revision is a
draft, in review, or rejected; only approval promotes the revision atomically.
This limits ordinary link sharing; it is not DRM and cannot prevent screenshots
or a determined client from saving received bytes.

### Phase 17 doctoral corpus and safe draft upgrade

The 16 doctoral guides live in
`apps/web/src/content/phase17-corpus.json`. They are AI-assisted editorial
drafts, so the generated article.v2 payloads must retain
`review_status=draft`, `producer_type=external_ai`, an empty human byline,
and the official-source review deadline. They must not be added to the static
guide fallback, sitemap, RSS, search index, or `llms.txt` before a real human
reviewer approves them.

Before deployment or after changing this corpus:

    node scripts/generate-editorial-drafts.mjs
    node apps/web/test/phase17-corpus.mjs

Take the normal database backup before deploying, then run the repeatable
seed. Three pre-Phase-17 drafts used the final column slugs. The seed upgrades
only an exact, untouched version-1 copy of those legacy payloads and source
links, creates version 2, and preserves version 1. Any changed, submitted,
rejected, or published record is left alone. The exact legacy payloads are
kept only as guards in
`apps/api/src/seed-data/phase17-legacy-editorial-drafts.json`.

Before approval, compare codes 2247, 2354 and 2358, their subject groups,
combinations and coefficients against the latest registration booklet and
every later Sanjesh correction. Confirm that the 2247 pages keep the separate
Computer Science and Bioinformatics combinations intact, and keep the
written-exam pages separate from CV/interview preparation. Only then submit
and approve each draft through the normal article review workflow.

Reverting the code does not delete a created draft version. The public
article-version rollback endpoint cannot target the legacy version 1 here:
that snapshot is a Draft and version 2 is also pending. Do not delete either
version or rewrite the Prisma migration ledger. To undo an applied legacy
upgrade, restore the pre-deploy backup and redeploy the previous commit.

## Backup / restore

```bash
ops/backup.sh                       # writes ops/backups/konkurcom-<timestamp>-<id>.sql.gz
ops/restore.sh ops/backups/konkurcom-<timestamp>-<id>.sql.gz
```

`restore.sh` terminates other open connections to `konkurcom` before dropping
it (a running API process holding a Prisma connection will otherwise make
`DROP DATABASE` fail with "database is being accessed by other users").

Backups contain user records. The script sets `umask 077`, restricts the
backup directory to mode 700 and creates mode-600 files. It streams the dump
into a unique temporary file in that directory, checks gzip integrity and
nonempty SQL, then renames it atomically. A failed dump or validation leaves
no new final backup; cleanup removes only that invocation's temporary file.
Existing backups and media are retained. The random suffix also separates
backups created within the same second.

Before a production backup, confirm the target stack and database, available
disk space, backup ownership and protected storage. If using a separate
Compose fixture, set `COMPOSE_FILE` to its **absolute path**: these scripts
change to the repository directory. Do not run `restore.sh` against production
to test a backup. Its confirmation permits a database drop and is not a
substitute for independently verifying the target.

`backup.sh` accepts `DOCKER_BIN` as one executable path, defaulting to
`docker`. `DOCKER_USE_SUDO=1` adds `sudo` as a separate argument; do not set
`DOCKER_BIN="sudo docker"`. When supplied, the absolute `COMPOSE_FILE` and
optional `COMPOSE_PROJECT_NAME` are passed explicitly to Compose, preserving
the target even if sudo filters the environment. For example:

```bash
DOCKER_BIN=docker DOCKER_USE_SUDO=1 bash ops/backup.sh
```

Verification on 2026-10-02 used a new disposable Postgres 16 Compose project,
its own volume and explicit absolute `COMPOSE_FILE`. A synthetic baseline row
was backed up, a second row added, and the actual restore script returned the
database to the baseline. Linux modes 700/600, valid nonempty gzip, and cleanup
after a real failed `pg_dump` were verified. No production or pre-existing
test database was used. Production backup availability, off-host retention
and restore readiness still require an operational preflight; a local fixture
does not confirm them.

The isolated shell regression fixture covers partial/empty dumps, invalid
gzip, signal cleanup, preservation of unrelated files and concurrent
backups. It uses the cached image without network access or a Docker socket:

```bash
BACKUP_SECURITY_DOCKER_TEST=1 node --test scripts/test/backup-security.test.mjs
```

## Rollback of a bad deploy

1. Stop the stack (or just the affected service).
2. Restore the pre-deploy database backup with `ops/restore.sh`.
3. Redeploy the previous known-good git commit (`git checkout <sha>` +
   redeploy, or re-run the GitHub Actions deploy job against that commit).

## TLS certificate

`certs-init` first guarantees that nginx has a matching key/certificate pair.
For localhost or `TLS_MODE=selfsigned`, that pair remains self-signed. For a
public hostname in `auto`/`acme` mode, it is only a bootstrap certificate:
Certbot validates `WEB_DOMAIN` with HTTP-01, stores its durable state in the
`letsencrypt_data` volume, atomically copies the active pair into
`nginx_certs`, and advances a reload marker. The nginx watcher runs `nginx -t`
before every hot reload, so a partial or mismatched pair is never activated.

Production `.env` should include at least:

```dotenv
WEB_DOMAIN=kunkurcomputer.ir
TLS_MODE=auto
ACME_EMAIL=owner@example.com
```

The derived `www.<WEB_DOMAIN>` alias and optional `API_DOMAIN` are included only
when they resolve in public DNS. Because Certbot computes the requested names
when its container starts, restart it after a DNS change:
`docker compose restart certbot`.

Verification commands:

```bash
docker compose logs --tail 100 certbot nginx
curl -I https://kunkurcomputer.ir/
curl -I https://www.kunkurcomputer.ir/     # expected: 308 to the apex host
curl https://kunkurcomputer.ir/api/healthz
```

Do not delete `letsencrypt_data` during a normal redeploy. If a bootstrap
certificate needs regeneration, stop the stack, back up the named volumes,
and remove only the exact project `nginx_certs` volume after verifying its
resolved name; the next start recreates it.

## Search-engine submission

The public IndexNow verification file lives at `/indexnow-key.txt`. After a
successful production deploy, submit every canonical URL discovered through
the sitemap index with:

```bash
pnpm run indexnow:submit -- --dry-run
pnpm run indexnow:submit
```

The first command validates the sitemap tree without notifying an engine. The
second sends one batch to the shared IndexNow endpoint and treats HTTP 200 or
202 as accepted. Search Console and Bing Webmaster Tools still require the
owner's authenticated accounts and their own ownership-verification flow;
IndexNow acceptance is not a substitute for either registration.

## CD (SSH deploy)

`.github/workflows/ci.yml` is a single job that builds, lints, and tests on
every push/PR, then -- only on a push to `main`, and only if every step above
it passed -- deploys over SSH as the last few steps of that same job. There
is no separate deploy workflow: deploy steps are gated with `if:` conditions
rather than a second workflow triggered off the first, so there's no
cross-workflow indirection to reason about. It's a no-op until these GitHub
Secrets exist on the repo:

- `SSH_HOST`, `SSH_USER`, `SSH_KEY` — target server and private key (primary auth)
- `SSH_KNOWN_HOSTS` — OpenSSH known-hosts entry for `SSH_HOST`, obtained from an independently verified server host key
- `SSH_PASS` — optional password fallback if the deploy user has no key configured on the server; not needed alongside a working `SSH_KEY`
- `DEPLOY_PATH` — absolute path on the server to `git pull` / `docker compose up -d --build` in

See `README.md`'s secrets table.

Until a real server exists, the job logs "deploy skipped: SSH_HOST not set" and
exits 0 so it never blocks CI.

If `SSH_HOST` is configured, `SSH_KNOWN_HOSTS` is required. Obtain the host
public key and fingerprint through a trusted provider console or another
independently authenticated administrator channel. Compare that fingerprint
before saving the matching OpenSSH entry as the repository secret. The entry
must cover the exact hostname or IP in `SSH_HOST`; a fingerprint alone is not
a known-hosts entry. Keep real key material out of source files and examples.

The workflow checks the entry with `ssh-keygen`, writes it with mode 600 and
uses `StrictHostKeyChecking=yes` plus the explicit `UserKnownHostsFile` for
every SSH connection and rsync transfer. An unexpected host-key change fails
deployment. Investigate and independently verify legitimate rotations before
updating the secret. A key obtained only with unauthenticated `ssh-keyscan`
must not become trusted without that verification.

**Everything the server needs is auto-provisioned on every deploy run.** The
server compiles nothing and needs no persistent GitHub credential of its own:
the runner builds and publishes immutable images, and the server pulls them
with the workflow's short-lived token.

- **Docker Engine + the Compose plugin.** If `docker` isn't on `PATH`, the
  deploy script installs it, using `sudo` when the SSH user isn't root:
  first Docker's convenience script (`get.docker.com`), which covers
  Debian/Ubuntu/Fedora; if that refuses the distro — it rejects RHEL
  rebuilds outright with `Unsupported distribution 'almalinux'`, which is
  exactly what this server is — it falls back to Docker's own CentOS
  package repo via `dnf`/`yum`, which is what Docker documents for
  AlmaLinux/Rocky/RHEL. The RPM packages don't start the daemon
  themselves, so it runs `systemctl enable --now docker` afterwards.
  If a fresh install isn't yet in the `docker` group (group membership
  wouldn't take effect until a new login anyway), the rest of that deploy
  run's `docker`/`docker compose` commands are prefixed with `sudo`
  automatically.
- **Firewall.** On RHEL-family hosts firewalld is usually active and blocks
  80/443 by default, so the script opens the `http`/`https` services if
  firewalld is running. Best effort — never fatal.
- **`rsync`**, installed if missing, because that's how the source arrives.
- **The source itself.** The runner rsyncs its own checkout to `DEPLOY_PATH`
  (default `/opt/app` when the `DEPLOY_PATH` secret is unset). The runner is
  already authenticated to this private repo, so **the server needs no git
  credential and doesn't even have to be a git checkout** — which is what
  used to break here, first as "git: command not found" and then as
  "ERROR:  is not a git checkout" against an empty path. `.env` and
  `node_modules` are excluded from the sync so server-side secrets survive
  `--delete`.
- **The images.** `docker compose build api web` runs on the runner. The web
  image uses Next.js standalone output and the API image contains production
  dependencies only, keeping the deployment payload bounded. After validation,
  CI pushes both commit-addressed images to GitHub Container Registry. The VPS
  authenticates with the workflow's masked, job-scoped `GITHUB_TOKEN`, pulls
  content-addressed layers directly from GHCR, then removes the temporary Docker
  auth directory. This replaces the runner-to-VPS SSH archive path, which was
  too slow for production delivery. The server tags the verified images with
  Compose's local names and runs `docker compose up -d --no-build`, so it
  compiles nothing. If startup fails it still falls back to `up -d --build`,
  keeping the previous containers available while the new images are pulled.
- The post-deploy `/healthz` wait (below) also runs `curl` in a container
  (`curlimages/curl`), not on the host.

**Fallback:** if the server has no `rsync` and none can be installed, the
deploy clones over HTTPS using the workflow's own `GITHUB_TOKEN` (repo-scoped,
expires with the job) inside a `buildpack-deps:bookworm-scm` container, then
rewrites the remote so the token isn't left behind in `.git/config`.

### Post-deploy health check

The last thing every deploy does is wait for the service to actually come up.
After `docker compose up -d`, the script polls the API `GET /healthz` and the
web homepage through nginx (resolved by IP, so public DNS is not required)
every 3s for up to 180s. It succeeds only when the API reports
`"status":"ok"` and the homepage returns HTTP 200. Otherwise it prints the
last responses, compose state and relevant logs, then **fails the job** — so a
green deployment proves both public entry points are serving.

`/healthz` checks real connectivity to Postgres and MinIO/S3 — not just "the
process started" — so a deploy that "succeeds" but leaves the API unable to
reach its database or object storage is caught here. See
`apps/api/src/health/healthz.controller.ts`.

### Images

All infra images (`postgres`, `redis`, `nginx`, the `certs-init` helper, and
the deploy script's own throwaway `git`/`curl` containers) are mainstream,
Debian-based (glibc) images, not Alpine — chosen for broader compatibility
over the smaller image size.

## Logs / errors

`apps/api` logs to stdout via Nest's default logger (structured upgrade —
pino/OpenTelemetry — is a later-phase Observability item per doc §5.1).
`docker compose logs -f <service>` covers every service, including `nginx`,
`certs-init`, `api`, and `web`.

## Internal credential maintenance

`ops/rotate-internal-credentials.sh` is a reviewed, opt-in rotation for this
site's PostgreSQL role and MinIO root credential. It requires private `.env`
permissions, an existing ADMIN password credential, a validated SQL backup
less than two hours old, sufficient space for a media archive, and the pinned
MinIO release without KMS, external identity or file-provided credentials.
Verify the disposable Docker fixture before using it on a server. Avoid an
overlapping deployment; the script also takes a local exclusive rotation lock.

Legacy deployments may omit the two password variables and use Compose
defaults. Only agreeing credentials from the inspected running client and
database/storage containers are accepted in that case; actual access is still
verified before any mutation. Explicit empty or conflicting on-disk values
are rejected. New secrets are written explicitly, while rollback preserves
the original environment and pins the actual old container credentials.

Run it from the existing deployment root with `ROTATE_INTERNAL_CREDENTIALS=1`.
The Bash orchestrator uses the cached running API image for offline helpers;
it does not require host Node, pull images, build, remove persistent volumes,
change the actual administrator password, or run a data restore. Existing
images, commands and persistent mount sources are pinned for both forward
operation and rollback. The API pauses while database and storage credentials
change. Separate bounded readiness and access checks verify administrator
hashes, an existing object, unchanged IAM records and rejection of old secrets.

Generated secrets and rollback state stay in a private directory under
`ops/backups`, excluded from Git, image builds and deploy deletion. Keep this
state until post-maintenance verification is complete. Recovery uses the old
environment, exact database verifier and cached images; it requires the Docker
daemon and storage to remain available. A failed recovery needs local operator
attention and must never be described as successful.

The temporary `security-production-rotate.yml` workflow is restricted to the
review branch and changes to that workflow file. It sends only the reviewed
helpers over pinned SSH, checks their digests, bounds setup and execution, and
returns encrypted diagnostics. It is not triggered by application edits or
normal pushes to `main`.

## Unused host RPC maintenance

`ops/disable-unused-rpcbind.sh` is opt-in (`RPC_HARDENING=1`) and runs from
the existing deployment root. Before any service change it requires private
root-owned configuration/backups, stable active RPC units, no configured or
mounted NFS/CIFS exports/filesystems, no kernel NFS workers and a registry
containing only the portmapper. It inspects reverse dependencies, stop
propagation and activation triggers, refusing unrelated active or enabled
consumers. It checks the existing site and API through verified origin TLS.

Only `rpcbind.socket` and `rpcbind.service` are disabled and stopped. The
operation verifies TCP/UDP port 111 is closed in both IPv4 and IPv6 and checks
site/API health again. A failure after mutation attempts restoration of the
exact original RPC enablement and active states, with a fresh health check;
failed recovery is reported explicitly. It does not alter SSH or firewall
policy. State remains private under `ops/backups` and is excluded from deploy
deletion. The exclusive lock prevents overlapping RPC maintenance.

Run the cached isolated Linux fixture before use:

```sh
RPC_HARDENING_DOCKER_TEST=1 node --test scripts/test/rpcbind-hardening.test.mjs
```

The temporary `security-host-rpc.yml` workflow uses pinned SSH and digest-checked
helpers with encrypted diagnostics. Its three-minute execution deadline allows
another four minutes for bounded recovery. It is restricted to the review
branch and changes to its own workflow file; normal `main` pushes do not run it.
