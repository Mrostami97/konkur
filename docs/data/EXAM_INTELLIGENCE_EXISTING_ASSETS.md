# Existing Exam Intelligence / Report-Card Assets

Status: existing data asset, not yet automatically assumed to be integrated into the public repo  
Inventory date: 2026-09-19

## Important

A substantial report-card / exam-result dataset already exists in the owner's ChatGPT Library from prior work.

Claude and future implementers should **not redesign this domain from zero** before reviewing this asset.

The raw dataset is intentionally **not committed to this public repository** by this document. Rights, privacy, provenance, and publication policy must be reviewed before any raw-data publication.

## Production package identified

Package/documentation name:

**Exam Intelligence Production v1**

Documented Core metrics:

- Exam Results: **1,580**
- Year 1400: **288**
- Year 1401: **90**
- Year 1402: **127**
- Year 1403: **183**
- Year 1404: **728**
- Year 1405: **164**
- anonymized candidates: **1,564**
- subject score rows: **8,496**
- rank rows: **6,123**
- admission rows: **962**
- rank-model-ready rows: **4,432**
- similarity-pool rows: **1,108**
- admission-model-ready rows: **3,144**
- admission benchmark rows: **1,932**
- 1405 results flagged for completion in that package: **164**
- documented integrity check: **ok**

## Existing views

The package includes or documents views for:

- `v_result_card`
- `v_rank_model_training`
- `v_similarity_pool`
- `v_admission_training`
- `v_admission_benchmark`
- `v_1405_completion_backlog`

Intended uses:

- rank estimation
- similar scorecards
- admission modeling
- university/program benchmark analysis
- result-card dashboard
- completion/review queue

## Existing implementation assets found in Library

At least the following files exist from the prior production package:

- `README_FA.md`
- `postgres_migration.sql`
- `prisma_exam_intelligence.prisma`
- `postgres_copy_seed.sql`
- `postgres_after_seed.sql`
- `postgres_views.sql`
- `API_QUERY_COOKBOOK.md`

Earlier versions/assets also include:

- `README_konkur_results_v2.md`
- `konkurcomputer_1402_batch_v1.csv`
- other historical source/seed artifacts

## Data policy documented by the package

The production package explicitly excludes non-core competitor/internal fields such as:

- mentoring level
- package tier
- coach labels
- course-status/marketing metadata
- personal identifiers

It keeps exam/result-oriented data such as:

- exam identity
- academic scores
- ranks
- admissions
- provenance

## 1405 note

The production package treats 1405 as part of the same core, not a separate database.

Rows that were rank-only at package-build time were intended to remain excluded from rank/admission training until missing percentages/GPA/admission data were completed.

## Integration decision

Do not merge this package blindly into the current Prisma schema.

When Product Completion is stable, create a dedicated integration task that:

1. compares the existing production-package schema with current `ReportCard`, `RankEstimate`, admissions, University, Program, and analytics models;
2. maps identifiers and canonical taxonomies;
3. preserves provenance and consent/publication policy;
4. avoids duplicating records already in canonical tables;
5. validates year/field/quota/rank semantics;
6. imports only through the project's approved ingestion/review boundary;
7. adds E2E tests for privacy, anonymization, sampling thresholds, and estimator inputs;
8. keeps raw/private provenance out of public APIs.

## Strategic importance

This dataset is a major first-party/owned ecosystem asset.

After safe integration, it can power:

- report-card explorer
- similar scorecards
- rank estimation
- admission benchmarks
- university/program pages
- evidence-backed SEO pages
- aggregated trend content
- personalized decision support

It should become part of the future Knowledge Graph/evidence layer, but it must not delay the current Product Completion priority.