# مدل دامنه و مالکیت

این سند مشخص می‌کند هر مفهوم «کجا زندگی می‌کند» و کدام module صاحب حقیقت آن است.

## Domain map

| Domain | Aggregate/modelهای مهم | Source of truth / مسئولیت |
|---|---|---|
| Identity | User, UserRole, Session, OtpCode, Consent, Profile | هویت، نقش و session |
| Audit | AuditLog | trail عملیات حساس |
| Content | Article, ContributorProfile, ContentSource, Resource | محتوای editorial و provenance |
| Learning | Course, CourseModule, Lesson, Enrollment, LessonProgress | آموزش و progress |
| Commerce | Product, Price, Order, Payment, Entitlement | خرید و access |
| Ingestion | ImportJob, ImportItem, SourceArtifact, ContentVersion | ورود batch، review، version/rollback |
| Taxonomy | Subject, Topic, prerequisite links | vocabulary canonical |
| Question Bank | Question + question workflow surface | browse/filter/authoring |
| Assessment | Exam, ExamForm, ExamItem, Attempt, Answer, Score | آزمون و نمره |
| Planning | Goal, Plan, Task, PlanRevision, StudySession, SavedResource | برنامه و فعالیت مطالعه |
| Analytics | MasteryState, RankEstimate, BacktestReport | محاسبات mastery/rank/calibration |
| Admissions | University, Program, Capacity, ChoiceList | اطلاعات دانشگاه و انتخاب‌ها |
| CRM | Lead, Case, Interaction, Campaign | growth/support lifecycle |

## Identity

User با phone یکتا شناخته می‌شود. یک کاربر چند Role می‌تواند داشته باشد: STUDENT, MENTOR, AUTHOR, REVIEWER, ADMIN, FINANCE.

Session token خام در دیتابیس ذخیره نمی‌شود؛ tokenHash ذخیره می‌شود. OTP نیز codeHash دارد. Profile یک sub-resource هویتی است و targetDegree/targetField را نگه می‌دارد.

## Content + editorial

Article و Resource workflow دارند. ContentSource فقط citation ساده نیست؛ metadata حق استفاده، source tier، canonical/deep URL، scope و permissions مانند mayLink/mayEmbed/mayQuote/mayReproduce/mayHost را نگه می‌دارد.

ContributorProfile می‌تواند PERSON یا ORGANIZATION باشد و به authored/reviewed articles/resources متصل شود.

Resource سه محور مهم دارد:

- kind: PDF/video/note/external/official/... 
- accessMode: PUBLIC / ACCOUNT / ENTITLEMENT
- hostingMode: metadata/link/embed/upload/mirrored-with-permission

## Learning + Commerce

Course از module و lesson تشکیل می‌شود. Enrollment نتیجهٔ دسترسی آموزشی است، اما «آیا کاربر واقعاً حق دسترسی دارد؟» را Entitlement تعیین می‌کند.

Product می‌تواند COURSE، RESOURCE یا BUNDLE باشد. ProductCourseGrant و ProductResourceGrant محتویات grant را مشخص می‌کنند. Price قیمت فعال را نگه می‌دارد؛ Order/OrderItem سفارش و Payment وضعیت پرداخت را ثبت می‌کنند.

Grant می‌تواند ORDER/GIFT/MANUAL/TRIAL باشد و بازهٔ startAt/endAt/revokedAt دارد.

## Question + ingestion

Question canonical شامل exam metadata، subject/topic codes، stemBlocks، options، correctOption، solutionBlocks، assets، provenance و version است.

Questionهایی که از بیرون وارد می‌شوند ابتدا ImportItem هستند و بعد از review/publish canonical می‌شوند. direct authoring نیز باید همان discipline version/review را حفظ کند.

ReportCard برای دادهٔ کارنامه است و publicConsent دارد؛ دادهٔ عمومی بدون consent نباید ساخته شود.

## Assessment

Exam blueprint است. ExamForm مجموعهٔ ordered questionهاست. Attempt به یک form مشخص وصل است. Answer برای هر attempt/question یکتا است. Score یک رکورد reproducible با scoreVersion، counts و percent دارد.

این domain تنها مرجع authoritative پاسخ و نمره است.

## Planning + Mastery

Goal هدف فعلی دانشجو را مشخص می‌کند. Plan snapshotی از goal دارد تا بعداً قابل توضیح باشد. Task reasonCode و priority دارد. هر replan در PlanRevision ثبت می‌شود.

StudySession زمان واقعی مطالعه را ثبت می‌کند. MasteryState در Analytics مالکیت دارد، حتی اگر Planning آن را مصرف کند. masteryScore همراه confidence، evidenceCount و ruleVersion ذخیره می‌شود.

## Rank + admissions

RankEstimate فقط یک عدد نیست: median، P50/P80 interval، confidence، comparable count/years، sensitivity، methodology و estimatorVersion دارد.

BacktestReport calibration estimator را ثبت می‌کند.

Admissions شامل University → Program → Capacity است. ChoiceList فقط ابزار مرتب‌سازی/مقایسهٔ انتخاب‌هاست و integration با سامانهٔ ملی پذیرش نیست.

## CRM

Lead stage از LEAD تا ADVOCATE است. Case و Interaction support history را می‌سازند. Campaign deep-link attribution دارد. CRM از eventهای outbox استفاده می‌کند ولی حق mutation مستقیم access/score را ندارد.

## Transactional outbox

OutboxEvent برای ثبت event در همان database transaction وجود دارد. consumer فعلی CRM polling-based است. این table قرارداد آینده برای async fan-out است، نه جایگزین queue کامل.

## قواعد dependency

1. از model دامنهٔ دیگر کپی نسازید.
2. اگر مفهوم source of truth دارد، validation/mutation نهایی باید در owner module بماند.
3. cross-domain workflow بهتر است از service boundary یا event صریح عبور کند.
4. denormalized snapshot فقط وقتی مجاز است که برای audit/reproducibility لازم باشد.
5. public DTO و database model را یکی فرض نکنید؛ DTO سطح API است و Prisma سطح persistence.
