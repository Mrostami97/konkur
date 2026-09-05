# KonkurCom 360

Platform spec: `KonkurCom-360-Architecture-FA-v2-NoAI.docx`. Execution
protocol and module map: [AGENTS.md](AGENTS.md). **Read AGENTS.md before
changing anything** — it explains the one-phase-at-a-time rule this repo is
built under.

Current state: **Phase 0 — contracts & infrastructure.**

## Stack

- `apps/api` — NestJS + Prisma + PostgreSQL
- `apps/web` — Next.js (App Router) + TypeScript, RTL
- `contracts` — versioned JSON Schemas (`article.v1`, `report-card.v1`,
  `question.v1`) + AJV validators shared by the whole repo
- Redis + MinIO (S3-compatible) for cache/queue and object storage
- pnpm workspaces monorepo

## Quickstart

Requires Docker (for Postgres/Redis/MinIO) and a Node 20+ / pnpm toolchain —
run everything below inside a Node container if you don't want either
installed on your machine:

```bash
docker run --rm -it -v "$PWD:/w" -w /w -p 3000:3000 -p 3001:3001 \
  --network host node:20-bookworm bash
corepack enable && corepack prepare pnpm@9 --activate
```

Then:

```bash
docker compose up -d                              # postgres, redis, minio
cp apps/api/.env.example apps/api/.env
pnpm install
pnpm --filter api prisma migrate deploy
pnpm --filter api run seed                         # 1 admin + 1 student
pnpm dev:api                                       # http://localhost:3001
pnpm dev:web                                       # http://localhost:3000 (separate shell)
```

Seeded users (OTP via console log — check the API's stdout for the code):

- Admin: `+989120000001`
- Student: `+989120000002`

## Common commands

```bash
pnpm -w run lint
pnpm -w run typecheck
pnpm -w run build
pnpm -w run test                 # unit tests, all workspaces
pnpm --filter api run test:e2e   # integration tests against a real Postgres
```

## Repo layout

```
contracts/     JSON Schemas, fixtures, AJV validators (packages/contracts-style)
apps/api/      NestJS backend (Prisma schema + migrations live here)
apps/web/      Next.js frontend
ops/           backup/restore scripts + runbook
.github/       CI (lint/test/build) and CD (SSH deploy, inert until configured)
```

Operational details (backups, rollback, deploy secrets) are in
[ops/runbook.md](ops/runbook.md).
