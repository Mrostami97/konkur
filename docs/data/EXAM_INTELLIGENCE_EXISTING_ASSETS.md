# Existing Exam Intelligence / Report-Card Assets

Status: existing owner-provided data asset; preferred integration baseline identified  
Inventory updated: 2026-09-20

## Important

A substantial exam-result/report-card dataset already exists from prior work and the owner has now provided the preferred, better-structured source set for future integration.

Claude and future implementers should **not redesign this domain from zero** before reviewing these assets.

The raw dataset is intentionally **not committed to this public repository**. Rights, privacy, provenance, source reuse restrictions, and publication policy must be reviewed before any raw-data publication or commercial reuse.

## Preferred owner-provided source set

### 1) `konkur_results_v41.sqlite`

This is the strongest structured historical core currently provided for years **1400–1404**.

Observed database objects include:

- result records
- subject scores
- rankings
- admissions
- institutions
- programs
- rank reference grid
- admission benchmarks
- ingestion runs
- QA flags
- source/provenance records
- analytics/model views

Observed row counts:

- `result_records`: **1,424**
- `subject_scores`: **8,514**
- `rankings`: **5,680**
- `admissions`: **967**
- `institutions`: **81**
- `programs`: **23**
- `rank_reference_grid`: **174**
- `admission_benchmarks`: **480**
- `admission_benchmarks_all_years`: **387**
- `qa_flags`: **9**
- `cross_source_duplicate_candidates`: **0**

Historical result distribution:

- 1400: **289**
- 1401: **90**
- 1402: **127**
- 1403: **184**
- 1404: **734**

Quality status observed in the DB:

- verified: **1,413**
- legacy_seed: **5**
- partial: **4**
- source_anomaly: **2**

Three rows are explicitly marked with `duplicate_of_result_id`.

Useful existing model/analytics views include:

- `analytics_flat_results`
- `analytics_ready_results`
- `model_rank_training`
- `model_similarity_pool`
- `model_admission_training`
- `admission_benchmarks_named`
- `admission_benchmarks_all_years_named`
- `rank_observations_1405`
- `rank_observation_summary_1405`

Observed model-ready counts:

- `analytics_ready_results`: **1,032**
- `model_similarity_pool`: **1,032**
- `model_rank_training`: **4,128**
- `model_admission_training`: **1,032**

### 2) `scorecard_post_resolution_1405_v43.csv`

This is a 1405 source-resolution map.

Observed:

- rows: **169**
- every row uses `public_telegram_link_target` as the resolution method in the provided file

It is useful for provenance/source reconciliation and should not be interpreted as 169 complete scorecards.

### 3) `scorecard_candidates_1405_v43.csv`

This is the currently provided verified candidate registry for 1405.

Observed:

- candidate rows: **148**
- unique candidate keys: **148**
- unique source posts: **148**
- all 148 source post URLs are present
- all 148 rows have `resolution_status = direct_post_resolved`
- all 148 rows currently have `scorecard_status = rank_linked_no_full_metrics`
- all 148 rows currently have `usable_for_full_score_model = 0`

Rank observations per candidate range from 1 to 7, with a median of 3.

### Important 1405 interpretation

The provided v43 files are better source-resolution and candidate-registry assets for 1405, but **they do not yet contain full percentages/GPA/admission metrics for those 148 candidates**.

Therefore:

- treat them as verified rank/provenance assets;
- do not train full-score/rank/admission models from those 148 rows until their missing metrics are completed;
- keep 1405 in the same conceptual core, but maintain a clear completeness state.

## Relationship to the older “Exam Intelligence Production v1” package

A prior package in the owner's Library documented a later/alternative production-oriented aggregate with:

- 1,580 Exam Results
- 8,496 subject-score rows
- 6,123 rank rows
- 962 admission rows
- 4,432 rank-model-ready rows
- 1,108 similarity-pool rows
- 3,144 admission-model-ready rows
- 1,932 admission benchmark rows

That package remains useful as a schema/integration reference, but **the owner-provided v41/v43 files above are the preferred concrete source set to inspect first**.

Do not merge counts from the two packages as if they were one dataset; they reflect different build/cleaning states.

## Source/provenance warning

The SQLite source table contains provenance from multiple sources, including public competitor pages/posts and an uploaded workbook source.

One recorded workbook source contains an explicit reuse note prohibiting non-free use.

Therefore future integration must distinguish:

- data the owner has rights to publish/use commercially,
- publicly observable facts that can be independently verified,
- competitor-derived/public-source observations that require rights/provenance review,
- data that may be retained only for internal validation or excluded entirely.

Do not assume that technical possession equals publication/commercial-use permission.

## Integration decision

Do not merge these assets blindly into the current Prisma schema.

After Product Completion is stable, create a dedicated integration task that:

1. compares `konkur_results_v41.sqlite` with current `ReportCard`, `RankEstimate`, admissions, University, Program, and analytics models;
2. maps identifiers and canonical taxonomies;
3. reconciles v43 1405 candidate/source records without duplicating v41 historical results;
4. preserves provenance and explicit completeness/quality states;
5. validates year/field/quota/coefficient/rank semantics;
6. reviews source rights and publication permissions before public/commercial use;
7. imports only through the project's approved ingestion/review boundary;
8. adds E2E tests for privacy, anonymization, sampling thresholds, duplicates, and estimator inputs;
9. keeps raw/private provenance out of public APIs;
10. never silently promote `rank_linked_no_full_metrics` rows into full-score model training.

## Strategic importance

This dataset is a major data asset for the future ecosystem.

After safe integration it can power:

- report-card explorer
- similar scorecards
- rank estimation
- admission benchmarks
- university/program pages
- evidence-backed SEO pages
- aggregated trend content
- personalized decision support
- Knowledge Graph evidence links

It should become part of the future Knowledge Graph/evidence layer, but it must not delay the current Product Completion priority.
