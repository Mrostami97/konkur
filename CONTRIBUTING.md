# Contributing

Thanks for helping improve Konkur.

## Development setup

Requirements:

- Node.js 20+
- pnpm 9.12+
- Docker with the Compose plugin for the full integration stack

Install dependencies and run the standard checks:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

For a full local stack:

```bash
cp .env.example .env
docker compose up -d --build
```

The values in `.env.example` are placeholders/local defaults. Never commit real production credentials.

## Pull requests

1. Create a focused branch from `main`.
2. Add or update tests for behavior changes.
3. Keep migrations additive where possible and document rollback implications.
4. Run the relevant build, lint, typecheck, unit, and integration checks.
5. Explain the user-visible behavior, security implications, and operational changes in the PR description.
6. Do not publish AI-assisted editorial content as human-reviewed content; preserve the repository's review/provenance rules.

Keep pull requests scoped. Avoid unrelated formatting or refactors in a bug fix.

## Security and privacy

Do not commit secrets, private keys, production `.env` files, session material, student PII, or private source artifacts. See `SECURITY.md` for vulnerability reporting.

Fixtures that test PII rejection must use obviously synthetic values.

## Licensing

By contributing original source code or documentation to this repository, you agree that your contribution may be distributed under the repository's MIT license. Do not submit third-party assets unless their license permits redistribution and the applicable notice is documented.
