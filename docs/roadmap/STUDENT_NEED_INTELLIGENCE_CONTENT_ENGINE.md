# Student Need Intelligence & Content Engine Roadmap

Status: owner-approved strategic roadmap  
Date: 2026-09-20  
Product: کنکور کامپیوتر / kunkurcomputer  
Canonical domain: https://kunkurcomputer.ir

## 0. North Star

کنکور کامپیوتر should continuously learn what Computer Engineering / IT / Computer Science Master's and PhD candidates actually need, turn those needs into structured opportunities, create original and better content, connect that content to the Knowledge Graph, courses, lessons, questions, exams, resources, rank/admissions tools, and then measure whether the content solved the need.

This is **not** a bulk AI-blog system.

Target closed loop:

```
Student need signal
    ↓
Need observation
    ↓
Deduplicate / cluster
    ↓
Map to Knowledge Graph
    ↓
Demand + gap + freshness scoring
    ↓
Content opportunity
    ↓
Evidence-backed brief
    ↓
Original draft
    ↓
Validate → human review
    ↓
Publish
    ↓
Link to Course / Lesson / Question / Exam / Tool
    ↓
Measure search + product behavior
    ↓
Refresh / expand / merge / retire
```

The eventual competitive advantage is not “more articles”. It is a **living demand graph connected to a living knowledge graph**.

---

# 1. Sources of student need

The system should combine competitor intelligence with first-party signals.

Competitor signals are useful for discovering demand; official sources and first-party evidence remain the authority for factual/time-sensitive claims.

## 1.1 Priority A — first-party student signals

These become the most valuable signals once the product has traffic.

### On-site search

Capture:

- normalized query
- zero-result / result count
- clicked result
- reformulated query
- filters used
- destination reached
- anonymous/user session when allowed

High-value signal:

`search query with no satisfactory result → content gap`

### Question-bank behavior

Signals:

- repeated topic filters
- question searches
- bookmarked questions
- frequently wrong topics
- unanswered questions
- “need explanation” actions
- exam review navigation

Do not equate wrong answers with content demand automatically; use them as one evidence channel.

### Course behavior

Signals:

- lesson search
- lesson drop-off
- repeated rewind/revisit
- course support questions
- lesson-to-question transitions
- topic with many wrong answers after lesson completion

### Planning / study behavior

Signals:

- repeated requested study topics
- postponed tasks
- missing resource reasons
- “I do not know where to start” onboarding states
- weak prerequisites exposed by assessment

### Rank / admissions behavior

Signals:

- frequent university/program filters
- empty comparisons
- repeated rank scenarios
- report-card queries
- searches for quota / admission type / specific university

### CRM / support

Convert support interactions into anonymized need observations:

- category
- question summary
- subject/topic
- lifecycle stage
- urgency

Do not push raw personal messages into public content.

### Owned channels

Use the owner's:

- @konkurcom
- authorized archive sources
- future comments/Q&A

as high-trust demand inputs.

---

# 1.2 Priority B — competitor public sources

Initial monitored competitors:

- KonkurComputer
- CSHub
- KonkurStudy
- Baban / BabanAcademy
- Nasir
- future competitors added through Source Registry

## Public websites

Observe:

- new pages
- updated pages
- navigation additions
- page titles/headings
- FAQs/questions addressed
- newly emphasized products/tools
- stale-year pages
- missing sources
- content overlap/cannibalization
- public user-facing comments when lawfully accessible

Never use competitor prose as draft source text.

## Public Telegram channels

Known examples include:

- `@Konkurcomputer`
- `@konkurArshadComputer` (CSHub)

Signals to extract:

- questions students are invited to ask
- recurring advisory topics
- resource-selection questions
- start-time questions
- study-method questions
- exam-strategy questions
- result/admissions questions
- topic-specific confusion
- reactions/views as weak popularity signals

Views/reactions are not treated as proof of quality.

## Public Q&A groups

Example discovered in competitor public channel metadata:

- CSHub Q&A group `@konkurecomputer`

If a group is public and collection is permitted, derive need signals from question patterns.

Rules:

- never bypass a private group or access control;
- never impersonate users;
- never collect phone numbers or unnecessary personal identifiers;
- strip usernames/names from need data unless absolutely necessary for provenance;
- prefer derived need summaries and source pointers over retaining whole messages;
- rate-limit collection;
- maintain rights/collection policy per source.

If automatic collection is not permitted/reliable, use an authorized periodic Telegram export and ingest it as a research artifact.

---

# 1.3 Priority C — search-market signals

After deployment integrate:

- Google Search Console queries
- Bing Webmaster data
- internal organic landing pages
- query-to-page mismatch
- impressions with low CTR
- queries ranking 5–20
- new query clusters
- declining queries
- AI/referral traffic where measurable

Potential future external keyword sources may be used for discovery, but they do not outrank real first-party demand.

---

# 1.4 Priority D — official/time-sensitive sources

Official sources are **not demand sources only**; they are factual authorities.

Examples:

- سازمان سنجش
- وزارت علوم
- university official pages
- official curricula
- official exam booklets / answer-key notices

Use them to validate:

- dates
- coefficients
- subjects
- registration rules
- admission rules
- capacities
- corrections

A competitor page may reveal that students care about a change; the final claim should cite the authoritative source when available.

---

# 2. Source Registry

Create a managed Source Registry before building collectors.

Suggested conceptual fields:

```
NeedSource
- id
- name
- sourceType
- canonicalUrl
- platform
- ownerType: OWNED | COMPETITOR | OFFICIAL | MARKET
- accessMode: PUBLIC_WEB | PUBLIC_TELEGRAM | AUTHORIZED_EXPORT | API
- authorityClass
- demandSignalWeight
- factualAuthorityWeight
- collectionAllowed
- collectionMethod
- collectionCadence
- rightsNotes
- piiPolicy
- enabled
- lastCheckedAt
- lastSuccessfulCheckAt
```

Key principle:

**Demand authority and factual authority are different.**

Example:

- competitor Q&A group: high demand-signal value, low factual authority;
- Sanjesh announcement: low demand-signal value, very high factual authority.

---

# 3. Need Observation model

Every discovered student question/problem becomes a normalized observation.

Conceptual model:

```
NeedObservation
- id
- sourceId
- sourceExternalId / sourceUrl
- observedAt
- publishedAt
- normalizedText
- rawTextPointer (private research store only when permitted)
- textHash
- language
- degree
- field
- subject
- topic
- lifecycleStage
- intent
- urgency
- timeSensitive
- sourceEngagement
- confidence
- containsPII
- rightsClass
- createdAt
```

Possible lifecycle stages:

- exploring the field
- deciding whether to take the exam
- starting from zero
- selecting subjects/resources
- studying
- practicing/testing
- final review
- exam day
- results
- rank estimation
- university/admissions choice
- PhD written exam
- PhD interview/research

Possible intents:

- DEFINITION
- HOW_TO
- STARTING_POINT
- RESOURCE_SELECTION
- STUDY_PLAN
- COMPARISON
- TROUBLESHOOTING
- EXAM_STRATEGY
- QUESTION_SOLUTION
- OFFICIAL_INFO
- TIME_SENSITIVE_UPDATE
- RANK
- ADMISSION
- UNIVERSITY
- COURSE_EVALUATION
- PURCHASE_INVESTIGATION

Store derived intent/taxonomy, not competitor marketing labels.

---

# 4. Deduplication and Need Clustering

Raw questions will repeat with different wording.

Examples:

- از کجا برای ارشد شروع کنم؟
- برای کنکور کامپیوتر از چی شروع کنم؟
- تغییر رشته‌ای هستم، اولین درس چی باشه؟

These should become one parent Need Cluster with useful subsegments.

Conceptual models:

```
NeedCluster
- id
- canonicalNeed
- slug
- lifecycleStage
- primaryIntent
- degreeTargets
- fieldTargets
- subjectCodes
- topicCodes
- parentClusterId
- firstSeenAt
- lastSeenAt
- status
```

```
NeedClusterObservation
- needClusterId
- observationId
- matchConfidence
```

Useful segment dimensions:

- CE / IT / CS
- Master's / PhD
- beginner / intermediate / advanced
- career changer
- working candidate
- low weekly hours
- late starter
- specific subject/topic
- specific year
- quota/admissions scenario

Do not make separate SEO pages for every segment automatically.

---

# 5. Need taxonomy and Knowledge Graph mapping

Every Need Cluster should map to graph nodes where possible.

Examples:

```
Need: «دایکسترا با وزن منفی چرا کار نمی‌کند؟»

→ Subject: Algorithms
→ Topic: Graph
→ Subtopic: Shortest Path
→ Concept: Dijkstra
→ Related: Bellman-Ford
→ Course: Data Structures & Algorithms
→ Lesson: SSSP
→ Questions: tagged Dijkstra/SSSP
```

```
Need: «برای ارشد ۱۴۰۶ از کجا شروع کنم؟»

→ ExamEdition: Masters CE/IT/CS 1406
→ Guide: Start from zero
→ Subjects: dependent on exam field
→ Planning tool
→ Resource selection
```

A need that cannot map to the graph is either:

1. a graph gap;
2. a non-academic decision/support need;
3. noise.

Track all three explicitly.

---

# 6. Need Priority Score

Create a reproducible score from 0–100.

Do not let an LLM alone decide editorial priority.

Suggested normalized dimensions:

- **Frequency (F)** — how often the need appears.
- **Velocity (V)** — whether mentions are rising recently.
- **Freshness/Urgency (U)** — current-year or deadline relevance.
- **First-party demand (P)** — strength in own users/search/support.
- **Search opportunity (S)** — impressions/queries and SERP opportunity.
- **Competitor gap (G)** — competitor answer is missing, stale, fragmented, weak, or sales-first.
- **Knowledge gap (K)** — kunkurcomputer has no strong node/page for it.
- **Course fit (C)** — meaningful link to an owned course/lesson.
- **Question/data fit (Q)** — first-party question/result data can make the answer unique.
- **Business relevance (B)** — useful downstream action/product fit.
- **Evidence readiness (E)** — authoritative sources/data exist.
- **Confidence (R)** — reliability of the need classification.

Example starting formula:

```
NeedPriority =
  0.16F +
  0.10V +
  0.10U +
  0.14P +
  0.10S +
  0.10G +
  0.08K +
  0.06C +
  0.05Q +
  0.04B +
  0.04E +
  0.03R
```

Weights are product configuration and must be versioned.

Suggested bands:

- 80–100: P0 / create or refresh now
- 65–79: P1 / current editorial sprint
- 45–64: P2 / backlog
- below 45: monitor

Time-sensitive official changes can override the normal score.

---

# 7. Competitor Gap analysis

For each high-value Need Cluster, build a structured competitor matrix.

```
CompetitorCoverage
- needClusterId
- competitor
- page/post URL
- checkedAt
- coverageDepth
- freshnessYear
- answerDirectness
- sourceTransparency
- structureQuality
- contentFormat
- productConnection
- observedWeaknesses
```

Evaluate, do not copy.

Useful gap types:

- NO_PAGE
- STALE_YEAR
- FRAGMENTED_ACROSS_PAGES
- ANSWER_TOO_LATE
- SALES_BEFORE_ANSWER
- NO_PRIMARY_SOURCE
- NO_EXAMPLE
- NO_DATA
- NO_QUESTION_PRACTICE
- NO_COURSE_PATH
- NO_PREREQUISITE_PATH
- NO_FRESHNESS_DATE
- NO_UNCERTAINTY_DISCLOSURE
- WEAK_INTERNAL_LINKING
- DUPLICATE/CANNIBALIZED_CONTENT

This becomes the evidence for “how can kunkurcomputer be better?”

---

# 8. Content Opportunity model

Not every need becomes a new article.

Possible actions:

- CREATE_PAGE
- EXPAND_EXISTING_PAGE
- REFRESH_YEAR
- MERGE_PAGES
- ADD_SECTION
- ADD_FAQ_SECTION
- ADD_DATA_WIDGET
- ADD_TOOL
- ADD_QUESTION_SET
- ADD_COURSE_LINK
- ADD_LESSON
- ADD_RESOURCE
- CREATE_TELEGRAM_POST
- CREATE_VIDEO_BRIEF
- NO_ACTION

Conceptual record:

```
ContentOpportunity
- id
- needClusterId
- action
- targetContentId?
- recommendedPageType
- priorityScore
- rationale
- uniqueValuePlan
- requiredEvidence
- graphNodes
- courseLinks
- questionLinks
- toolLinks
- targetYear
- status
```

---

# 9. Decide the right content format

Use intent, not keyword volume alone.

## Pillar/guide

For broad journeys:

- کنکور ارشد کامپیوتر ۱۴۰۶
- شروع از صفر
- منابع
- برنامه‌ریزی
- انتخاب رشته

## Subject page

For durable course/subject demand.

## Topic / concept page

For academic concepts and question practice.

## Data page

When first-party structured data creates unique value:

- historical topic frequency
- report-card benchmarks
- admission evidence
- exam history

## Official update page

For time-sensitive rules and changes.

## Comparison/decision guide

For:

- CE vs IT vs CS
- Dijkstra vs Bellman-Ford
- resource comparisons
- university/program comparisons

## Tool

If repeated need is better solved interactively than with 4,000 words:

- rank scenario
- study-plan generator
- question filter
- university comparison

## Course support content

Some needs belong inside a course/lesson, not in SEO.

---

# 10. Content Brief contract

Every new/major-refreshed page should have a machine-readable brief before drafting.

Required fields:

```
ContentBrief
- briefId
- needClusterIds
- pageType
- canonicalSlug
- primaryIntent
- targetAudience
- degreeTargets
- fieldTargets
- validForYear
- quickAnswerGoal
- primaryQuestion
- secondaryQuestions[]
- knowledgeGraphNodes[]
- requiredOfficialSources[]
- firstPartyDataSources[]
- competitorPagesReviewed[]
- competitorGaps[]
- uniqueValue
- outline[]
- examplesNeeded[]
- tablesNeeded[]
- questionPracticeNeeded
- courseConnections[]
- lessonConnections[]
- resourceConnections[]
- toolConnections[]
- internalLinksIn[]
- internalLinksOut[]
- CTA
- SEOPrimaryTopic
- SEOSecondaryTopics[]
- titleOptions[]
- metaDescriptionGoal
- structuredDataTypes[]
- freshnessPolicy
- riskFlags[]
- reviewerRequirements[]
```

No draft generation without a valid brief for P0/P1 content.

---

# 11. Content Generation architecture

The website runtime remains AI-free.

Use an **external/offline editorial agent**.

```
Need Intelligence DB / research artifacts
    ↓
Content Brief
    ↓
External research/writing agent
    ↓
article.v2 / approved contract JSON
    ↓
Import Service
    ↓
Staging
    ↓
Validate
    ↓
Review
    ↓
Publish
```

The external agent must never write canonical Postgres tables directly.

For GitHub-based editorial work, an alternative output may be:

`generated draft → PR → review → import artifact`

---

# 12. Draft generation rules

Every generated page must be **original**.

Competitor content can influence:

- what question to answer;
- what is missing;
- what is stale;
- what format users appear to want.

Competitor content must not be used as a paragraph template.

## Factual hierarchy

1. official/primary source
2. first-party kunkurcomputer dataset
3. trusted academic reference
4. other secondary source
5. competitor page only as demand/gap evidence

Time-sensitive claims require the highest available authority.

## Answer-first

The user should receive a useful direct answer before:

- long history,
- branding,
- purchase CTA.

## Course integration

Where genuinely relevant:

```
Content
→ “ادامه یادگیری”
→ exact course
→ exact module
→ exact lesson
```

Not merely:

`مقاله → صفحه عمومی دوره‌ها`

## Question integration

Where relevant:

```
Concept page
→ related historical questions
→ question filters
→ short practice set
→ exam builder
```

## Data integration

Prefer unique first-party data over generic prose.

Examples:

- historical exam-question tagging
- report-card benchmarks
- university/program data
- course curriculum coverage

---

# 13. SEO / AEO / GEO quality gate

The content engine should optimize usefulness first.

Required checks for indexable pages:

- canonical intent is unique
- no cannibalization with an existing page
- direct answer near top
- one clear H1
- meaningful headings
- descriptive title
- useful meta description
- clean canonical
- valid index/noindex decision
- appropriate breadcrumb
- internal links to parent/children
- relevant graph relationships
- source/freshness display
- structured data only when semantically valid
- accessible tables/media
- no keyword stuffing
- no thin programmatic page

## Content originality gate

A page must add at least one substantive advantage:

- better explanation
- newer official information
- original example
- first-party data
- question practice
- interactive tool
- course/lesson path
- clearer comparison
- prerequisite graph
- evidence/uncertainty disclosure

“Longer than competitor” is not sufficient.

---

# 14. Editorial QA pipeline

Recommended states:

```
DISCOVERED
→ CLUSTERED
→ PRIORITIZED
→ BRIEF_READY
→ DRAFTED
→ FACT_CHECK
→ PEDAGOGY_REVIEW
→ SEO_REVIEW
→ OWNER_REVIEW
→ SCHEDULED
→ PUBLISHED
→ MEASURED
→ REFRESH_DUE
→ MERGED / RETIRED
```

P0 time-sensitive official pages may use a faster lane, but still require source verification.

## Claim map

For important pages, keep:

```
claim
→ source
→ locator
→ checkedAt
→ confidence
```

This is especially important for:

- coefficients
- dates
- capacities
- rules
- historical counts
- ranks/admissions
- competitor comparisons

---

# 15. Freshness engine

Every content type receives a refresh policy.

Examples:

### Official exam information
- event driven + daily during announcement windows

### Resources / study strategy
- quarterly review
- immediate review after exam-structure change

### Subject/topic educational content
- annual light review
- refresh when question taxonomy shows new patterns

### Rank/admissions content
- refresh after each result/admissions cycle

### Competitor comparisons
- monthly/quarterly private research refresh
- never publish stale competitive claims as current facts

Store:

- lastReviewedAt
- validForYear
- reviewDueAt
- triggerReason

---

# 16. Monitoring cadence

## Continuous / event-driven

- official announcements
- major product errors
- new own-site zero-result spikes

## Daily

- new public posts from high-priority competitor channels
- own site-search/no-result signals
- support/CRM need summaries
- new official exam notices during active season

## Weekly

- competitor site page discovery/diff
- Need Cluster ranking refresh
- top new questions
- Search Console query review
- top under-served graph nodes
- content refresh queue

## Monthly

- full content inventory
- cannibalization audit
- stale-year audit
- competitor coverage matrix
- course-content gap review
- SEO performance review
- AI/referral visibility review when data exists

## Seasonal

Align special editorial cycles with:

- registration
- study-start season
- mid-preparation
- final review
- exam date
- results
- choice/admissions
- PhD interview season

---

# 17. Content ↔ Course Coverage Graph

Create a coverage report for every owned course.

Example:

```
Course: Data Structures & Algorithms

Subject
 ├─ Graph
 │   ├─ MST
 │   │   ├─ article coverage
 │   │   ├─ lesson coverage
 │   │   ├─ question count
 │   │   └─ demand score
 │   └─ Shortest Path
 │       ├─ Dijkstra
 │       ├─ Bellman-Ford
 │       └─ ...
```

This enables two-way discovery:

### Demand → course

High-demand topic with an existing lesson:
- create/update content;
- link to exact lesson.

### Demand → curriculum gap

High-demand topic with no suitable lesson:
- create a `CourseContentGap`;
- consider adding lesson/resource, not just an SEO article.

### Course → content gap

Important course lesson with no discoverable public content:
- create an educational preview/guide if useful.

---

# 18. Need ↔ Question Intelligence

After Question Intelligence is ready, enrich demand with real exam evidence.

For each topic/need:

- number of historical questions
- years asked
- latest occurrence
- difficulty distribution
- common wrong options where user data allows
- prerequisite relationships
- related concepts
- course lesson coverage

Do not turn historical frequency into a deterministic “will be asked” prediction.

---

# 19. Need ↔ Exam Intelligence / report-card data

Use the existing result datasets as a separate evidence axis.

Potential needs:

- چه رتبه‌ای برای دانشگاه X؟
- با این درصدها چه بازه‌ای؟
- کارنامه مشابه من؟
- تفاوت گرایش‌ها؟
- سهمیه چه اثری در داده مشاهده‌شده دارد؟

Public content should expose only permitted/anonymized/aggregated outputs.

The broader internal dataset may support research/modeling according to its use classification.

---

# 20. Feedback loop after publication

Publishing is not the end.

For each page measure:

## Search

- impressions
- clicks
- CTR
- average position
- query coverage
- new queries
- query-page mismatch

## On-page

- useful reading depth
- exits
- internal next-action clicks
- search after page view
- “was this useful?” feedback when implemented

## Product progression

- page → subject/topic
- page → lesson/course
- page → question bank
- page → practice exam
- page → resource save
- page → rank/admission tool
- page → purchase

A high-traffic page that does not solve the next action is a product/content problem.

---

# 21. Content Success Score

Track more than SEO traffic.

Example dimensions:

- Need coverage
- Search performance
- Freshness
- Evidence quality
- Engagement
- Next-action success
- Course/question integration
- Conversion when appropriate
- user helpfulness feedback

Keep informational pages from being judged only by sales.

---

# 22. Admin/editorial dashboard

Future admin section: **Need Intelligence**

Views:

## Inbox
New unclustered observations.

## Need clusters
- canonical need
- trend
- source mix
- audience
- score
- related graph nodes

## Opportunities
- create
- refresh
- merge
- tool
- course gap

## Competitor gaps
Per need, not a copied content library.

## Content briefs
Brief status and owner.

## Coverage
- Needs without content
- Topics without content
- Content without course/question connection
- Courses without public discovery content

## Refresh queue
Content due for review.

## Performance
Need → content → next action.

---

# 23. Data retention / copyright / privacy

## Competitor content

Store only what is necessary for research and traceability.

Prefer:

- URL/post id
- timestamp
- derived need
- classification
- short evidence snippet when legally appropriate
- hash

Avoid maintaining a mirror of competitor content.

## Telegram

Do not collect private-account data unnecessarily.

Strip:

- phone numbers
- usernames
- personal names

from the need layer unless required for source traceability, and keep any necessary raw pointer in private research storage.

## Public publishing

Never publish a competitor student's personal question or identity as kunkurcomputer content without a lawful basis/permission.

Use the *need*, not the person's message.

---

# 24. Automation failure modes

The system must detect and prevent:

- one viral post dominating the roadmap
- competitor marketing being classified as student need
- duplicate wording generating duplicate pages
- old-year content producing false current urgency
- AI-generated facts without authoritative support
- article creation when a tool/FAQ/section update is better
- keyword cannibalization
- mass thin pages
- direct competitor copying
- sales relevance overpowering educational need
- course CTA with no actual pedagogical relevance

---

# 25. Initial Need Cluster seed

Start with clusters already repeatedly visible in market research and public competitor channels:

1. از کجا برای ارشد شروع کنم؟
2. چه زمانی شروع کنم؟
3. تغییررشته‌ای چگونه شروع کند؟
4. بهترین منابع هر درس چیست؟
5. چه درس‌هایی را بخوانم/حذف کنم؟
6. ترتیب مطالعهٔ دروس چیست؟
7. با زمان کم چه کنم؟
8. برای داوطلب شاغل چه برنامه‌ای مناسب است؟
9. ساعت مطالعه را چگونه افزایش دهم؟
10. چگونه اصولی و عمیق مطالعه کنم؟
11. مرور را چگونه انجام دهم؟
12. چه زمانی تست بزنم؟
13. آزمون آزمایشی چه زمانی/چطور؟
14. بودجه‌بندی واقعی سال‌های گذشته چیست؟
15. مباحث پرتکرار تاریخی کدام‌اند؟
16. دروس و ضرایب ۱۴۰۶ چیست؟
17. تغییرات رسمی آزمون چیست؟
18. تفاوت CE / IT / CS چیست؟
19. گرایش‌ها چه تفاوتی دارند؟
20. برای دانشگاه/گرایش X چه رتبه‌ای لازم بوده؟
21. کارنامه مشابه من چیست؟
22. با درصدهای من چه بازه رتبه‌ای دیده می‌شود؟
23. انتخاب رشته را چطور بچینم؟
24. دانشگاه‌ها را چطور مقایسه کنم؟
25. دکتری: آزمون کتبی و مصاحبه را چگونه جدا برنامه‌ریزی کنم؟
26. موضوعات درسی سطح مفهوم: “X چیست؟”
27. مقایسه الگوریتم/روش‌ها: “X vs Y”
28. خطاهای رایج در تست‌های هر مبحث
29. پیش‌نیاز هر مبحث
30. سؤال‌های تاریخی هر مبحث

This seed is not a fixed editorial calendar. Live signals must refine it.

---

# 26. Phase plan

## Phase SNI-0 — Documentation & governance

Before implementation:

- Source Registry spec
- Need Observation contract
- rights/privacy collection rules
- competitor research policy
- scoring version format
- editorial state machine

Gate:
all collectors and content agents have explicit boundaries.

## Phase SNI-1 — Manual research MVP

No crawler dependency yet.

- manually/semiautomatically import public competitor observations
- import existing competitor snapshot
- create Need Clusters
- score clusters
- generate opportunity queue
- connect to existing content inventory

Goal:
prove the editorial decision model before automating collection.

## Phase SNI-2 — First-party signals

After product traffic exists:

- site search
- zero-result search
- support/CRM categories
- question/course interactions
- Search Console

This should eventually become more important than competitor monitoring.

## Phase SNI-3 — Public competitor monitoring

Build compliant collectors/export ingestion for:

- public competitor sites
- public Telegram channels
- approved public Q&A-group sources

Use incremental checkpoints and source hashes.

No content generation from raw competitor prose.

## Phase SNI-4 — Need Intelligence Dashboard

Admin UI for:

- inbox
- clusters
- scores
- competitor gaps
- opportunities
- refresh queue

## Phase SNI-5 — Brief Factory

High-priority opportunities produce validated Content Briefs.

Still no direct publication.

## Phase SNI-6 — External Content Agent

External agent uses:

- brief
- official sources
- first-party data
- approved references
- Knowledge Graph context

Produces contract-valid Draft JSON.

Output always enters normal ingestion/review.

## Phase SNI-7 — Content ecosystem links

Add explicit editor-managed links:

- Article ↔ Topic
- Article ↔ Course/Lesson
- Article ↔ Question set
- Article ↔ Tool/Product

## Phase SNI-8 — Performance feedback

Use published-page results to update:

- need coverage
- priority
- refresh
- content format choice

## Phase SNI-9 — Advanced graph-driven production

After Knowledge Graph + Question Intelligence:

- topic coverage maps
- historical question insights
- prerequisites
- related-concept content
- data-backed programmatic pages
- adaptive content/practice pathways

---

# 27. Implementation ordering relative to current roadmap

Do **not** interrupt current Product Completion.

Required order:

```
18A Product Completion
→ 18B Release stabilization
→ SNI-0 / SNI-1
→ Phase 19 Content Ecosystem Integration
→ SNI-2 / SNI-3 / SNI-4
→ Phase 20 Knowledge Graph
→ SNI-5 / SNI-6 / SNI-7
→ Phase 21 Question Intelligence
→ SNI-8 / SNI-9
→ Programmatic SEO / Adaptive Learning
```

Some research and documentation may happen earlier, but major schema/runtime work waits until Product Completion.

---

# 28. Acceptance criteria

The Student Need Intelligence system is successful when:

1. New student needs are observable without relying on intuition.
2. Every high-priority need has evidence from one or more sources.
3. Duplicate questions converge into stable Need Clusters.
4. Editorial priority is reproducible and versioned.
5. Competitor content is never copied into canonical drafts.
6. Time-sensitive factual claims use authoritative sources.
7. High-value content maps to Knowledge Graph nodes.
8. Relevant content links to exact course/lesson/question/tool destinations.
9. Generated drafts never bypass review.
10. Published content performance feeds the next prioritization cycle.
11. The percentage of demand-weighted student needs covered by high-quality kunkurcomputer content rises over time.
12. First-party user signals progressively outweigh competitor signals as the ecosystem grows.

---

# 29. Primary KPI

The north-star content metric should be:

**Demand-weighted Need Coverage**

Not raw article count.

Example:

```
sum(priority weight of adequately covered active Need Clusters)
--------------------------------------------------------------
sum(priority weight of all active Need Clusters)
```

Supporting KPIs:

- P0/P1 need coverage
- median time Need → Brief
- median time Brief → Reviewed content
- stale-content count
- zero-result search rate
- content cannibalization count
- page → relevant next-action rate
- organic non-brand clicks
- search-query coverage
- course/question/tool progression
- useful-feedback rate
- refresh SLA compliance

The editorial organization should optimize these metrics, not monthly article volume.


# 30. AEO + gated question-bank interaction

Need-driven content must not accidentally expose the paid bank.

For topic/concept pages:

- provide a useful direct answer;
- show a configurable small sample of questions;
- show aggregate/historical context where valid;
- keep the remaining bank behind entitlement;
- connect the page to the exact course/lesson and bank scope;
- change CTA based on entitlement state.

Course buyers receive the related Question Bank entitlement automatically, while the bank remains independently sellable.

AEO is implemented on top of normal SEO, not instead of it.

Use:
- answer-first structure;
- explicit entities/relationships;
- source/freshness metadata;
- original first-party data;
- crawlable public text;
- appropriate structured data;
- OAI-SearchBot access for eligible public routes.

Do not expose locked questions in structured data or hidden page payloads.
