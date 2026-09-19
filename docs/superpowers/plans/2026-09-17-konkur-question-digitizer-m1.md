# Konkur Question Digitizer Milestone 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the offline, testable core of the Konkur Question Digitizer: deterministic booklet planning, strict extraction candidates, independent extractor interfaces, material-difference detection, conservative QA routing, auditable package generation, and a Golden Set benchmark harness.

**Architecture:** Add a focused `digitizer` module under the existing API TypeScript/Jest workspace so it can reuse repository contracts and tooling without touching production persistence. Milestone 1 accepts already-catalogued sources and extractor candidate outputs; concrete OCR/VLM engines remain adapters for Milestone 2. Every decision is deterministic and conservative: unresolved material differences or missing verification gates can never become `VERIFIED`.

**Tech Stack:** TypeScript 5.6, Node.js >=20, Jest/ts-jest, `adm-zip`, existing `@konkurcom/contracts` package.

**Spec:** `docs/superpowers/specs/2026-09-17-konkur-question-digitizer-design.md`

## Global Constraints

- Process newest year first and finish one booklet before moving to the next.
- Preserve exact source text; never silently paraphrase or repair material content.
- Printed question number and booklet identity define question identity, not page boundaries.
- Exactly four numbered options are required for an importable candidate.
- Two extraction paths remain independent; A/B material disagreement routes to review.
- Only `VERIFIED` items may enter `payload.json`.
- Milestone 1 performs no production database writes and no automatic publish.
- Source SHA-256/path, page range, booklet/control identity and crop/bounding-box references remain in audit metadata.

---

### Task 1: Core domain types and candidate integrity

**Files:**
- Create: `apps/api/src/modules/digitizer/types.ts`
- Create: `apps/api/src/modules/digitizer/candidate-validator.ts`
- Test: `apps/api/test/digitizer-candidate-validator.spec.ts`

**Interfaces:**
- Produces `SourceRef`, `BookletIdentity`, `QuestionBoundary`, `CandidateQuestion`, `ExtractorAdapter`, `QaStatus`, `DedupeDisposition`, and `validateCandidate(candidate)`.
- `validateCandidate` returns `{ valid: boolean; reasonCodes: DigitizerReasonCode[] }` and rejects non-positive question numbers, missing source provenance, duplicate/missing option numbers, and option counts other than four.

- [ ] **Step 1: Write failing tests** for a valid four-option candidate, missing option 4, duplicate option number, invalid question number, and absent source SHA/page provenance.
- [ ] **Step 2: Run** `pnpm --filter api test -- digitizer-candidate-validator.spec.ts` and confirm failures occur because the module does not exist.
- [ ] **Step 3: Implement minimal strict types and validator** with machine-readable reason codes such as `OPTION_COUNT_INVALID`, `OPTION_NUMBERS_INVALID`, `QUESTION_NUMBER_INVALID`, and `SOURCE_PROVENANCE_INCOMPLETE`.
- [ ] **Step 4: Re-run the focused test** and confirm PASS.
- [ ] **Step 5: Commit** `feat(digitizer): add strict candidate model`.

### Task 2: Deterministic booklet job planner

**Files:**
- Create: `apps/api/src/modules/digitizer/booklet-planner.ts`
- Test: `apps/api/test/digitizer-booklet-planner.spec.ts`

**Interfaces:**
- Consumes catalog entries carrying source SHA, role, degree, major, year, booklet/control code, and original path.
- Produces `BookletJob[]` through `planBookletJobs(entries, majorPriority?)`.
- Duplicate/variant booklet files with the same logical identity are grouped into one job; key/correction candidates attach to the same job and do not create question sets.

- [ ] **Step 1: Write failing tests** proving 1403 precedes 1401/1400, configured CE-before-IT ordering inside a year, duplicate booklet suppression, and answer-key attachment.
- [ ] **Step 2: Run** `pnpm --filter api test -- digitizer-booklet-planner.spec.ts` and confirm FAIL.
- [ ] **Step 3: Implement deterministic grouping and stable sorting**; use source SHA/path as tie-breakers so repeated runs have identical ordering.
- [ ] **Step 4: Re-run focused test** and confirm PASS.
- [ ] **Step 5: Commit** `feat(digitizer): add booklet job planner`.

### Task 3: Independent extractor contract and material diff engine

**Files:**
- Create: `apps/api/src/modules/digitizer/extractor.ts`
- Create: `apps/api/src/modules/digitizer/diff-engine.ts`
- Test: `apps/api/test/digitizer-diff-engine.spec.ts`

**Interfaces:**
- `ExtractorAdapter.extract(boundary, context): Promise<CandidateQuestion>` defines the Milestone-2 integration seam.
- `compareCandidates(a, b): CandidateDiff` returns `materialAgreement`, `reasonCodes`, and field-level differences.

- [ ] **Step 1: Write failing tests** for exact agreement, digit change (`n` vs `n²` / `10` vs `100`), operator change (`<` vs `<=`), negation change, option reordering, formula block change, and harmless whitespace normalization.
- [ ] **Step 2: Run** `pnpm --filter api test -- digitizer-diff-engine.spec.ts` and confirm FAIL.
- [ ] **Step 3: Implement comparison** that normalizes only non-material whitespace while preserving digits, operators, math tokens, block types, option positions, and negation-sensitive text. Emit reason codes including `STEM_MATERIAL_DIFF`, `OPTION_MATERIAL_DIFF`, `OPTION_ORDER_DIFF`, and `FORMULA_MATERIAL_DIFF`.
- [ ] **Step 4: Re-run focused test** and confirm PASS.
- [ ] **Step 5: Commit** `feat(digitizer): detect material extraction differences`.

### Task 4: Conservative QA router and audit record

**Files:**
- Create: `apps/api/src/modules/digitizer/qa-router.ts`
- Create: `apps/api/src/modules/digitizer/audit.ts`
- Test: `apps/api/test/digitizer-qa-router.spec.ts`

**Interfaces:**
- `routeQuestion(input): QaDecision` consumes candidate validation, A/B diff, diagram/formula state, answer verification state, taxonomy verification, and dedupe disposition.
- Terminal states are exactly `VERIFIED`, `NEEDS_MANUAL_REVIEW`, `REJECTED`.
- `buildAuditRecord(...)` preserves candidate hashes, diff reasons, source provenance, verification gates and final reason codes.

- [ ] **Step 1: Write failing tests** proving a clean item can be VERIFIED only when every mandatory gate is true; missing taxonomy, unavailable dedupe, answer conflict, A/B material conflict, and unverified cross-page boundary must all route to manual review; structurally impossible candidates route to REJECTED.
- [ ] **Step 2: Run** `pnpm --filter api test -- digitizer-qa-router.spec.ts` and confirm FAIL.
- [ ] **Step 3: Implement the state machine** with no score-based override of mandatory gates.
- [ ] **Step 4: Re-run focused test** and confirm PASS.
- [ ] **Step 5: Commit** `feat(digitizer): add conservative QA routing`.

### Task 5: Package writer with VERIFIED-only payload

**Files:**
- Create: `apps/api/src/modules/digitizer/package-writer.ts`
- Test: `apps/api/test/digitizer-package-writer.spec.ts`

**Interfaces:**
- `buildBookletPackage(input): Buffer` returns a ZIP containing root `payload.json`, `questions_verified.jsonl`, `questions_needs_manual_review.json`, `extraction_audit.jsonl`, `taxonomy_gaps.json`, `import_report.json`, plus supplied crop/media assets.
- `payload.json` contains only final `question.v1` objects whose QA state is VERIFIED.

- [ ] **Step 1: Write failing tests** creating one VERIFIED and one review item and asserting only the VERIFIED item appears in `payload.json`; assert every required audit file exists at ZIP root.
- [ ] **Step 2: Run** `pnpm --filter api test -- digitizer-package-writer.spec.ts` and confirm FAIL.
- [ ] **Step 3: Implement deterministic ZIP/package generation** using existing `adm-zip`; sort item and asset names for repeatability and serialize JSON consistently.
- [ ] **Step 4: Re-run focused test** and confirm PASS.
- [ ] **Step 5: Commit** `feat(digitizer): add auditable booklet package writer`.

### Task 6: Golden Set regression harness

**Files:**
- Create: `apps/api/src/modules/digitizer/golden-set.ts`
- Test: `apps/api/test/digitizer-golden-set.spec.ts`

**Interfaces:**
- `evaluateGoldenSet(cases): GoldenSetMetrics` reports case count, exact question-number rate, exact four-option rate, material-agreement rate, expected-vs-actual QA confusion counts, and `falseVerifiedCount`.
- The harness fails its quality gate when `falseVerifiedCount > 0`.

- [ ] **Step 1: Write failing tests** for a perfect sample and for a deliberately false-VERIFIED sample.
- [ ] **Step 2: Run** `pnpm --filter api test -- digitizer-golden-set.spec.ts` and confirm FAIL.
- [ ] **Step 3: Implement deterministic metrics and `passesQualityGate`** where false VERIFIED is a hard failure.
- [ ] **Step 4: Re-run focused test** and confirm PASS.
- [ ] **Step 5: Commit** `feat(digitizer): add golden set quality gate`.

### Task 7: Public module exports and Milestone-1 verification

**Files:**
- Create: `apps/api/src/modules/digitizer/index.ts`
- Modify only if needed: `apps/api/package.json` to add an offline digitizer test/utility script; no Nest module registration and no production route.

**Interfaces:**
- `index.ts` exports all Milestone-1 domain types/functions for the later CLI and concrete adapters.

- [ ] **Step 1: Export the Milestone-1 API** without registering any HTTP controller or production provider.
- [ ] **Step 2: Run focused suite:** `pnpm --filter api test -- digitizer-`.
- [ ] **Step 3: Run API typecheck:** `pnpm --filter api typecheck`.
- [ ] **Step 4: Run API lint:** `pnpm --filter api lint`.
- [ ] **Step 5: Run full API unit suite:** `pnpm --filter api test`.
- [ ] **Step 6: Compare branch to base and verify no Prisma migration, production route, or auto-publish change was introduced.**
- [ ] **Step 7: Commit** `feat(digitizer): complete offline milestone 1 core`.

## Milestone-1 acceptance check

Milestone 1 is accepted only if deterministic planner tests pass; candidate integrity enforces exactly four ordered options and source provenance; the diff engine detects high-risk text/math/option changes; QA cannot mark unresolved items VERIFIED; package output excludes non-VERIFIED items; the Golden Set harness hard-fails false-VERIFIED cases; and API typecheck/lint/tests pass without adding a production write path.