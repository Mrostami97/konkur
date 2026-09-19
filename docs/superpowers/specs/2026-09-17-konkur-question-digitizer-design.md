# Konkur Question Digitizer — Design Specification

Date: 2026-09-17
Status: Approved design, implementation pending written-spec review
Branch: `feature/konkur-question-digitizer`

## 1. Goal

Build a high-accuracy, auditable pipeline for converting the user's archive of Iranian Computer Engineering / IT entrance-exam booklets and answer keys into validated `question.v1` records suitable for the existing ingestion workflow.

Primary objective: maximize correctness, not throughput. A missing question is preferable to a silently corrupted question.

The system must process the archive in deterministic order: newest year first, one complete booklet at a time. It must not jump between years or leave a booklet partially processed before moving on unless that booklet is explicitly blocked.

## 2. Non-negotiable rules

1. Process order: newest available year → one complete booklet → QA → next booklet.
2. Source fidelity: never paraphrase stems/options; preserve wording, numbers, symbols, formulas, diagrams, and option order.
3. Question identity comes from printed question numbering and booklet identity, not page boundaries.
4. A question may span pages; page transitions must not split the logical question.
5. Every question must retain permanent provenance back to the original PDF: source SHA-256, original path, page(s), booklet/control code when available, and crop/bounding-box references.
6. Exactly four options are required for importable questions.
7. The extraction engine must use at least two independent extraction paths for high-confidence automation. One extractor must not be allowed to copy the other's result.
8. Disagreement on any material token—especially numbers, exponents, operators, negation words, answer-option text, or formula structure—must route the item to review instead of guessing.
9. Answer extraction is a separate pipeline. Key mapping must include exam identity and booklet/control identity; a key is never matched by year alone.
10. Answer-source priority: official correction > official final key > official key > independently solved answer. Mirror copies without sufficient provenance do not automatically count as official.
11. Taxonomy assignment happens after faithful extraction. Taxonomy must never alter source text.
12. Only existing production taxonomy codes may be used; unavailable codes produce a taxonomy gap instead of an invented code.
13. Database dedupe is required before import. Each item must be classified NEW / MATCH / CONFLICT.
14. Only `VERIFIED` items may enter an import payload. `NEEDS_MANUAL_REVIEW` and `REJECTED` remain outside `payload.json`.
15. No automatic production publish. Import, review, and publish remain explicit stages through the existing admin ingestion API.

## 3. Existing system constraints

The repository already provides the target contract and ingestion path:

- `contracts/schemas/question.v1.schema.json`
- AJV validators and option-integrity checks
- admin ingestion controller under `/admin/import`
- review and publish stages
- PostgreSQL/Prisma question bank
- public taxonomy read endpoints and authenticated admin taxonomy mutation endpoints

The digitizer must adapt to these existing boundaries rather than invent a parallel persistence model.

## 4. Architecture

### 4.1 Components

#### A. Source Catalog

Responsibilities:
- discover all source files in an archive;
- preserve original path/name;
- compute SHA-256 and byte size;
- identify MIME/type and page count;
- group by degree, major, year, booklet code, and document role;
- detect exact binary duplicates and likely variants;
- record source-authority evidence.

Output: `source_catalog.json` and `source_catalog.csv`.

#### B. Booklet Job Planner

Responsibilities:
- choose the next job deterministically;
- order by year descending;
- within a year, process complete exam booklets in configured major order;
- attach matching key/correction candidates;
- prevent parallel jobs from processing the same booklet.

A booklet job is the atomic work unit.

#### C. Page Classifier

For every page, classify:
- native text layer usable;
- scan/image only;
- mixed text/image;
- heavy formula content;
- table content;
- diagram/graph/circuit content;
- answer-key layout;
- cover/instruction/non-question page.

The classifier determines which extraction adapters are eligible.

#### D. Question Boundary Detector

Responsibilities:
- identify printed question numbers;
- determine question start/end regions;
- merge cross-page questions;
- preserve associated diagrams and option blocks;
- output page/bounding-box provenance.

Question boundaries are based on logical numbering, not a fixed "one page = N questions" assumption.

#### E. Extractor A — Document Parser

Primary candidate: the best performer from the Golden Set benchmark among Marker, MinerU, Docling, or another locally reproducible parser.

Responsibilities:
- parse native/mixed pages;
- preserve reading order;
- extract text blocks, tables, formulas, and images;
- produce normalized candidate question objects.

No parser is selected permanently before benchmarking on the user's own archive.

#### F. Extractor B — Independent Vision Extractor

Responsibilities:
- read question crops/page images directly;
- return a strict candidate schema containing question number, stem blocks, four options, formulas, image references, and uncertainty markers;
- remain independent of Extractor A output.

This path is used as the second opinion for question-level transcription.

#### G. Comparison / Diff Engine

Compares A vs B at field and token level.

High-risk differences include:
- digit changes;
- exponent/subscript/superscript changes;
- `+/-`, inequality, set, logic, arrow, or asymptotic-notation changes;
- missing negation or quantifier words;
- option reordering;
- missing diagram references;
- formula structural differences.

The engine produces structured disagreement reasons rather than one aggregate similarity score.

#### H. Judge / Fallback Router

If A and B materially disagree:
- invoke a third independent visual pass on the original high-resolution crop;
- optionally invoke a specialist adapter for formula/table/diagram extraction;
- never auto-resolve an unresolved three-way conflict.

Unresolved items become `NEEDS_MANUAL_REVIEW`.

#### I. Answer-Key Pipeline

Responsibilities:
- identify answer-key/correction documents;
- verify exam/booklet/control identity;
- extract answer mappings independently from question extraction;
- preserve answer-source provenance;
- apply source-priority rules;
- perform an independent semantic/technical sanity solve when feasible;
- flag key-vs-solver conflicts.

A question cannot become VERIFIED merely because a key cell was parsed.

#### J. Taxonomy Mapper

Responsibilities:
- map faithful extracted question content onto existing subject/topic codes;
- use current production taxonomy only;
- emit `taxonomy_gaps.json` for missing mappings;
- never fabricate taxonomy identifiers.

#### K. Dedupe Engine

Checks production/current question data using stable source identifiers and normalized content fingerprints.

Classification:
- `NEW`: no matching source/content item;
- `MATCH`: same logical question already present;
- `CONFLICT`: same source identity but materially different stored content.

CONFLICT is never auto-overwritten.

#### L. QA State Machine

Allowed terminal statuses:
- `VERIFIED`
- `NEEDS_MANUAL_REVIEW`
- `REJECTED`

A VERIFIED question must satisfy all mandatory checks defined below.

#### M. Import Packager

For each completed booklet job, emit:
- `payload.json` — VERIFIED items only;
- `questions_verified.jsonl`;
- `questions_needs_manual_review.json`;
- `extraction_audit.jsonl`;
- `taxonomy_gaps.json`;
- `import_report.json`;
- crop/image assets;
- final batch ZIP.

The package must conform to the repository's existing ingestion contract.

## 5. Golden Set and Benchmark

Before bulk extraction, build a manually audited Golden Set from the user's real archive.

Target size: 300–500 questions covering:
- native Persian text;
- scanned Persian text;
- English language questions;
- mathematical notation;
- graph theory;
- algorithms/pseudocode;
- logic/digital circuits;
- tables;
- diagrams;
- questions spanning page boundaries;
- low-quality scans;
- answer-key tables and corrections.

The Golden Set must include exact source crops and authoritative transcriptions.

Benchmark metrics:
- question-boundary accuracy;
- exact question-number accuracy;
- stem character/token error rate;
- exact four-option recovery rate;
- option-order accuracy;
- numeric/symbol exactness;
- formula structural accuracy;
- diagram association accuracy;
- answer-key mapping accuracy;
- false-VERIFIED rate.

The most important metric is false-VERIFIED rate. The acceptance target is effectively zero on the Golden Set; uncertainty should be routed to review instead.

Parser selection is based on this benchmark, not public leaderboard claims.

## 6. Verification Gates

A question can become VERIFIED only when all applicable gates pass:

1. Source identity established.
2. Printed question number established.
3. Question boundary established.
4. Exactly four options recovered in correct order.
5. A/B extraction agreement passes strict material-token checks, or a third pass resolves the difference unambiguously.
6. All referenced diagrams/images are attached and traceable.
7. Formula/symbol checks pass where applicable.
8. Answer source is identified with adequate provenance, or independently solved according to policy.
9. Answer mapping and independent sanity check do not conflict.
10. Taxonomy uses existing valid production codes.
11. Production dedupe returns NEW or a safe MATCH disposition; unresolved CONFLICT is not importable.
12. `question.v1` schema and repository validators pass.

Any failed mandatory gate routes to review or rejection with explicit reasons.

## 7. Audit Model

`extraction_audit.jsonl` remains separate from `question.v1` because the production question contract is strict.

Each audit record should contain at minimum:
- external_id candidate;
- source SHA-256/path;
- page range;
- bounding boxes/crop assets;
- booklet/control identity;
- Extractor A result hash;
- Extractor B result hash;
- structured diff reasons;
- judge result if invoked;
- formula/diagram checks;
- answer-source identity and authority evidence;
- independent-solve result;
- taxonomy verification result;
- dedupe result;
- final QA status;
- machine-readable reason codes;
- timestamps and tool/model version identifiers when available.

## 8. Data flow

`Archive → Catalog → Booklet Job → Page Classification → Boundary Detection → A/B Extraction → Diff → Judge/Fallback → Answer Pipeline → Taxonomy → Dedupe → question.v1 Validation → QA Status → Batch Package → Admin Import → Review → Publish → Post-import Audit`

Production import/publish is outside the automatic digitizer core and remains guarded by existing authenticated admin workflows.

## 9. Error handling

- Never silently substitute unreadable text.
- Never normalize away a material source distinction.
- If question numbering is ambiguous, stop that question and continue the booklet with an audit gap.
- If a question spans pages and the continuation cannot be proven, route to review.
- If fewer/more than four options are detected, route to review.
- If two candidate keys disagree, preserve both and route to review unless source priority resolves the conflict with verified provenance.
- If production taxonomy/database is unavailable, extraction may continue, but items cannot pass the final VERIFIED/import gate.
- All failures must be resumable; a booklet job stores enough state to continue without reprocessing successful earlier stages.

## 10. Processing order for the current archive

The current archive is processed strictly from the newest available year downward.

Known newest year in the current catalog: 1403.

Initial sequence:
1. Computer Engineering 1403 — complete booklet and associated answer materials.
2. IT 1403 — complete booklet and associated answer materials.
3. Next lower year in the catalog, continuing booklet-by-booklet.

Duplicate/variant copies of the same booklet are source evidence or fallback material, not separate question sets.

## 11. Implementation boundaries

The first implementation milestone is local/offline and must not require production writes.

Milestone 1:
- catalog reuse/import;
- booklet-job planner;
- page rendering/classification abstraction;
- question-boundary representation;
- extractor adapter interfaces;
- strict candidate schema;
- A/B diff engine;
- QA routing;
- audit/package writer;
- Golden Set harness and metrics.

Milestone 2:
- concrete parser adapters and benchmark;
- choose primary parser based on Golden Set;
- add visual second-pass and specialist fallbacks.

Milestone 3:
- answer-key authority/mapping pipeline;
- taxonomy connector;
- database dedupe connector;
- exact `question.v1` conversion and repository-validator integration.

Milestone 4:
- authenticated staging import/review flow;
- post-import audit;
- operational dashboard/review queue if needed.

No migration of the existing question-bank architecture is required for Milestone 1.

## 12. Testing strategy

Tests must include:
- deterministic booklet ordering;
- duplicate booklet suppression;
- cross-page question boundary cases;
- four-option integrity;
- numeric/symbol diff detection;
- formula-difference detection;
- answer-key booklet mismatch rejection;
- taxonomy-unavailable gating;
- dedupe CONFLICT gating;
- schema-validator integration;
- package ZIP completeness;
- resume/idempotency behavior.

Golden Set regression tests become the quality gate for future extractor/model upgrades. An upgrade is rejected if it increases false-VERIFIED cases even when average OCR metrics improve.

## 13. Success criteria

The first production-ready version is successful when:
- complete booklet jobs can be run from newest to oldest without manual orchestration;
- every produced question is traceable to exact source evidence;
- low-confidence items are automatically isolated;
- no unresolved material A/B disagreement reaches VERIFIED;
- every VERIFIED item passes the repository contract/validators, taxonomy validation, and dedupe gate;
- a reviewer can inspect source crop, extracted question, answer evidence, and QA reasons without reopening the whole PDF;
- repeated runs are deterministic and resumable;
- the pipeline can scale from the current archive to future exam years without redesigning the storage/import contract.
