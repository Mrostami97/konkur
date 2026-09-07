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
Phase 1 added **Content** (admin-authored articles only), **Learning**
(course/module/lesson/enrollment/progress), and **Commerce**
(product/price/order/payment/entitlement), plus a `Profile` sub-resource
inside Identity (docx §6.1 groups "profiles" with identity, not as its own
module). Phase 2 added **Ingestion** (ImportJob/ImportItem/SourceArtifact/
ContentVersion) and extended Content with the canonical `Question` and
`ReportCard` tables that bulk-ingested data publishes into. Phase 3 added
**Taxonomy** (Subject/Topic) and a **QuestionBank** sub-resource (public
browse/filter/detail, direct single-item authoring reusing the same
Stage→Review→Publish path as bulk ZIP import), plus a `/media/:checksum`
endpoint so image/chart blocks actually resolve to something. Phase 4 added
**Assessment** (Exam/ExamForm/ExamItem/Attempt/Answer/Score) -- exam builder
(STATIC hand-curated form, or DYNAMIC random draw from a subject), timed
attempts with autosave/resume, a concurrency-safe submit, and simplified
psychometrics. Phase 5 added **Planning** (Goal/Plan/Task/PlanRevision/
StudySession) and the Mastery slice of **Analytics** (MasteryState) --
doc §6.1 assigns Mastery to Analytics, not Planning, but Phase 5 needs it and
full Analytics (Benchmark/Prediction, for rank estimation) is Phase 6's job.
Phase 6 added that Benchmark/Prediction slice (`RankEstimate`,
`BacktestReport` -- a k-NN estimator over real ingested `ReportCard` rows,
never a bare number) and **Admissions** (University/Program/Capacity/
ChoiceList). Phase 7 added **CRM** (Lead/Case/Interaction/Campaign, a deep-link
attribution redirect, and an outbox-consumer that creates a Lead on
`UserOnboarded`), plus cross-cutting rate limiting (`@nestjs/throttler`) and a
basic PWA shell for the web app. Notification still does not exist — added
only when a later phase has real logic to put in it. Do not pre-create empty
module shells "for structure"; that is scope creep the docx explicitly warns
against (§11, "دامنه بیش‌ازحد").

## Phase table (docx §10.2) — what's done, what's next

| Phase | Name | Status |
|---|---|---|
| 0 | Contracts & infrastructure | **Done** |
| 1 | Usable mother site (portal, accounts, academy, commerce, admin) | **Done** |
| 2 | Data ingestion factory (Staging/Review/Publish for the 3 JSON contracts) | **Done** |
| 3 | Content & question bank | **Done** |
| 4 | Assessment engine | **Done** |
| 5 | Study OS | **Done** |
| 6 | Rank & admissions engine | **Done** |
| 7 | Growth & scale | **Done** |
| 8 | Competitive research & editorial policy | **Done** |
| 9 | Editorial content/commerce foundation | **Done — this repo state** |

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
- `apps/api/Dockerfile`, `apps/web/Dockerfile`, and `docker-compose.yml`
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
- Phase 9 extended `ContentVersion` to articles and resources. Published
  canonical content remains live while a new DRAFT/IN_REVIEW/REJECTED
  revision is edited; approval promotes it atomically and rollback creates a
  new Draft instead of rewriting history.
- Entitlement `startAt`, `endAt` and `revokedAt` are enforced on every Phase 9
  course/resource access check. There is no expiry mutation job because an
  expired grant is already inactive by time comparison.
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
- Product kinds now support one `COURSE`, one `RESOURCE`, or a non-nested
  `BUNDLE` of explicit course/resource grants. Study Pro, Mentor and
  Admissions-package products still need their own future grant targets.

Phase 2:

- `Question`/`ReportCard` are deliberately thin canonical tables (mostly JSON
  blobs + a few indexed fields) built only to prove the ingestion pipeline
  publishes real, queryable, versioned rows. Rich modeling — normalized
  Topic/Tag/Option entities, full-text search, a block renderer — is Phase 3's
  Content Engine; this shape does not need to survive that rewrite unchanged.
- Only one entry point exists: `POST /admin/import` takes a `.zip` with
  `payload.json` at its root (a single contract item or `{items:[...]}`) plus
  any referenced media files at the zip root. There's no plain-JSON (no-zip)
  shortcut, even for report-card.v1 payloads that never carry assets — doc
  §6.2's "Import Service تنها درگاه ورود است" (single import gateway)
  principle made one endpoint simpler to reason about than several.
- Normalization (doc §6.2 step 5) is pass-through only — no canonical-ID
  mapping tables (e.g. mapping raw subject names to a fixed `subject_code`
  enum). That's naturally Phase 3's Taxonomy system's job.
- No async outbox consumer for `ImportPublished` yet, same as
  `EntitlementActivated` in Phase 1 — it's written for provenance/future
  consumers but nothing reads it yet.
- Rollback creates a **new** version copying an old snapshot's payload rather
  than destroying history (`ContentVersion` rows are never deleted) — this is
  deliberate, not a shortcut: it's what makes rollback safe under concurrent
  access and keeps a full audit trail.
- Dedup is per-item (`external_id` + a stable-JSON checksum of the last
  published `ContentVersion`), not per-batch beyond the whole-file
  `idempotencyKey` on `ImportJob` (re-uploading byte-identical zips is a full
  no-op; re-uploading a batch where only some items changed still requires
  reviewing/approving all of them, including the unchanged ones — no
  auto-skip for individually-unchanged items in an otherwise-new job).
- Asset checksum/MIME are verified against the declared contract, but nothing
  re-derives MIME type from file content (e.g. via magic-byte sniffing) — a
  mislabeled `mime_type` with a matching checksum is not caught.
- Phase 9 added access-controlled inline serving for uploaded Resources.
  Ingestion still stores source artifacts in MinIO, while protected Resource
  responses are proxied only after ACCOUNT/Entitlement checks and never expose
  a storage key or signed object URL.
- `ObjectStorageService.onModuleInit()` bucket-creation is now wrapped in a
  catch (log a warning, don't crash boot) instead of letting an unreachable
  MinIO take down the *entire* app at startup -- since every e2e suite
  imports `AppModule` (and therefore this module) regardless of whether it
  touches media, an unreachable S3 endpoint was failing literally every e2e
  test in CI (which never had a MinIO service) with an identical, unhelpful
  `AggregateError`/`ECONNREFUSED`. This was a real latent bug present since
  Phase 2's introduction, only ever masked locally by a long-lived dev
  container that always had MinIO reachable. Tests that actually exercise
  media upload/download still correctly fail (with a real error) when S3 is
  unreachable; unrelated suites (auth, commerce, planning, CRM, etc.) no
  longer do. CI now starts a real MinIO via a plain `docker run` step (its
  `services:` block can't override the image's required `server /data`
  command) so the ingestion/media tests are exercised for real, not just
  tolerated.
  Phase 3 added `GET /media/:checksum` (a public, unauthenticated presigned
  redirect) so images/charts actually render; it does not check entitlement,
  so it isn't suitable for paid/protected media as-is — that's still open.

Phase 3:

- Taxonomy (`Subject`/`Topic`) is a standalone catalog, **not** a foreign key
  on `Question`/`Article` — those keep the plain `subjectCode`/`topicCodes`
  strings the contracts fix. A Topic-browsing UI or authoring-time validation
  can check codes against this catalog, but nothing enforces referential
  integrity between them yet.
- Search (`GET /questions?q=`) is a simple `ILIKE` over `subjectCode`/
  `examMajor`/`topicCodes` only — it does **not** search inside
  `stemBlocks`/`solutionBlocks` JSON content. Doc's own tech choice
  ("PostgreSQL FTS در ابتدا") implies a real `tsvector`+GIN-indexed search
  over block text; that's deferred, most naturally to whenever the question
  bank's corpus is large enough to need ranked full-text results.
- Direct question authoring (`POST /admin/questions`) only supports
  text/latex content blocks (`assets: []` always) — a question needing a new
  image/chart still has to go through the zip-upload path, since direct
  authoring has nowhere to attach a media file.
- `/media/:checksum` remains an unauthenticated redirect only for artifacts
  never referenced by a Resource. Phase 9 blocks current, detached and
  historical Resource artifacts in every access/review state; those bytes are
  served only through the access-controlled Resource endpoint.
- KaTeX renders via `dangerouslySetInnerHTML` (this is KaTeX's own documented
  server/client-safe rendering path, not a raw passthrough of un-sanitized
  user HTML) — only trusted internal roles (Author/Reviewer/Admin) or the
  ingestion pipeline ever produce the `latex` string being rendered.

Phase 4:

- DYNAMIC exams draw a fresh, randomly-selected `ExamForm` **per attempt**
  (not one shared adaptive pool) — simpler to reason about and still
  meaningfully "dynamic," but it means item-level psychometrics for a DYNAMIC
  exam mix questions across many different forms; that's fine for the
  difficulty/discrimination stats built here (grouped by `questionId`, not by
  form), but there's no per-form comparison.
- No question-level time limit or per-item navigation lock — a student can
  freely revisit any question in an attempt until the whole exam's deadline
  or submission. Doc's phase-4 DoD doesn't ask for per-item timing, only
  exam-level resume/timer.
- Auto-expiry is **lazy**: an attempt only flips `IN_PROGRESS` → `EXPIRED`
  (and gets scored) the next time something touches it (`GET /attempts/:id`
  or a submit call) — there's no background cron sweeping expired attempts
  the moment their deadline passes. Fine for correctness (the student's own
  client always re-checks via GET before the timer even reaches zero), not
  yet fine if you need an admin-side "list all expired-but-unscored attempts
  right now" view.
- Psychometrics' `discrimination` is a simplified separation index (average
  raw score of those who got the item right minus those who got it wrong),
  not a true point-biserial correlation coefficient — computed on demand (no
  materialized/stored view), same "start simple" posture as Phase 3's search.
- No question-shuffling or option-shuffling per attempt — two students
  taking the same STATIC exam see options in the same 1-2-3-4 order. Not
  asked for by the DoD, but a common anti-cheating measure a later phase
  might want.
- The exam-taking UI has no offline/reconnect handling beyond what autosave
  + resume already provide (every answer PUT is its own request; there's no
  local-storage fallback if the network drops mid-exam).

Phase 5:

- Mastery is computed from Assessment `Answer` correctness only (weighted by
  a 30-day recency half-life) -- it does **not** weight by item difficulty,
  even though doc §7 names difficulty as one of the four inputs. A real
  difficulty weight would need a global per-question difficulty lookup
  (essentially Phase 4's psychometrics, computed continuously) that isn't
  wired between Assessment and Planning yet. `StudySession` logs are tracked
  for their own sake (manual time logging, task-completion records) but do
  **not** feed the mastery formula's evidence count -- only graded answers
  do, to keep the correctness signal unambiguous.
- Cold start gap: a user with zero graded answers has no `MasteryState` rows
  at all, so `buildTasksForNewPlan` generates an **empty** task list (no
  fallback "explore the question bank" tasks). `replan()` still succeeds in
  this case; the plan just starts with nothing scheduled until the student
  takes an exam.
- One `Goal` per user (upsert in place) -- no history of past goals, no
  support for juggling multiple concurrent goals (e.g., ارشد this term, دکتری
  later).
- `rescheduleOverdueTasks` (the `FALLING_BEHIND` path) always moves overdue
  tasks to *today*, never redistributes them across the next few days --
  a student who falls behind by a week gets everything dumped on one day
  rather than smoothed out.
- Task generation always creates exactly `PLAN_HORIZON_DAYS` (7) days of
  tasks up front, round-robining the weak-topic list; it doesn't check
  Entitlement (doc §7 names "دسترسی" -- access -- as a Decision Table input)
  before assigning a task, so a task can reference course/topic content the
  student hasn't actually purchased access to.

Phase 6:

- The rank estimator matches candidates by **exact** degree+field+quota only
  (no fallback to a broader cohort when the exact match is too sparse) --
  `estimateFromPool` throws rather than silently widening the search, which
  is the honest choice but means a niche field/quota combination may never
  clear `MIN_COMPARABLES` (5) until enough report cards exist for it.
- Similarity is mean absolute percent-score difference over whatever
  subjects both sides share (requiring >= 2 common subjects) -- no per-
  subject weighting (e.g. weighting a student's weakest/most-decisive
  subject more heavily), and no leverage of `MasteryState` from Phase 5 even
  though both ultimately derive from the same kind of evidence.
- `getAcceptanceChance` requires `Program.code` to exactly match the
  `program_code` strings inside ingested `ReportCard.admissions` JSON --
  there's no reconciliation/fuzzy-matching between the admin-curated
  Program catalog and whatever codes an external JSON source actually used.
- Backtest is leave-one-out **within the same exact cohort**, capped at
  `BACKTEST_SAMPLE_LIMIT` (200) report cards for one run, and treats a
  report card with too few remaining comparables as simply excluded from
  the sample (not as a calibration failure) -- so `sampleSize` in the report
  can be smaller than the number of report cards in the database.
- No sensitivity weighting or acceptance-chance factor for `Capacity`
  (year-over-year capacity changes) yet -- `Capacity` rows are stored
  (admin-enterable) but neither the rank estimator nor the acceptance-chance
  calculation reads them; a real "how does a capacity increase change my
  odds" scenario isn't wired up.
- `ChoiceList` has no notion of committing/submitting a final ranked
  application (the real Konkur "انتخاب‌رشته" submission) -- it's a
  comparison/ordering tool only, not an integration with the actual national
  admissions system (out of scope for any phase in this spec).

Phase 7:

- Lead stage classification (`recomputeStage`) is a heuristic computed on
  demand (via a manual "بازمحاسبه مرحله" button, or whenever a lead is read),
  not an event-driven state machine that reacts to every underlying signal
  the instant it changes.
- The outbox consumer (`CrmService.processOutbox`) is a simple `@Interval(5000)`
  polling loop over `OutboxEvent`, not a real queue/worker (no BullMQ/Redis
  Streams, no backoff/retry beyond a plain try/catch-and-log, no ordering
  guarantee across events).
- Deep-link campaign attribution (`GET /r/:code`) only flows into the
  `UserOnboarded` outbox payload via the OTP-request path
  (`source`/`campaignCode` on `RequestOtpDto`) -- attribution isn't captured
  for any other entry point (e.g. direct signup without a referral code).
- Rate limiting (`@nestjs/throttler`) is IP-based only, with the default
  in-memory throttler storage -- it resets on process restart and isn't
  shared across multiple API instances (no Redis-backed distributed limiter,
  even though Redis is already provisioned). It's globally `skipIf`-disabled
  under `NODE_ENV=test` so the e2e suite's rapid-fire OTP requests aren't
  throttled; the throttle itself was verified manually with `curl` against a
  live dev server instead.
- The PWA (`manifest.json` + `sw.js`) is a basic installability/network-first
  shell -- no real offline-first strategy (no precaching, no background sync),
  no push notifications, and placeholder icons (solid-color "K360" text,
  generated locally) since no real brand assets were supplied (docx §12.1).

Infrastructure (post-Phase-7 cleanup):

- There is now exactly **one** `docker-compose.yml`, and it is the production
  stack (postgres/redis/minio/api/web/nginx/certs-init) -- the earlier
  dev-only compose file and the separate `docker-compose.prod.yml` were
  merged into it per explicit instruction, so there is no infra-only "just
  run Postgres/Redis/MinIO for local `pnpm dev`" mode anymore; local
  iteration goes through `docker compose up -d --build` (see
  `ops/runbook.md`).
- `nginx` terminates TLS with a **self-signed** certificate generated once by
  the one-shot `certs-init` service into the `nginx_certs` named volume (kept
  across redeploys; only regenerated if missing). This is not a trusted
  certificate -- browsers/`curl` will warn/refuse by default. Swapping in a
  real certificate (e.g. ACME/Let's Encrypt automation) is not done.
- `NEXT_PUBLIC_API_URL` is a Next.js **build-time** env var, baked into the
  client bundle at `next build`. The web `Dockerfile`'s build stage does not
  receive it as a build arg, so the `environment:` value set on the running
  `web` container in `docker-compose.yml` has no effect on the already-built
  bundle -- this predates Phase 7 and is not yet fixed; a real deploy needs a
  `next build --build-arg`/`ARG` wiring (or a runtime-config approach) before
  `WEB_DOMAIN`/`API_DOMAIN` overrides actually reach the browser.
- `package.json` now pins `"packageManager": "pnpm@9.12.0"`. Without it,
  Corepack fetched the latest pnpm inside the `node:20-bookworm-slim` build
  stage, which requires Node >= 22 (`node:sqlite`) and made `docker compose
  build api web` fail outright.
- Both Dockerfiles' runtime `CMD`s now invoke `node_modules/.bin/{prisma,next}`
  directly instead of `pnpm exec`/`pnpm start` -- the runtime stage never
  copies the root `package.json` (only `node_modules`/`contracts`/the app
  itself), so Corepack couldn't see the `packageManager` pin there either and
  would have re-triggered the same latest-pnpm-needs-Node-22 crash at
  container start, not just at build time.
- `apps/api/Dockerfile`'s base image needs `openssl` installed (added via
  `apt-get` in the shared `base` stage, not just `runtime`) -- without it,
  Prisma can't detect the actual libssl version and silently generates/
  expects the wrong query-engine binary (`openssl-1.1.x` guessed vs. the
  real `openssl-3.0.x` on `bookworm`), crashing on `PrismaClient` init with
  `PrismaClientInitializationError`. It has to be in `base`, not just
  `runtime`, because `prisma generate` (build stage) needs the same correct
  detection as the running container, or the engine it builds won't match.
- `apps/web/src/lib/api.ts`'s `apiGetPublic` (server-side/SSR fetch) now uses
  a server-only `INTERNAL_API_URL` env var (`http://api:3001` on the compose
  network) instead of the public `NEXT_PUBLIC_API_URL` -- SSR requests were
  failing with `ENOTFOUND`/certificate errors because the public HTTPS
  domain (`API_DOMAIN`) doesn't resolve from inside the `web` container, and
  even if it did, Node's `fetch` doesn't accept the self-signed cert.
  Browser-side `apiFetch`/`apiUpload` are unaffected and still use the public
  URL, since those really do run in the user's browser.
- `nginx`'s `proxy_pass` targets are resolved via a `resolver 127.0.0.11` +
  `set $upstream ...` pattern, not a bare `proxy_pass http://web:3000`.
  Nginx resolves a literal hostname once at config load and caches it
  forever; a bare form would keep routing to a recreated container's old,
  now-dead IP after every `docker compose up -d --build` redeploy until
  nginx itself was restarted. Verified by recreating `api`/`web` in place and
  confirming `nginx` (never restarted) still routed correctly.
- `NEXT_PUBLIC_API_URL` is still a Next.js **build-time** env var baked into
  the client bundle at `next build`; the web `Dockerfile`'s build stage does
  not receive it as a build arg, so a `WEB_DOMAIN`/`API_DOMAIN` override
  taking effect for real browser traffic requires rebuilding the image with
  that value threaded through as a build ARG (not yet done).

All of the above (nginx/certs-init/api/web Dockerfile fixes) were verified by
actually bringing up the full compose stack -- `docker compose build api web`,
`docker compose up -d`, confirming all 6 services reach a stable `Up` state,
then `curl -k https://localhost/` and `https://api.localhost/health` both
returning `200` through nginx, and re-confirming both stay `200` after
force-recreating `api`+`web` without touching `nginx` (the redeploy scenario).
The Dockerfiles had never been build-tested before this.
