# AGENTS.md — read this before touching any code

The source of truth for this project is
`KonkurCom-360-Architecture-FA-v2-NoAI.docx` (Persian, 12 sections). This file
is a distilled operating summary for whoever — human or coding agent —
implements the next phase. If anything here conflicts with the docx, the docx
wins; update this file to match.

## The one rule that overrides everything else

**Implement exactly one phase per session.** Never start phase N+1 in the same
session that finishes phase N. Before writing any code:

1. **Inspect** — read this file, the repo's current state, and the test
   results of the last phase.
2. **Plan** — write down scope, dependencies, migrations, API/contract
   changes, UI changes, tests, and risks for *this phase only*.
3. **Contract** — nail down OpenAPI/JSON Schema/event shapes and permission
   rules before writing business logic.
4. **Implement** — real backend, frontend, admin, and jobs. No stub pages, no
   fake endpoints that return hardcoded data pretending to be real.
5. **Seed** — minimal but real, repeatable fixtures (upsert-based, not
   throwaway one-off inserts).
6. **Verify** — lint, typecheck, unit, integration, contract, e2e, and
   security tests relevant to the phase all pass.
7. **Operate** — migration up/down (or documented rollback via backup),
   backup/restore, logs, and a runbook entry are proven to work, not just
   described.
8. **Handoff** — report changed files, the exact commands to run them, test
   results, and any remaining debt. Then **stop** and wait for explicit
   sign-off before even discussing the next phase.

No time estimate ever justifies skipping a step above. "Good enough for now"
stubs are not allowed — if something isn't built yet, it's simply not present,
not faked.

## Non-negotiable product decisions (docx §12)

- The system is a single mother site with one identity, one student profile,
  one entitlement model — never a Question/Exam-only tool.
- Content (articles, questions, report cards) is versioned and goes through an
  approval workflow; nothing is published by directly writing to production
  tables.
- Every rank estimate, mastery score, or recommendation is reproducible: it
  carries an `estimator_version` / `rule_set_version`, a reason, and a
  confidence level.
- **Runtime never calls any AI/LLM/OCR/RAG/embedding provider.** Article,
  report-card, and question data enters *only* as JSON/ZIP validated against
  the versioned schemas in `contracts/`, through
  Staging → Validate → Review → Publish. No external tool ever writes to
  Postgres directly.
- Mobile-first, five student-facing destinations max (امروز، یادگیری، آزمون،
  تحلیل، حساب من) — the dozen internal modules are an infrastructure concern,
  never surfaced as menu clutter.
- Every phase has an acceptance test, an E2E path, and a rollback story.

## Module boundary map (docx §5.2) — where new code belongs

| Domain | Owns | Boundary rule |
|---|---|---|
| Identity | User, Role, Session, Consent | Owns identity; every other module keeps only a `user_id` |
| Learning | Course, Lesson, Enrollment, Progress | Depends on Content by reference; owns course progress |
| Content | Article, Question, Topic, Tag, MediaAsset | Owns versioned content + review workflow |
| Assessment | Question(usage), Exam, Attempt, Answer | Only place scores/answers are authoritative |
| Planning | Goal, Plan, Task, StudySession | Consumes mastery, produces activity |
| Analytics | Mastery, Benchmark, Prediction | Versioned deterministic/statistical calc, with confidence + provenance |
| Ingestion | ImportJob, ImportItem, ReviewDecision | The *only* path from external JSON to canonical data |
| Commerce | Product, Order, Payment, Entitlement | The only source of truth for "is access active" |
| CRM | Lead, Case, Interaction, Campaign | Support data; never mutates score/access directly |
| Notification | Template, Delivery, Preference | Sends from a queue, respects consent |

Phase 0 implemented **Identity** (base) and an **Audit** cross-cutting concern.
Phase 1 added **Content** (admin-authored articles only, no bulk ingestion
yet), **Learning** (course/module/lesson/enrollment/progress), and
**Commerce** (product/price/order/payment/entitlement), plus a `Profile`
sub-resource inside Identity (docx §6.1 groups "profiles" with identity, not
as its own module). Every other module folder still does not exist —
Assessment, Planning, Analytics, Ingestion, CRM, Notification are added only
when a later phase has real logic to put in them. Do not pre-create empty
module shells "for structure"; that is scope creep the docx explicitly warns
against (§11, "دامنه بیش‌ازحد").

## Phase table (docx §10.2) — what's done, what's next

| Phase | Name | Status |
|---|---|---|
| 0 | Contracts & infrastructure | **Done** |
| 1 | Usable mother site (portal, accounts, academy, commerce, admin) | **Done — this repo state** |
| 2 | Data ingestion factory (Staging/Review/Publish for the 3 JSON contracts) | Not started |
| 3 | Content & question bank | Not started |
| 4 | Assessment engine | Not started |
| 5 | Study OS | Not started |
| 6 | Rank & admissions engine | Not started |
| 7 | Growth & scale | Not started |

## Known simplifications (carry these into later phases' risk lists)

Phase 0:

- OTP delivery uses a console-log provider, not a real SMS gateway (no vendor
  chosen yet — docx §12.1). Swappable behind the `OtpProvider` interface in
  `apps/api/src/modules/identity/otp-provider.ts`.
- `contracts/` ships the 3 JSON Schemas and a reusable validator, but there is
  no HTTP import endpoint, Staging table, or Review UI yet — that is Phase 2
  verbatim.
- The GitHub Actions deploy workflow is scaffolded but inert until
  `SSH_HOST`/`SSH_USER`/`SSH_KEY`/`DEPLOY_PATH` secrets exist — see
  `ops/runbook.md`.
- `apps/api/Dockerfile`, `apps/web/Dockerfile`, and `docker-compose.prod.yml`
  are written for that eventual deploy but have **not been build-tested**
  (pnpm workspace symlinks inside multi-stage Docker builds are a common
  failure point). Build and run them once against a real target before
  trusting the first real deploy.

Phase 1:

- No real payment gateway is chosen yet (docx §12.1). `PaymentProvider` is an
  interface; `ManualSandboxPaymentProvider` always succeeds immediately,
  standing in for a real gateway's redirect+callback cycle. Swappable in
  `apps/api/src/modules/commerce/payment-provider.ts`.
- Article/lesson content blocks are validated by a light, hand-rolled checker
  (`apps/api/src/common/content-blocks.ts`) for trusted internal roles
  (Author/Reviewer/Admin) authoring through the admin panel — not the strict
  `contracts/article.v1` JSON Schema, which is for Phase 2's external bulk
  ingestion into the same `articles` table.
- No article version-history table yet — `reviewStatus` (DRAFT → IN_REVIEW →
  PUBLISHED/REJECTED) is tracked, but edits to a DRAFT/REJECTED article
  overwrite in place rather than creating a new version row. A published
  article cannot be edited in place (by design, to avoid silently changing
  live content) but there's no republish-as-new-version flow yet either.
- Entitlement `endAt` (time-limited access) is stored but **not enforced** by
  any expiry job — no access-duration policy has been supplied yet (docx
  §12.1). Only explicit admin revocation (`revokedAt`) is enforced today.
- `EntitlementActivated` is written to the outbox for provenance, but Commerce
  calls `LearningService.enrollFromEntitlement()`/`revokeEnrollment()`
  directly and synchronously (within the same DB transaction) rather than via
  an async outbox consumer. No outbox consumer/poller exists yet for any
  event — that's still open for whichever phase first needs true async
  fan-out (e.g., Notification).
- E2E tests run against whatever `DATABASE_URL` is configured (not an isolated
  per-run test database) and now run **serially** (`maxWorkers: 1` in
  `jest.e2e.config.cjs`) because two files' `beforeAll` both call the shared
  `seed()` and raced on the same phone numbers when run in parallel. Do not
  run `pnpm test:e2e` against a database with real data.
- The admin course-editor UI (`/admin/courses`) is intentionally minimal (no
  drag-to-reorder, no rich content-block editor beyond a single text block per
  lesson) — a real block editor with images/LaTeX/tables is Phase 3's Content
  Engine.
- Product "kind" only supports `COURSE` — Study Pro/Mentor/Admissions-package
  products need modules (Planning/Analytics/Admissions) that don't exist yet.
