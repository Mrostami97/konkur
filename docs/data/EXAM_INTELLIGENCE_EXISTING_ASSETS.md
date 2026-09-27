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

**Ownership of that source (owner-confirmed 2026-09-23):** the `Konkur_Answer uploaded workbooks` source (`sources.id = 4`, **379 result rows**) comes from the owner's own `t.me/Konkur_answer` channel. The reuse note is the owner's own notice on the owner's own data and does **not** restrict the owner or kunkurcomputer. Treat these rows as owner-rights data. Keep the note verbatim for provenance, but do not apply it as a restriction on kunkurcomputer.

The remaining **1,045 rows** come from `CSHub` (website and Telegram, 734 rows) and `KonkurComputer` (311 rows). Those are competitor sites and remain competitor-derived observations under the rules below.

Therefore future integration must distinguish:

- data the owner has rights to publish/use commercially,
- publicly observable facts that can be independently verified,
- competitor-derived/public-source observations that require rights/provenance review,
- data that may be retained only for internal validation or excluded entirely.

Do not assume that technical possession equals publication/commercial-use permission.

## Integration plan

The execution plan for the ten steps below — migrations, the ingestion contract, the
internal evidence layer, and the acceptance tests each stage has to pass — is in
[`docs/roadmap/EXAM_DATA_INTEGRATION_PLAN.md`](../roadmap/EXAM_DATA_INTEGRATION_PLAN.md).

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


## Owner directive: maximize use of all available data

The owner explicitly wants the ecosystem to make use of **all available data** rather than discarding useful records.

This means future integration should preserve every useful field and source record in the internal data layer, subject to validation and provenance.

Use a three-tier policy instead of deleting data:

### Tier A — Public product data
Data that can be safely and lawfully exposed directly in user-facing features, subject to privacy and source validation.

Examples:
- factual exam year/rank/score fields where publication is permitted
- official university/program/capacity data
- owner-provided or owner-authorized records
- anonymized records with valid consent/rights

### Tier B — Derived/aggregated product data
Raw records remain internal, but validated derived outputs may be used publicly when lawful.

Examples:
- distributions
- medians/percentiles
- similar-scorecard retrieval
- rank/admission model features
- aggregated historical trends
- benchmark ranges
- anonymized cohort statistics

### Tier C — Internal-only evidence
Keep the record and provenance internally for research, QA, deduplication, model validation, reconciliation, and competitor/market intelligence, but do not expose the raw record publicly until rights/privacy constraints are resolved.

Examples:
- competitor-originated records whose republication rights are unclear
- source workbooks with restrictive reuse notes
- records with insufficient consent
- private/raw provenance fields

### Implementation rule

Do **not** throw away Tier B or Tier C records merely because they cannot be published verbatim.

Instead:
1. preserve them in a private evidence/warehouse layer;
2. retain source/provenance and rights metadata;
3. mark allowed uses explicitly;
4. expose only the permitted projection to public APIs;
5. allow approved derived analytics to use the broader internal dataset when legally and ethically permissible;
6. keep model training datasets versioned and reproducible.

The desired outcome is maximum information value with minimum unnecessary data loss, while keeping public output compliant and auditable.

## Result-bank collection (2026-09-25)

The owner approved using the report-card data for public aggregates and asked
for the public result banks to be collected in full. The collector and its
output live outside this repository, in
`D:\competitor-crawler-data\report_cards\` (`collect_report_cards.py`,
`validate.py`, `merge.py`; raw responses in `raw/`, tables in `out/`).

- CSHub (`cshub.ir/konkur-computer-results/`, one server-rendered table):
  2,131 rows, 1400–1404.
- KonkurComputer (`com_ajax` `kcreports` `loadReports` JSON endpoint, 16 pages
  of 100): 1,570 rows, 1400–1404.
- Neither bank publishes names or candidate numbers; the collector keeps
  none, and it drops link and modal columns.
- Merged with the owner's 378 workbook rows by year + GPA + six percentages:
  **2,241 unique computer-engineering master's cards**. 263 of the owner's 378
  workbook rows also appear in the banks. 1,440 are free-quota cards with an
  in-quota rank.
- Tiering: owner rows tier A; bank rows tier B (publish aggregates only).
- Known quirks: in the owner workbooks, `rank_national` holds the in-quota rank
  (checked against a published 1401 card). 547 CSHub rows carry no rank.
  About 400 merged groups differ by a one-unit rank typo or a missing code.
- 1405: neither bank has 1405 yet. On 2026-09-25 the 148 CSHub Telegram posts
  listed in `scorecard_candidates_1405_v43.csv` were fetched: 271 images, of
  which 220 are unique. The report cards were read from the images by hand into
  `out/tg1405_cards.jsonl`, giving 162 cards: 1277 (78 free-quota, 11 at 5%),
  1276 (43 free, 10 at 5%) and 1209 (14 free, 6 other). No names or candidate
  numbers were recorded. `validate_1405.py` checks every percentage against the
  1405 box sizes (language 25, maths 19 or 20, theory and signals 10,
  algorithms 19, architecture 19, OS/networks/DB 18), and all of them fit.
  With 1405 included, the merged table has 2,329 unique 1277 cards.

## Rank model for set 1277 (2026-09-27)

The public calculator at `/rank-calculator/master-computer-engineering` runs on
`apps/web/src/content/rank-model-1277.json`. That file is tier B: aggregates
only, with no single card, GPA or percentage row in it
(`apps/web/test/rank-calculator.mjs` checks this).

- Input: one row per (card, code) from the result banks, the owner's workbook
  rows and the 1405 image cards, grouped as in `merge.py`. Each code's rank is
  the median over sources. Cards with no known quota are left out.
- Model: for each year, quota (free, 5%) and code with at least 40 cards,
  ln(rank) is a decreasing curve of the code's weighted average plus
  gamma × (GPA − 17.5). The curve is a local-linear smooth made monotone. Gamma
  is chosen per year and quota and comes out between 0.5 and 1.0.
- Bands: the 50% and 80% bands are out-of-fold residual quantiles, taken per
  predicted-rank band.
- Accuracy, 5-fold by card:
  - Within the same year, the median error is 5.5% of the rank (7,533 checks).
  - Using the previous year's curve on the next year, the median error is 58%.
    This is why the page shows every year side by side rather than a 1406
    prediction.
- Year effect: at a fixed weighted average, code 2's rank in 1404 was worse
  than in every earlier year.
- Admissions: divide each admitted rank by its pair's five-year median. In
  every year the median of that ratio falls between 0.90 and 1.12. Admission
  ranks therefore move little from year to year taken together, although a
  single pair's yearly sample is small and noisier. That is why the tool
  compares the student's rank against pooled quantiles. Only pairs with at
  least 10 cards are included.
- Rebuild: copies of the scripts are in
  `content/import-packages/analysis/rank-model/`. They read the raw data under
  `D:\competitor-crawler-data\report_cards\`, which stays outside the
  repository. Run `cards_by_code.py`, then `export.py`, with the crawler venv
  Python from the `report_cards` folder.
- 1406 changes the exam to three packages (language 1, maths 2, specialised
  4). Rebuild the model once 1406 report cards exist.
