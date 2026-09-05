# Phase 0 Runbook

## Local environment

```bash
docker compose up -d          # postgres, redis, minio
pnpm install
pnpm --filter api prisma migrate deploy
pnpm --filter api run seed
pnpm dev:api                  # http://localhost:3001
pnpm dev:web                  # http://localhost:3000
```

## Migrations — up and down

```bash
# apply pending migrations
pnpm --filter api prisma migrate deploy

# roll everything back and re-apply from scratch (dev/staging only — destructive)
pnpm --filter api prisma migrate reset --force
```

`prisma migrate reset` drops the schema, re-runs every migration from zero, then
runs the seed script. This is the "down" path validated for Phase 0: there is
no partial per-migration down script (Prisma migrations are forward-only by
design), so rollback of a bad migration in a real environment means restoring
the pre-migration backup (see below), not a scripted `down`.

## Backup / restore

```bash
ops/backup.sh                       # writes ops/backups/konkurcom-<timestamp>.sql.gz
ops/restore.sh ops/backups/konkurcom-<timestamp>.sql.gz
```

`restore.sh` terminates other open connections to `konkurcom` before dropping
it (a running API process holding a Prisma connection will otherwise make
`DROP DATABASE` fail with "database is being accessed by other users").

Tested manually against the compose Postgres as part of Phase 0 sign-off:
1. Seed the database, note row counts (`admin`/`student` users).
2. Run `ops/backup.sh`.
3. Insert a throwaway row, then run `ops/restore.sh` with the backup file
   (API server still running against the database at the time).
4. Confirmed: the throwaway row is gone and the two seeded rows are back —
   restore works, including under an active connection.

## Rollback of a bad deploy

Since Phase 0 has no production traffic yet, "rollback" means:
1. Stop the API process / container.
2. Restore the pre-deploy database backup with `ops/restore.sh`.
3. Redeploy the previous known-good git commit (`git checkout <sha>` +
   redeploy, or re-run the GitHub Actions deploy job against that commit).

## CD (SSH deploy)

`.github/workflows/deploy.yml` runs on push to `main` after CI passes. It is a
no-op until these GitHub Secrets exist on the repo:

- `SSH_HOST`, `SSH_USER`, `SSH_KEY` — target server and private key
- `DEPLOY_PATH` — absolute path on the server to `git pull` / `docker compose -f docker-compose.prod.yml up -d --build` in

Until a real server exists, the job logs "deploy skipped: SSH_HOST not set" and
exits 0 so it never blocks CI. When a server is ready: create the secrets,
`git clone` the repo once at `DEPLOY_PATH` on that host with a checked-out
deploy key, and push to `main`.

## Logs / errors

`apps/api` logs to stdout via Nest's default logger (structured upgrade —
pino/OpenTelemetry — is a later-phase Observability item per doc §5.1). In
Docker, `docker compose logs -f postgres|redis|minio` covers infra; the API/web
processes run outside compose in Phase 0 (see README), so use your terminal or
process manager's own log output.
