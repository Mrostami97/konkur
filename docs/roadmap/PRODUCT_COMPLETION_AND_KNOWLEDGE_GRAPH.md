# کنکور کامپیوتر — Product Completion → Content Ecosystem → Knowledge Graph

Status: owner-approved direction  
Date: 2026-09-19  
Brand: کنکور کامپیوتر / kunkurcomputer  
Domain: https://kunkurcomputer.ir

## 1. Product reality

The repository contains substantial backend, content, SEO, ingestion, assessment, planning, analytics, admissions, and commerce infrastructure. However, the owner does not consider the product complete from the real user/admin perspective.

Therefore the current sequence is:

1. **Product Completion & UI/UX**
2. **Release stabilization**
3. **Content ecosystem integration**
4. **Knowledge Graph foundation**
5. **Question Intelligence**
6. **Programmatic SEO / AI-search optimization**
7. **Adaptive learning**

Do not invert this order without explicit owner approval.

---

# Phase 18A — Product Completion & UI/UX

## 18A.1 Design system

Converge the whole web app on a coherent Persian RTL system:

- typography
- spacing
- containers
- buttons
- forms
- data tables
- cards
- badges/status
- tabs
- dialogs/drawers
- alerts/toasts
- search/filter
- pagination
- skeleton/loading
- empty/error states
- destructive confirmation
- responsive behavior
- keyboard/accessibility

Do not redesign for novelty; improve usability and coherence.

## 18A.2 Public mother-site experience

The public site must present one educational ecosystem, not a blog plus disconnected tools.

Primary public areas:

- guides / official information
- subjects / topics
- question bank
- exams
- courses
- study planning
- rank/admissions
- resources
- articles
- report-card evidence

Homepage and navigation should create clear entry paths, trust signals, and conversions without hiding answers behind sales CTAs.

## 18A.3 Admin panel

The admin panel must support real daily operations.

### Dashboard

At minimum surface useful operational status for:

- users
- published/draft content
- questions
- exams
- attempts
- courses
- products/orders/entitlements
- report cards
- admissions data
- imports/review backlog

### Questions

- list/search/filter/pagination
- detail
- create/edit through approved workflow
- subject/topic/year/degree/major
- stem/options/correct answer/solution/assets
- source/provenance
- review/publish state
- safe delete/retire behavior

### Exams

- create/edit
- static/dynamic setup
- question selection
- duration/question count
- preview
- publish/unpublish
- attempt/result visibility

### Courses

- create/edit
- module/lesson management
- ordering
- preview
- access mode
- product linkage
- publishing
- usable content editor for existing supported block types

### Editorial content

- articles/guides
- quick answer
- SEO title/description
- slug
- sources
- author/reviewer
- draft/review/published
- preview/version/revision

### Resources

- metadata
- category/taxonomy
- access mode
- source
- publication/review

### Taxonomy

- subjects
- topics
- prerequisites
- order
- slug
- metadata

Do not add future graph hierarchy yet unless required by current product behavior.

### Users / access

- users
- roles
- entitlement visibility
- attempts
- progress
- purchases/orders where supported

### Commerce

- products
- prices
- bundles
- grants
- orders
- entitlement status/expiry/revocation

### Report cards / admissions

- consent/visibility
- validation
- official-source links
- university/program/capacity management

## 18A.4 Question-bank UX

Build a serious solving experience around existing data:

Filters should support current canonical fields, including:

- degree
- major/field
- year
- subject
- topic

Question presentation must support:

- rich stem blocks
- math/formula
- image/assets
- options
- answer
- explanation
- source/provenance metadata

Do not invent question data.

## 18A.5 Exam UX

Complete the real exam flow:

- start/resume
- timer
- navigation
- selected answer state
- flagged state
- unanswered state
- autosave if supported
- submit confirmation
- result
- correct/wrong/unanswered
- review answers
- subject/topic breakdown where valid

Mobile is a first-class target.

## 18A.6 Student account/dashboard

Provide a useful dashboard:

- my courses
- continue learning
- recent activity
- my exams/results
- saved resources
- study plan
- active entitlements
- relevant admissions/rank tools

## 18A.7 Product-quality audit

Find and fix:

- dead buttons
- dead links
- unfinished forms
- placeholder copy
- fake/mock production content
- missing permission checks
- client-only security assumptions
- missing loading/error/empty states
- broken responsive layouts
- inconsistent RTL/number formatting

## 18A Gate

Product Completion is accepted only when the owner can use both student and admin workflows without direct DB/code intervention for normal operations.

---

# Phase 18B — Release stabilization

After 18A:

- typecheck
- lint
- unit/integration/E2E
- build
- migration up/down
- backup/restore checks
- canonical/sitemap/robots/structured data/RSS/404/redirect smoke
- mobile/desktop/RTL/accessibility review
- production deploy
- Search Console
- Bing Webmaster Tools
- IndexNow
- final release report

---

# Student Need Intelligence — continuous demand layer

Before/during Phase 19, implement the staged roadmap in:

- `docs/roadmap/STUDENT_NEED_INTELLIGENCE_CONTENT_ENGINE.md`

This layer discovers recurring student needs from first-party behavior, public competitor/Telegram signals, search-market data, and official changes; clusters and scores them; then produces evidence-backed Content Opportunities and Briefs.

Important: runtime remains AI-free. External research/writing agents may generate import-contract drafts only; they never publish directly.

---

# Phase 19 — Content Ecosystem Integration

Goal: make content a product surface, not an isolated publishing section.

## 19.1 Required connections

Public content should be able to connect to:

- Subject
- Topic
- Course
- Module
- Lesson
- Resource
- Question set
- Exam/practice entry point
- Product/offer when commercially relevant

Target path:

`Search/AI → useful page → topic understanding → relevant lesson/course → questions → practice exam`

No hard sell should interrupt the primary answer.

## 19.2 Example

A Dijkstra page should eventually connect to:

- Shortest Path topic
- Graph prerequisite
- Dijkstra subtopic
- relevant course/module/lesson
- real historical questions
- Bellman-Ford comparison
- practice set
- exam builder

---

# Phase 20 — Knowledge Graph Foundation

Use PostgreSQL/Prisma first. Do not add Neo4j unless real traversal/performance evidence later justifies it.

## 20.1 Topic hierarchy

Current Topic is primarily Subject-bound. Add a normalized hierarchy later:

`Subject → Topic → Subtopic → Concept`

Example:

`Algorithms → Graph → Shortest Path → Dijkstra`

## 20.2 Typed relations

Support typed semantic edges such as:

- PART_OF
- PREREQUISITE_OF
- RELATED_TO
- USES
- OFTEN_CONFUSED_WITH
- ALTERNATIVE_METHOD_TO

## 20.3 Normalize content-topic relationships

Current arrays such as `topicCodes` are useful for compatibility but are not sufficient as the long-term graph.

Future explicit relations should cover:

- Question ↔ Topic
- Article ↔ Topic
- Resource ↔ Topic
- Course/Lesson ↔ Topic
- Exam ↔ Subject/Topic

Relation records may later store:

- role/type
- confidence
- assignedBy
- reviewedBy
- reviewedAt

## 20.4 Exam entities

Normalize exam identity beyond year strings:

- ExamSeries
- ExamEdition
- official booklet/source
- initial/final answer key
- subject structure
- questions

## 20.5 Graph API

Expose stable graph-backed queries for:

- topic page composition
- prerequisites
- related content
- related questions
- course coverage
- exam history
- trend aggregation

---

# Phase 21 — Question Intelligence

After the graph foundation and product stability:

- PDF/OCR ingestion
- normalized question provenance
- subject/topic/subtopic assignment
- difficulty/review metadata
- initial/final key differences
- solution author/reviewer/version
- historical topic statistics
- question similarity/related practice
- exam-builder integration

Target loop:

`Question → Topic → Prerequisite → Content → Practice → Exam`

---

# Phase 22 — Programmatic SEO + AI Search

Generate indexable pages only when they have real independent value.

Potential surfaces:

- subject hubs
- topic/subtopic pages
- historical question pages
- exam-edition pages
- evidence-backed budget/trend pages
- university/program evidence pages

Never generate thin pages for every DB combination.

AI-search optimization should emphasize:

- answer-first content
- clear entities
- dated claims
- sources
- review metadata
- structured internal relationships
- machine-readable structured data where valid

---

# Phase 23 — Adaptive Learning

Use real assessment evidence, not study time alone.

Target explainable loop:

`Wrong answer → Topic → prerequisite → lesson/resource → targeted practice → retest`

Every recommendation must be traceable to evidence and rule/version metadata.

---

## Architectural guardrails

- Keep one mother site and one user identity.
- Preserve current provenance/review workflow.
- No external AI writes directly to canonical DB.
- No fake data.
- No competitor prose copying.
- Preserve SEO/canonical URLs through product work.
- Prefer additive migrations.
- Knowledge Graph is a data architecture, not a reason to delay current product usability.