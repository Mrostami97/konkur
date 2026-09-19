# کنکورصفرویک — Knowledge Graph Content Strategy

Status: owner-approved strategic direction  
Date: 2026-09-19

## Core principle

کنکورصفرویک should not compete by publishing “more articles”. It should become a connected, source-backed knowledge system for computer-science entrance exams.

Every substantial content page should answer two questions:

1. What user need does this page solve?
2. Which nodes and relationships does it strengthen in the ecosystem?

## Content-to-product chain

Preferred path:

`Search / Google / ChatGPT / Perplexity → Guide/Article → Subject/Topic → Course/Lesson → Questions → Practice Exam → User account`

Content remains useful even if the user never buys. Commercial CTAs appear after the primary informational need is satisfied.

## Competitor research rule

Competitor pages may be analyzed for:

- search intent
- user questions
- topic coverage
- stale data
- missing explanations
- weak structure
- outdated years
- missing sources
- missing product integration

Do **not**:

- copy prose
- paraphrase paragraph-by-paragraph
- scrape and republish
- imitate unique editorial structure too closely
- present competitor-derived claims as first-party facts without independent source validation

The goal is an original, better answer.

## Content page anatomy

A high-value page should use the parts that fit its intent:

- quick answer
- definitions
- dated official status
- prerequisites
- topic hierarchy
- worked examples
- common mistakes
- comparison with adjacent concepts
- historical questions
- question counts/trends only when backed by coded data
- related lesson/course
- relevant resource
- practice questions
- short exam
- sources
- author/reviewer
- last reviewed date
- change log for time-sensitive claims

## Examples

### Dijkstra

Node target:

`Algorithms → Graph → Shortest Path → Dijkstra`

Useful relations:

- requires Graph basics
- uses Priority Queue
- related to SSSP
- alternative/comparison with Bellman-Ford
- tested by historical exam questions
- taught in a specific lesson/course

Page target:

- what Dijkstra solves
- assumptions/limitations
- why negative edges matter
- comparison with Bellman-Ford
- worked example
- common exam mistakes
- real historical questions
- course lesson
- targeted practice

### Minimum Spanning Tree

Node target:

`Algorithms → Graph → MST → Prim/Kruskal`

Connect:

- DSU
- priority queue
- cut/cycle properties
- historical questions
- course lesson
- practice exam

## Pillar → cluster → data-page model

Example:

`Masters Computer 1406`
→ Subjects
→ Algorithms
→ Graph
→ Shortest Path
→ Dijkstra
→ Historical questions
→ Practice

This is stronger than a flat blog taxonomy.

## Content/course integration

Future content-management UX should allow editors to select:

- primary Subject
- primary Topic
- secondary Topics
- relevant Course
- relevant Module/Lesson
- relevant Resource
- practice question set
- CTA/product if appropriate

Do not hard-code one course globally into article templates.

## Data-backed differentiation

The strongest pages should use first-party/owned structured datasets:

- coded historical questions
- report-card/result dataset
- official exam rules/coefficients
- official university/program/capacity records
- owned course/resource catalog

This enables unique pages and analyses competitors cannot replicate with generic prose alone.

## Programmatic SEO guardrails

Only create indexable generated pages when they have independent user value.

Good candidates:

- subject hub
- topic page with sufficient content/data
- exam-year page
- evidence-backed question-history page
- university/program evidence page
- sufficiently sampled report-card analysis page

Bad candidates:

- every arbitrary filter combination
- pages with one row and no explanation
- year/topic pages with no unique content
- near-duplicate keyword variants

## AI-search/AEO/GEO direction

Optimize for retrieval by making information explicit:

- one clear answer near the top
- canonical entity names
- clear dates and scope
- source links
- author/reviewer when appropriate
- concise tables
- definitions that stand alone
- meaningful internal links
- valid structured data
- strong page-level provenance

Do not invent “AI SEO” tricks that reduce human usefulness.

## Editorial quality bar

A kunkur01 page should be publishable only when:

- it solves a real user intent,
- its factual claims are sourced where needed,
- time-sensitive claims show freshness,
- it is original,
- it has no deceptive result promises,
- it links to meaningful next actions,
- and it strengthens the ecosystem graph rather than becoming an isolated article.