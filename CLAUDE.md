# CLAUDE.md — current owner priorities

Read this file **before** touching code. Then read `AGENTS.md`, `TODO.md`, and the roadmap documents referenced below.

This file records the owner's current execution priority as of 2026-09-19. Existing phase checkmarks do **not** mean the product is considered complete from a real user/admin perspective.

## Current priority: Product Completion first

The owner does not consider kunkurcomputer launch-ready yet. The current priority is to turn the existing codebase into a polished, usable educational product before final release polish, Knowledge Graph work, or advanced programmatic SEO.

### Build now

1. Professional Persian RTL UI/UX across the whole mother site.
2. A real, usable admin panel for daily operations.
3. Student-facing question-bank UX.
4. Complete exam-taking, result, and review UX.
5. Course authoring/management and course-consumption UX.
6. Account/dashboard, entitlements, commerce, content, report-card, admissions, and analytics UX where backend support already exists.
7. Loading/error/empty states, broken actions, dead routes, unfinished forms, permission gaps, and any fake/mock production data.
8. Responsive behavior on mobile, tablet, and desktop.
9. Preserve all existing SEO, public slugs, provenance, review, and source rules.

Detailed scope:
- `docs/roadmap/PRODUCT_COMPLETION_AND_KNOWLEDGE_GRAPH.md`

## Do not implement yet

Until Product Completion is explicitly accepted by the owner, do **not** start:

- Neo4j or another graph database.
- Large taxonomy or Question-schema rewrites solely for Knowledge Graph needs.
- Runtime AI/LLM features.
- Programmatic SEO page explosion.
- Adaptive learning driven by a future graph.
- Large migrations whose only purpose is future graph capability.

Current work should remain compatible with those future phases, but should not build them prematurely.

## Long-term product direction: strong Knowledge Graph

The owner has chosen a strong Knowledge Graph as the long-term content architecture of کنکور کامپیوتر.

Target semantic chain:

`Exam → Subject → Topic → Subtopic → Question → Solution → Article/Guide → Resource → Course → Module → Lesson → Product`

Admissions/evidence chain:

`University → Program → Capacity → ReportCard / Admission evidence`

Future typed relations include:

- `PART_OF`
- `PREREQUISITE_OF`
- `RELATED_TO`
- `TESTS`
- `TEACHES`
- `EXPLAINS`
- `USES`
- `OFTEN_CONFUSED_WITH`
- `ALTERNATIVE_METHOD_TO`

Do not hard-code current UI/data flows in ways that make these relations impossible later.

## Content ecosystem direction

Public content is not an isolated blog. Eventually every useful page should connect to appropriate learning and commercial nodes:

`Guide/Article → Subject/Topic → relevant Lesson/Course → related Questions → practice Exam`

Example:

`Dijkstra guide → Shortest Path topic → Graph module → course lesson → Dijkstra questions → short practice exam`

Competitor research is used only to identify user needs, intent, content gaps, stale information, and opportunities. Never copy, scrape-and-rewrite, or closely imitate competitor prose.

Detailed content direction:
- `docs/content/KNOWLEDGE_GRAPH_CONTENT_STRATEGY.md`

## Existing exam-result/report-card data

A production-oriented exam intelligence dataset already exists outside the public repository and must be treated as an existing asset, not as something to redesign from zero.

Inventory and integration notes:
- `docs/data/EXAM_INTELLIGENCE_EXISTING_ASSETS.md`

Do not publish or commit raw scorecard/result data to this public repository unless rights, privacy, provenance, and publication policy have been explicitly reviewed.

## Brand and canonical domain

- Brand: **کنکور کامپیوتر**
- Latin name: **kunkurcomputer**
- Canonical domain: **https://kunkurcomputer.ir**
- Telegram channel: **@kunkurcomputer** («کنکور کامپیوتر»; formerly @konkurcom, post numbers carry over); logo: `apps/web/public/brand/konkurcom-logo.png`

Renamed by the owner on 2026-09-27 from کنکورصفریک / kunkur01 / kunkur01.ir. On 2026-09-28 the owner asked for
external ids to carry the new name too: new ones use `kunkurcomputer-` (e.g. `kunkurcomputer-lesson-*`), and the
migration `20260928090000_external_ids_kunkurcomputer` renamed the live `kunkur01-*` rows so re-imports still match
instead of creating duplicates. Do not create new `kunkur01-*` ids. A competitor operates at konkurcomputer.ir (k-**o**-nkur); ours is kunkurcomputer.ir
(k-**u**-nkur). In internal docs about competitors use the Latin `kunkurcomputer` for us so the two are never confused.

Do not rename the brand or canonical domain.

## Existing SEO must survive Product Completion

Regression-test and preserve:

- canonical metadata
- dynamic metadata
- sitemap index and child sitemaps
- robots
- JSON-LD / structured data
- RSS
- `llms.txt`
- public SSR behavior
- noindex rules for private/duplicate/search/filter states
- current public slugs unless an explicit redirect migration is approved

## Execution method

For each Product Completion workstream:

1. Audit existing implementation first.
2. Distinguish “route exists” from “feature is actually usable”.
3. Implement real backend/frontend/admin behavior; no cosmetic-only completion.
4. Do not add fake data to make incomplete screens appear finished.
5. Verify permissions and server-side enforcement.
6. Run relevant typecheck, lint, unit/integration/E2E tests and build.
7. Record remaining debt honestly.

The next major architecture phase after Product Completion and release stabilization is Knowledge Graph + content/course/question integration.

## Data utilization directive

The owner wants the project to make use of **all available exam/result/report-card data**.

Do not simplify by dropping records merely because some cannot be exposed publicly.

Implement future data integration with three usage levels:

- public/direct
- derived/aggregated
- internal-only evidence

Preserve raw provenance and rights metadata, and make public API projections explicit.

The goal is maximum legitimate use of the complete dataset for:
- report-card exploration
- similar-scorecard search
- rank estimation
- admission benchmarking
- analytics
- SEO/data pages
- planning/personalization
- future Knowledge Graph evidence

Never silently delete or ignore valuable records because of publication restrictions; retain them internally with the correct access/use classification.


## Student Need Intelligence / content roadmap

After Product Completion and release stabilization, the content system must evolve into a continuous Student Need Intelligence loop.

Primary roadmap:
- `docs/roadmap/STUDENT_NEED_INTELLIGENCE_CONTENT_ENGINE.md`

Core direction:

`student need signal → Need Cluster → priority score → Content Opportunity → Brief → external draft agent → Staging/Validate/Review/Publish → Course/Question/Tool links → performance feedback`

Sources eventually include:
- first-party site/search/support/product behavior;
- public competitor sites;
- public competitor Telegram channels/Q&A sources where collection is permitted;
- Search Console/Bing query data;
- official sources for fact validation.

Competitor content is for need/gap discovery only. Never copy or paragraph-rewrite competitor content.

The site runtime remains AI-free. Any research/writing agent runs externally and may only produce import/review artifacts; it never writes canonical Postgres data directly.


## Learning growth, bank access and AEO

Owner-approved product model:
- `docs/roadmap/LEARNING_GROWTH_ACCESS_AND_AEO.md`

Current Product Completion must already respect these business rules:

- public Subject/Topic/Guide pages show only a configurable sample of relevant questions;
- full bank access is entitlement-controlled server-side;
- Question Bank remains independently sellable;
- the Question Bank is sold separately: purchasing a Course does not include it, and a course sold with its bank is a BUNDLE (owner, 2026-10-06; supersedes the earlier course-includes-bank rule);
- weak/base-deficient and strong students follow different planning paths;
- self-reported level is not mastery;
- mastery is assessment-evidence based;
- study load grows gradually from real behavior;
- AEO is an additional discovery strategy, not a replacement for SEO.

Do not send locked question content to unauthorized clients and hide it only with CSS/JavaScript.
