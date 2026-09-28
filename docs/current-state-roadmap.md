# وضعیت فعلی، محدودیت‌ها و Roadmap

## مبنا

این سند snapshot فنی بر اساس main در ۱۹ سپتامبر ۲۰۲۶ است. AGENTS.md فازهای ۰ تا ۱۷ را Done و فاز ۱۸ را Next ثبت می‌کند.

«Done» به معنی perfect/finished forever نیست؛ هر فاز debt و simplification شناخته‌شده دارد.

## فازها

| Phase | موضوع | وضعیت ثبت‌شده |
|---|---|---|
| 0 | Contracts & infrastructure | Done |
| 1 | Mother site/accounts/academy/commerce/admin | Done |
| 2 | Data ingestion factory | Done |
| 3 | Content & question bank | Done |
| 4 | Assessment engine | Done |
| 5 | Study OS | Done |
| 6 | Rank & admissions | Done |
| 7 | Growth & scale foundation | Done |
| 8 | Competitive research/editorial policy | Done |
| 9 | Editorial content/commerce foundation | Done |
| 10 | Public content architecture/SEO | Done |
| 11 | Master's subject/pillar pages | Done |
| 12 | Planning/official-information guides | Done |
| 13 | Decision/evidence/trust pages | Done |
| 14 | Resource library/archive | Done |
| 15 | Report-card bank/university choice | Done |
| 16 | Personal learning path | Done |
| 17 | Doctoral expansion | Done |
| 18 | Polish/release/measurement | Next |

## قابلیت‌های واقعاً موجود در کد

- OTP + password login و cookie session
- RBAC با 6 role
- profile
- Article/Resource editorial workflow
- source/provenance/rights modeling
- Course/Lesson/Enrollment/Progress
- Product/Price/Order/Payment abstraction/Entitlement
- ZIP ingestion + review + publish + version history
- taxonomy Subject/Topic
- public question bank + filters
- direct question authoring
- exam builder STATIC/DYNAMIC
- timed attempt/autosave-resume/submit/report
- simplified psychometrics
- goal/plan/replan/task/study session
- mastery state
- rank estimate با interval/confidence/methodology
- backtest
- university/program/capacity
- choice list + acceptance-chance surface
- CRM lead/case/interaction/campaign
- Telegram-style deep-link attribution
- SEO/sitemap/RSS/llms/public content architecture
- Docker/nginx/TLS/CI/CD/healthz

## محدودیت‌های مهم فعلی

### OTP

OtpProvider abstraction وجود دارد؛ deployment باید vendor واقعی را صریح تنظیم/پیاده کند. هیچ vendor خاصی را از روی interface فرض نکنید.

### Payment

PaymentProvider swappable است و implementation sandbox/manual در تاریخ پروژه استفاده شده است. قبل از فروش واقعی، gateway واقعی، callback verification، idempotency و reconciliation باید production-grade شوند.

### Search

Question search فعلی full-text search روی stem/solution JSON نیست؛ filter/search ساده‌تر است. برای corpus بزرگ PostgreSQL FTS/tsvector+GIN candidate منطقی است.

### Taxonomy integrity

Question/Article codes طبق contract به شکل string باقی مانده‌اند و foreign key مستقیم به Subject/Topic ندارند. validation authoring/import باید این gap را مدیریت کند.

### Direct question media

direct question authoring برای media upload مسیر کامل ندارد؛ سؤال image-heavy بهتر است از ingestion ZIP عبور کند تا asset integrity/provenance حفظ شود.

### Dynamic exam

random draw per attempt است؛ adaptive testing نیست. shuffle option/question anti-cheat کامل نیز مدل نشده است.

### Attempt expiry

expiry عمدتاً هنگام interaction/submit enforce می‌شود؛ sweeping/background finalization را مستقل فرض نکنید.

### Planning cold start

Mastery عمدتاً از evidence آزمون می‌آید. کاربر بدون evidence ممکن است plan غنی نگیرد؛ onboarding/cold-start logic جای توسعه دارد.

### Mastery formula

versioned/deterministic است، اما همهٔ سیگنال‌های ممکن مانند difficulty continuous یا study-time لزوماً در formula جاری نیستند.

### Rank estimate

نیازمند comparable cohort کافی است. widening خودکار cohort برای دادهٔ sparse نباید بدون methodology/version change اضافه شود.

### Capacity

وجود Capacity به معنی این نیست که estimator فعلی همهٔ سناریوهای تغییر ظرفیت را در probability وارد می‌کند.

### ChoiceList

ابزار planning/comparison است؛ ارسال واقعی انتخاب رشته به سامانهٔ ملی نیست.

### Outbox

CRM consumer polling-based است؛ queue/worker دارای retry/backoff/distributed ordering کامل نیست.

### Rate limiting

in-memory و per-instance است. scale-out نیازمند distributed storage است.

### Redis

در compose حاضر است اما dependency runtime فعلی نیست. صرف وجود service به معنی استفادهٔ app نیست.

### E2E database isolation

E2E را روی database real اجرا نکنید؛ test database disposable لازم است.

## تناقض‌های تاریخی اسناد

برخی بخش‌های AGENTS.md/TODO.md تاریخچهٔ phase را منعکس می‌کنند و ممکن است با code جدیدتر فاصله داشته باشند. نمونه:
- یادداشت‌های قدیمی TLS ممکن است از مرحلهٔ self-signed-only صحبت کنند، در حالی که compose فعلی certbot/ACME renewal را نیز دارد.
- TODO بخش «قابلیت آینده بانک سؤال و آزمون‌ساز» دارد، در حالی که backend فعلی QuestionBank و Assessment را بالفعل دارد. این TODO باید به‌عنوان برنامهٔ توسعهٔ نسل بعدی/محصولی خوانده شود، نه اثبات نبود feature.

قاعده: executable code/tests/config بر یادداشت تاریخی مقدم است.

## فاز ۱۸: تمرکز پیشنهادی بر اساس repo

بدون تعریف scope جدید، فاز ۱۸ باید بیشتر «release hardening» باشد:
- resolve کردن documentation/code drift
- production gateway/payment/OTP readiness
- observability و alerting
- test isolation
- performance/load measurement
- accessibility/mobile polish
- real corpus/search performance
- backup restore drill
- deploy rollback drill
- analytics measurement و KPI instrumentation
- security review

## Roadmap بعدی بدون شکستن معماری

هر توسعهٔ آینده بهتر است این مسیرها را تقویت کند:
- Question Bank: taxonomy accuracy، FTS، media authoring، richer metadata، provenance
- Assessment: blueprint constraints، shuffle، item analytics بهتر، reconnect/offline resilience
- Planning: cold start، entitlement-aware tasking، workload smoothing
- Analytics: richer calibrated comparable model با version/backtest
- Commerce: real payment/reconciliation
- Infra: distributed rate limiter/queue در صورت scale واقعی
- Notification: فقط وقتی use-case واقعی و consent model آماده است

## معیار Done برای feature جدید

یک feature «کامل» نیست مگر اینکه:
1. owner domain مشخص باشد.
2. schema/contract versioning روشن باشد.
3. auth/access policy مشخص باشد.
4. unit/e2e یا gate مناسب داشته باشد.
5. migration/rollback story داشته باشد.
6. metrics/operational failure mode شناخته شود.
7. docs به‌روز شود.
