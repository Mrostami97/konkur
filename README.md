# Konkur — educational platform for CS/IT entrance exams

Konkur is an actively developed Persian educational platform for graduate and doctoral Computer Science, Computer Engineering, and Information Technology entrance-exam workflows.

This repository contains the web application, API, shared contracts, database migrations, editorial/content tooling, deployment automation, and production-oriented infrastructure used by the project.

## What is in the repository

- **Web:** Next.js application with Persian/RTL UI, public content, student flows, and admin-facing surfaces.
- **API:** NestJS + Prisma service for identity, content, resources, entitlements, educational data, and application workflows.
- **Data:** PostgreSQL migrations and validated shared schemas/contracts.
- **Object storage:** MinIO/S3-compatible media and resource storage.
- **Infrastructure:** Docker Compose, nginx TLS termination, Certbot automation, backups/restore tooling, and GitHub Actions CI/CD.
- **Editorial workflow:** versioned content, source/provenance metadata, draft/review controls, and generated corpus validation.

The project is a product codebase, not only a demo. Some roadmap areas remain under active development; `TODO.md` and the documents under `docs/` describe current phases and constraints.

## Repository layout

```text
apps/
  api/       NestJS/Prisma backend
  web/       Next.js frontend
contracts/   shared schemas, validators, and fixtures
docs/        architecture, content, research, and phase notes
ops/         deployment, TLS, backup/restore, and nginx tooling
scripts/     repository and content automation
```

## Requirements

- Node.js 20+
- pnpm 9.12+
- Docker Engine + Docker Compose plugin for the full stack

## Quick start

```bash
git clone https://github.com/Mrostami97/konkur.git
cd konkur
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --build
```

For workspace-only development you can also run:

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm dev:api
pnpm dev:web
```

`docker-compose.yml` is also the production stack, so do not expose the local/default configuration to the public internet. Replace every production password in `.env` with a strong unique value.

## Administrator bootstrap

There is **no production administrator credential in source code**. The test suite uses an explicitly test-only credential against disposable test databases; application startup and direct seeding outside `NODE_ENV=test` never fall back to it.

Administrator bootstrap is disabled unless both values are explicitly supplied at runtime:

```dotenv
BOOTSTRAP_ADMIN_PHONE=
BOOTSTRAP_ADMIN_PASSWORD=
```

If only one is provided, startup fails rather than silently creating an unexpected account. After initial provisioning, keep the administrator password under normal account management and remove bootstrap values when they are no longer needed.

## Configuration

Start from `.env.example`. Important production-only values include:

| Variable | Purpose |
| --- | --- |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `MINIO_ROOT_PASSWORD` | MinIO root/S3 secret |
| `WEB_DOMAIN` | Canonical public hostname |
| `TLS_MODE` | `auto`, `acme`, or `selfsigned` |
| `ACME_EMAIL` | Let's Encrypt expiry/contact email |
| `BOOTSTRAP_ADMIN_PHONE` | Optional initial administrator phone |
| `BOOTSTRAP_ADMIN_PASSWORD` | Optional initial administrator password |

GitHub Actions deployment additionally uses repository secrets such as `SSH_HOST`, `SSH_USER`, `SSH_KEY`, and `DEPLOY_PATH`. Never commit their real values.

Detailed deployment, TLS, backup/restore, migration, rollback, and health-check procedures are documented in [`ops/runbook.md`](ops/runbook.md).

## Testing and CI

The GitHub Actions workflow builds the workspaces, runs lint/type checking, unit and integration tests, validates production images and TLS bootstrap, and deploys only from `main` after the preceding gates succeed.

Before opening a pull request, run the checks relevant to your change:

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

Behavior changes should include regression tests. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Security and privacy

Do not put real credentials, private keys, production `.env` files, session material, or student PII in commits, fixtures, issues, or logs.

For vulnerability reporting and credential-handling rules, see [`SECURITY.md`](SECURITY.md).

## Contributing

Contributions are welcome when they preserve the project's validation, provenance, privacy, and review rules. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) and keep pull requests focused and testable.

## License

Original project source code and documentation are available under the [MIT License](LICENSE), except where a file or directory states otherwise.

Third-party fonts, images, documents, dependencies, trademarks, and other assets are **not automatically relicensed under MIT**. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) before redistributing non-code assets.
