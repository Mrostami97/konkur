# Learning Growth, Question-Bank Access & AEO Model

Status: owner-approved product direction  
Date: 2026-09-20  
Product: کنکور کامپیوتر / kunkurcomputer

## 1. Core product promise

A student should be able to enter کنکور کامپیوتر with little or no preparation and use the ecosystem to gradually improve:

- study consistency,
- effective study time,
- prerequisite coverage,
- topic mastery,
- question-solving ability,
- exam readiness,
- and confidence grounded in evidence.

The system must not give every student the same plan.

A weak beginner, a strong candidate, a career changer, and a working student should receive materially different learning paths.

---

# 2. Question-bank access model

## 2.1 Public pages are previews, not the full bank

A public Subject/Topic/Guide page must **not** expose every historical question for that topic.

Preferred structure:

1. answer-first educational content;
2. topic explanation;
3. a configurable number of public sample questions;
4. summary statistics / coverage where valid;
5. locked remaining question count;
6. clear CTA to unlock the full bank;
7. course/lesson connection when relevant.

Example:

```
Shortest Path
├─ explanation
├─ examples
├─ 3–5 free sample questions (configurable)
├─ “18 more verified questions available”
└─ Unlock full question bank
```

The sample count must be configuration/product policy, not hard-coded into page templates.

## 2.2 Full question bank is entitlement-controlled

The complete bank belongs in the authenticated product experience.

Public SEO/AEO pages may expose enough educational value and samples to satisfy intent, but full question browsing/solving should require the appropriate entitlement.

Do not reveal locked question stems/options through page source, API responses, structured data, preload payloads, or client-side hiding.

Authorization is server-side.

## 2.3 Question bank remains separately sellable

The Question Bank and Course remain separate commercial products.

A user may:

- purchase Question Bank access only;
- purchase a Course;
- receive the related Question Bank access as a free included benefit of that Course;
- potentially purchase a wider Bundle.

This preserves the separate value of the bank while increasing Course value.

---

# 3. Course purchase → related bank access included (superseded)

> **Superseded by the owner on 2026-10-06:** the question bank is sold separately. Buying a course does **not** include its bank; a COURSE product grants its course only (the API refuses bank grants on it), and a course sold together with its bank is a BUNDLE. The rest of this section is kept as the record of the earlier decision.

Earlier owner decision:

**When a student purchases a course, the question bank associated with that course is included at no additional charge for the applicable access period.**

Examples:

```
Data Structures & Algorithms Course
→ Course entitlement
→ Data Structures & Algorithms Question Bank entitlement
```

```
Theory of Languages Course
→ Course entitlement
→ Theory/Automata Question Bank entitlement
```

## 3.1 Current schema gap

Current Commerce supports:

- COURSE
- RESOURCE
- BUNDLE
- ProductCourseGrant
- ProductResourceGrant
- Entitlement

It does **not** currently have a normalized Question Bank grant.

Therefore Product Completion must add a clean, auditable bank-access target rather than scattering checks throughout controllers/UI.

Possible implementation direction:

```
ProductKind:
  COURSE
  RESOURCE
  QUESTION_BANK
  BUNDLE
```

and/or an explicit grant relation such as:

```
ProductQuestionBankGrant
- productId
- bankScopeId / subjectId / collectionId
```

Final shape should match the Question Bank domain after audit.

Requirements:

- one source of truth for access;
- server-side enforcement;
- optional start/end dates;
- revocation support;
- admin-visible grant composition;
- course purchase automatically grants the mapped bank scope;
- course refund/revocation follows explicit business rules;
- bank-only purchase does not automatically grant the course.

Do not implement access with a UI-only “isCourseBuyer” condition.

---

# 4. Student onboarding and baseline

The learning system should establish a baseline before prescribing a serious plan.

## 4.1 Initial inputs

Use existing Goal fields:

- degree
- field
- target exam date
- weekly hours
- self-reported level

Also collect or infer:

- prior major / career-change status when useful;
- active course access;
- available days/times;
- current subject priorities.

## 4.2 Self-report is not mastery

`selfReportedLevel` is only a planning prior.

It may change the starting path, but must never produce a mastery score by itself.

Mastery requires assessment evidence.

## 4.3 Diagnostic assessment

Offer a short diagnostic appropriate to the student's target.

The diagnostic should sample prerequisites and core topics, not try to test the entire syllabus.

Output:

- strong areas;
- weak areas;
- unknown areas;
- missing prerequisites;
- confidence based on evidence count.

Students may begin without a diagnostic, but the system should label uncertainty honestly.

---

# 5. Different plans for weak and strong students

## 5.1 Foundation path — weak/base-deficient student

Characteristics:

- more prerequisite work;
- fewer concurrent subjects initially;
- smaller study blocks;
- more guided lessons/examples;
- lower initial question difficulty;
- more review;
- frequent low-stakes checks;
- slower workload ramp;
- explicit “why this comes first”.

Example:

```
Programming basics
→ Discrete prerequisites
→ Data structures basics
→ topic lesson
→ easy/medium practice
→ review
→ diagnostic retest
```

## 5.2 Standard path — moderate student

Characteristics:

- balanced lesson + practice;
- normal prerequisite checks;
- topic-based weekly goals;
- regular mixed practice;
- periodic mastery checks.

## 5.3 Acceleration path — strong student

Characteristics:

- diagnostic skip of already-proven material;
- larger share of questions/exams;
- mixed-topic practice earlier;
- focus on weak/error clusters;
- advanced questions sooner;
- less explanatory repetition;
- faster progression when evidence remains strong.

Strong students should not be forced through beginner lessons merely to complete content.

---

# 6. Gradual study-time growth

The system should help the student build sustainable study capacity rather than suddenly assigning an unrealistic schedule.

Existing fields already support this direction:

- Goal.weeklyHours
- StudySession.minutes
- Plan / Task
- PlanRevision

## 6.1 Separate three concepts

Always show separately:

1. **Time logged**
2. **Content progress**
3. **Mastery evidence**

More hours do not automatically mean higher mastery.

## 6.2 Workload ramp

Start from:

- stated availability,
- recent actual study time,
- plan adherence,
- upcoming exam date,
- fatigue/missed-task signals.

Increase planned workload only when recent behavior supports it.

Initial product policy can use a configurable bounded weekly ramp (for example, a conservative percentage cap), but the value must be versioned/configurable rather than buried in code.

If adherence falls:

- do not punish the student with an even larger backlog;
- redistribute;
- reduce overload;
- preserve priority topics;
- explain the trade-off.

---

# 7. Mastery growth loop

Target loop:

```
Learn
→ Practice
→ Assessment evidence
→ Mastery update
→ Detect weakness/prerequisite
→ Targeted review
→ Retest
→ Replan
```

Use existing `MasteryState`:

- masteryScore
- confidence
- evidenceCount
- ruleVersion
- computedAt

Requirements:

- no mastery from lesson completion alone;
- no mastery from minutes alone;
- recency matters;
- mixed/retest evidence matters more than one successful attempt;
- low evidence count means low confidence;
- every recommendation should be explainable.

---

# 8. Daily experience

The student should not see a giant curriculum every morning.

Primary “Today” experience:

- maximum ~3 meaningful actions by default;
- estimated minutes;
- reason for each action;
- progress indicator;
- option to defer/reschedule;
- clear distinction between learn / review / practice / assess.

Examples:

- «۲۰ دقیقه: مرور Heap — چون پیش‌نیاز Priority Queue در Dijkstra است.»
- «۱۵ دقیقه: ۵ تست کوتاه‌ترین مسیر — برای سنجش دوباره بعد از جلسه SSSP.»
- «۳۰ دقیقه: جلسه MST — طبق مسیر این هفته.»

The exact count/time can adapt, but cognitive load should stay low.

---

# 9. Course ↔ bank ↔ content loop

The ecosystem should create a closed learning path:

```
Public answer page
→ topic
→ sample questions
→ exact course lesson
→ full bank access (if entitled)
→ practice
→ assessment
→ mastery
→ next recommended lesson/topic
```

The bank is sold separately from courses (owner, 2026-10-06), so CTA changes by state:

### Visitor
“نمونه تست‌ها را ببین / بانک کامل را فعال کن / دوره را ببین”

### Bank-only buyer
“همه تست‌ها را حل کن / آموزش مرتبط را ببین”

### Course buyer
“ادامه جلسه / همه تست‌های این مبحث در دسترس شماست”

Do not repeatedly sell an already-entitled product.

---

# 10. AEO strategy

AEO = Answer Engine Optimization.

Owner direction: کنکور کامپیوتر should be highly discoverable and citable in answer engines and generative search.

Important: **AEO does not replace SEO.**

Google's current Search guidance explicitly says standard SEO best practices remain relevant for generative AI search because AI features rely on core ranking and quality systems.

Therefore use:

```
Technical SEO
+
High-quality human-useful content
+
Knowledge Graph/entity clarity
+
AEO answer structure
+
First-party data
+
Crawler accessibility
```

not “AEO instead of SEO”.

## 10.1 Answer-first content

High-intent pages should quickly state:

- direct answer;
- scope/year;
- key caveat;
- source when time-sensitive.

Then expand.

## 10.2 Entity clarity

Pages should make relationships explicit:

```
Dijkstra
type: shortest-path algorithm
parent: Graph / SSSP
requires: non-negative edge weights for the standard algorithm
related: Bellman-Ford
course: Data Structures & Algorithms
```

Knowledge Graph work will make this stronger.

## 10.3 Original/non-commodity value

Prefer information answer engines have a reason to cite:

- owned question statistics;
- original explanations/examples;
- exam history;
- report-card aggregates;
- university/program evidence;
- current official changes;
- structured comparisons;
- transparent methodology.

Do not generate commodity paraphrases at scale.

## 10.4 Crawlability

For public content intended for ChatGPT Search:

- allow `OAI-SearchBot` on eligible public routes;
- ensure CDN/WAF does not accidentally block it;
- keep private/account/bank-full routes protected;
- track ChatGPT referrals where analytics supports it.

Public discovery must not require exposing paid bank content.

## 10.5 Paywall and search

For pages mixing public and restricted content:

- ensure public content is genuinely useful;
- use server-side access control;
- consider supported paywalled/subscription markup where semantically appropriate;
- do not serve materially different fake content to crawlers and users;
- do not leak locked question content into structured data.

Google documents paywalled-content markup and notes that generative AI Search features follow Search preview controls.

## 10.6 Structured data

Use only valid schemas matching visible page content.

Potentially useful existing/related types:

- Article
- Breadcrumb
- Course / Course list where supported
- Dataset
- Organization / Person
- Practice Problem / Education Q&A only when the page actually meets current eligibility

Do not add schema solely because an SEO tool suggests it.

Google removed FAQ rich-result support in 2026, so FAQ markup must not be treated as an AEO ranking trick.

## 10.7 Measurement

Track:

- Google organic queries;
- AI Mode/AI Overview traffic as surfaced in Search Console totals/current reporting;
- ChatGPT referral traffic;
- landing-page → next-action;
- citations/referrals where measurable;
- branded vs non-branded demand;
- answer-page assisted course/bank progression.

---

# 11. Public sample strategy for SEO/AEO

A public topic page should be strong enough to rank/be cited without giving away the paid product.

Recommended composition:

```
Quick answer
→ explanation
→ example
→ key comparison/table
→ 3–5 sample questions (configurable)
→ historical/statistical summary
→ related concepts
→ source/review metadata
→ exact course lesson
→ unlock full bank
```

This creates a real public information asset while preserving paid depth.

---

# 12. Product Completion tasks required now

Because these choices affect UI/admin/commerce, Claude should account for them during current Product Completion:

1. design Question Bank locked/unlocked states;
2. build a configurable public sample policy;
3. ensure locked question data is never sent to unauthorized clients;
4. add/administer Question Bank access grants;
5. sell a course with its bank only as a BUNDLE (a COURSE product never carries Bank access; owner, 2026-10-06);
6. show bundle/included benefits clearly in product/admin UI;
7. make Account show active bank entitlements;
8. adapt CTA based on entitlement state;
9. preserve separate Question Bank sale;
10. keep SEO/AEO public pages indexable while full-bank app routes remain appropriately private/noindex.

Knowledge Graph/adaptive algorithms can wait, but the access model must not be designed in a way that blocks them later.

---

# 13. Acceptance criteria

This direction is complete when:

- public topic pages expose only configured samples;
- unauthorized users cannot obtain locked question data from APIs/page payloads;
- bank access can be sold independently;
- a course purchase does not include bank access; course + bank is a BUNDLE (owner, 2026-10-06);
- weak and strong students receive different plans;
- self-report does not masquerade as mastery;
- study time ramps gradually based on actual behavior;
- mastery is evidence-based;
- today view gives a manageable sequence of actions;
- content/course/question flows are connected;
- public answer pages remain useful enough for SEO/AEO;
- paid content remains protected;
- AEO is measured as an additional discovery channel, not treated as a replacement for SEO.
