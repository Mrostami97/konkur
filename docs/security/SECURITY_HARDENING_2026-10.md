# Security maintenance — October 2026

Owner-authorized maintenance scope: application input rendering, accepted media, per-content access, authentication lifecycle, browser-origin validation, assessment/booking concurrency, supported dependencies and deployment trust. Preserve the canonical domain, public content and SEO metadata, roles and ingestion review/publish workflow. This is one maintenance scope; no new product phase, runtime AI or external dataset is introduced.

## Contract and implementation plan

- Existing endpoint and response shapes remain. OTP with a console-only provider is unavailable in production at both UI and API; no delivery code is written to production logs.
- Authentication challenges are claimed conditionally and attempts remain bounded under concurrency. Credential rotation invalidates other sessions.
- Unsafe browser requests require a permitted origin when browser origin metadata is present; intentional nonbrowser internal calls remain supported.
- Media MIME is verified and active documents are rejected. Media access is checked against the owning public content or the current user's entitlement/attempt; staff previews retain their role boundary.
- ZIP input has actual expansion budgets in addition to compressed-size limits.
- Answer saves and grading coordinate using the same attempt row lock; question membership is required. Mastery excludes historical non-form answers and uses an updated rule version.
- Booking consumption locks the entitlement and rechecks validity before counting/inserting. No new database schema or migration is intended.
- Deployments pin the verified SSH host key. The gateway derives client identity from trusted peer networks, not a user-selected hop. Browser policy additions preserve Next hydration and public caching.
- Dependency migration stays on supported stable branches, with async routing compatibility and current image/upload libraries. Remaining advisory exceptions require documented feature applicability.

## Verification and risk

Run relevant unit, contract, web corpus/SEO, typecheck and build gates. Database concurrency verification uses a separately created disposable test database and object store with explicit connection variables; never the configured production database. No fixture restores, full resets or exploit requests on production. Verify final gateway configuration independently and report tests not exercised. Native image upgrades, framework routing/cache changes and stricter accepted files/access require regression coverage.

## Operations and rollback

Before applying production changes, confirm verified SSH host key, trusted CDN peer CIDRs, runtime secrets and database/media backups. Deploy the reviewed application/gateway together. No schema migration is planned; rollback the application/gateway image and restore only if an independently reviewed data change requires it. Existing content remains the source of truth. Do not publish private audit reproductions or operational secrets in public issues.

## Verified maintenance gates

- API unit: 15 suites / 103 tests passed. API integration: 30 suites / 189 tests passed on explicitly isolated disposable Postgres and object storage; production data was not used. A separate real PostgreSQL lock fixture verified stale password-login rejection and session revocation under queued credential rotation.
- Web build, typecheck, lint and corpus tests passed. The production Next migration fixture passed 36 HTTP/SSR, metadata, sitemap, outage and image checks.
- Gateway configuration validation and 13 response/header/cache cases passed.
- Real disposable Postgres backup/restore passed. Directory mode 700, file mode 600, failed-dump rejection and atomic publication were verified separately on Linux.
- Dependency and offline production configuration gates passed 18 tests; the opt-in Linux backup gate also passed. Remaining advisory exceptions are narrow, source-guarded and expire on 2026-11-01.
- Workflow YAML and Bash parsing, six offline deployment scenarios and 14 proxy-network cases passed. Production backups are excluded from source synchronization deletion; effective credentials are checked before service restart.

Fresh production image builds on this workstation were blocked by an upstream HTTP 403 for a base-image layer. Fresh builds in GitHub CI resolved that verification limit: commits e6cba95 and 4293e65 passed the production build, nonroot/cache-write/image-size and gateway-bootstrap gates.

Internal credential maintenance passed seven unit tests and a real disposable
PostgreSQL/MinIO fixture: existing object, IAM user, administrator password and
web service preservation; old credential rejection; wrong configuration,
missing backup and missing administrator refusal; confirmed legacy absent-key
Compose defaults; database and storage failure
recovery. Five offline streaming/integrity/cleanup cases also passed. This
fixture verifies the maintenance path using cached images, while the fresh
application runtime is verified separately in CI.

On 2026-10-03 the raw dependency feed added HIGH advisory
GHSA-vfj7-8cjw-p6xm for braces 3.0.3, without a released upstream fix. The
bounded-depth changes from upstream open PR #72 at commit
d0d575e55e74a4e0218e5248fafb79efc3e54ebb are backported locally. The gate
continues to report one raw HIGH separately from five unused-feature Moderate
exceptions. It requires the exact patch digest, lock identity, both consumer
resolutions, installed version and seven source hashes, plus real malicious
string and direct-AST regressions. Missing or altered proof fails deployment.
The local remediation review expires on 2026-11-01; replace it with an official
fixed release after verification when available. Fifteen audit/remediation
tests, ten contract tests and thirteen authentication tests passed freshly.

Production-only service/configuration/backup checks and post-deploy
public/private response verification remain rollout gates; fixture success
does not assert a live deployment. Off-server encrypted database/media backup
retention and independently verified alternate SSH access remain operational
requirements before stronger host restrictions.
