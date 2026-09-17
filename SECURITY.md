# Security policy

## Supported code

Security fixes are applied to the current `main` branch. Older commits, local forks, and unpublished snapshots are not separately supported.

## Reporting a vulnerability

Please do **not** open a public issue for a vulnerability, credential, personal data exposure, authentication bypass, or deployment secret.

Use GitHub's private **Report a vulnerability** flow for this repository when it is available. If that flow is unavailable, contact the repository owner through GitHub before publishing technical details.

A useful report includes:

- affected component and commit
- reproduction steps
- expected vs. observed behavior
- security impact
- whether the issue is already being exploited
- a minimal proof of concept when safe to provide

Never include real passwords, API tokens, private keys, session cookies, student records, or other personal data in a public issue, pull request, fixture, or log.

## Secrets and production configuration

Real production values belong in deployment secret stores or the server-side `.env`, never in Git. The checked-in `.env.example` files contain placeholders or local-development values only.

Administrator bootstrap is disabled unless both `BOOTSTRAP_ADMIN_PHONE` and `BOOTSTRAP_ADMIN_PASSWORD` are supplied explicitly at runtime. Use a strong, unique bootstrap password and change or remove bootstrap configuration after initial provisioning.

If a secret is ever committed, removing it in a later commit is not sufficient: revoke/rotate the secret first, then clean history if appropriate.
