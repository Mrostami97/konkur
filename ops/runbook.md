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
ops/backup.sh                       # writes ops/backups/konkurcom-<timestamp>.sql.gz
ops/restore.sh ops/backups/konkurcom-<timestamp>.sql.gz
```

`restore.sh` terminates other open connections to `konkurcom` before dropping
it (a running API process holding a Prisma connection will otherwise make
`DROP DATABASE` fail with "database is being accessed by other users").

Tested manually against the compose Postgres:
1. Seed the database, note row counts (`admin`/`student` users).
2. Run `ops/backup.sh`.
3. Insert a throwaway row, then run `ops/restore.sh` with the backup file
   (API server still running against the database at the time).
4. Confirmed: the throwaway row is gone and the two seeded rows are back —
   restore works, including under an active connection.

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
WEB_DOMAIN=kunkur01.ir
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
curl -I https://kunkur01.ir/
curl -I https://www.kunkur01.ir/     # expected: 308 to the apex host
curl https://kunkur01.ir/api/healthz
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
- `SSH_PASS` — optional password fallback if the deploy user has no key configured on the server; not needed alongside a working `SSH_KEY`
- `DEPLOY_PATH` — absolute path on the server to `git pull` / `docker compose up -d --build` in

See `README.md`'s secrets table.

Until a real server exists, the job logs "deploy skipped: SSH_HOST not set" and
exits 0 so it never blocks CI.

**Everything the server needs is auto-provisioned on every deploy run.** The
server compiles nothing and needs no GitHub credential of its own: the runner
builds, the runner ships.

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
- **The images.** `docker compose build api web` runs on the runner, and both
  images are streamed to the server in a single `docker save | gzip | docker
  load` (one stream, so their shared base layers dedupe). The server then runs
  `docker compose up -d --no-build` and compiles nothing. If that fails for
  any reason it falls back to `up -d --build`, so a botched image transfer
  can't take the site down — it just makes that one deploy slow.
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
