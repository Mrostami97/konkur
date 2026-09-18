# دیتابیس و مدل Persistence

## فناوری و محل تعریف

دیتابیس اصلی PostgreSQL است و schema با Prisma تعریف می‌شود:

- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/

Prisma Client در backend استفاده می‌شود. DATABASE_URL تنها connection string authoritative برای API است.

## گروه‌بندی مدل‌ها

### Identity

- User
- Profile
- UserRole
- OtpCode
- Session
- Consent
- AuditLog

نکته: UserRole رابطهٔ many-to-many منطقی User↔Role را پیاده می‌کند. phone یکتا است. Session.tokenHash و OtpCode.codeHash برای جلوگیری از ذخیرهٔ credential خام هستند.

### Content و Editorial

- Article
- ContributorProfile
- ContentSource
- ArticleSource
- Resource
- ResourceSource

Article و Resource provenance/source links و review/version metadata دارند. ContentSource اطلاعات حقوقی و authority را نیز نگه می‌دارد.

### Learning

- Course
- CourseModule
- Lesson
- Enrollment
- LessonProgress

ترتیب module/lesson با order نگه‌داری می‌شود. Lesson می‌تواند چند Topic داشته باشد.

### Commerce

- Product
- ProductCourseGrant
- ProductResourceGrant
- Price
- Order
- OrderItem
- Payment
- Entitlement

Entitlement از Order جداست تا grant دستی، هدیه و trial نیز مدل شود.

### Ingestion و Canonical content

- Question
- ReportCard
- ImportJob
- ImportItem
- SourceArtifact
- ContentVersion

ImportJob idempotencyKey یکتا دارد. ImportItem وضعیت validation/review/dedupe را حمل می‌کند. SourceArtifact با checksum یکتا فایل object storage را نشان می‌دهد.

ContentVersion کلید ترکیبی منطقی entityType + entityId + version دارد و snapshot JSON را نگه می‌دارد.

### Taxonomy

- Subject
- Topic
- SubjectPrerequisite
- TopicPrerequisite
- LessonTopic

Subject.code و Topic.code یکتا هستند. prerequisiteها self-relationهای صریح‌اند.

### Assessment

- Exam
- ExamForm
- ExamItem
- Attempt
- Answer
- Score

~~~mermaid
erDiagram
    Exam ||--o{ ExamForm : has
    ExamForm ||--o{ ExamItem : contains
    Question ||--o{ ExamItem : used_in
    User ||--o{ Attempt : starts
    Exam ||--o{ Attempt : receives
    ExamForm ||--o{ Attempt : uses
    Attempt ||--o{ Answer : records
    Question ||--o{ Answer : answered
    Attempt ||--o| Score : produces
~~~

Answer روی attemptId+questionId یکتا است. Score روی attemptId یکتا است.

### Planning و Analytics

- Goal
- Plan
- Task
- SavedResource
- PlanRevision
- StudySession
- MasteryState
- RankEstimate
- BacktestReport
- OutboxEvent

Plan snapshot هدف را نگه می‌دارد تا برنامهٔ تاریخی با تغییر Goal معنایش را از دست ندهد. MasteryState روی userId+topicCode یکتا است.

### Admissions

- University
- Program
- Capacity
- ChoiceList
- ChoiceListItem

Capacity روی programId+examYear+quota یکتا است. ChoiceList برای هر User یکتا است.

### CRM

- Lead
- Case
- Interaction
- Campaign

Lead برای هر User یکتا است.

## Versioning

دو نوع versioning دیده می‌شود:

1. فیلد version روی canonical entityهایی مثل Article/Question/ReportCard/Resource.
2. ContentVersion به‌عنوان immutable snapshot history.

اصل rollback: تاریخچه حذف یا overwrite نمی‌شود. rollback باید snapshot قدیمی را بخواند و یک revision/version جدید بسازد. این طراحی auditability را حفظ می‌کند.

## Provenance

Question/ReportCard دارای provenance JSON هستند. Article/Resource علاوه بر provenance، رابطهٔ explicit با ContentSource دارند. برای منابع رسمی admissions نیز University/Program/Capacity می‌توانند ContentSource داشته باشند.

در هر feature جدیدی که به دادهٔ بیرونی وابسته است، source/provenance باید بخشی از مدل باشد، نه فقط متن توضیحی UI.

## JSON columns

بخش‌هایی مانند contentBlocks، stemBlocks، solutionBlocks، options، provenance، sensitivity و metadata عمداً Json هستند. مزیت آن سازگاری با versioned contracts است؛ عیب آن کاهش referential integrity و دشوارتر شدن search/query است.

قاعدهٔ توسعه:

- داده‌ای که identity/relationship/query اصلی است → column/table صریح.
- payload نسخه‌دار یا block document → Json قابل قبول.
- چیزی که مرتب filter/sort/join می‌شود نباید صرفاً داخل JSON دفن شود.

## Indexها

Schema فعلی روی مسیرهای پرکاربرد index دارد؛ از جمله userId، reviewStatus، contentType، subjectCode، exam/year/field و statusهای import.

قبل از افزودن index:
- query واقعی و cardinality را بررسی کنید.
- indexهای array/JSON/FTS را فقط با query plan و corpus واقعی اضافه کنید.
- migration تولیدشده را دستی review کنید.

## Migration workflow

توسعه:

~~~bash
pnpm migrate:dev
~~~

production:

~~~bash
pnpm migrate:deploy
~~~

rollback سفارشی آخرین migration:

~~~bash
pnpm migrate:down
~~~

Reset فقط dev/staging و destructive است:

~~~bash
pnpm migrate:reset
~~~

جزئیات migration/rollback و backup prerequisites در ../ops/runbook.md است.

## Seed

Root command:

~~~bash
pnpm seed
~~~

Seed runner برای محیط‌ها guard دارد. credentialهای deterministic تست نباید به production seed نشت کنند. administrator production فقط با BOOTSTRAP_ADMIN_PHONE و BOOTSTRAP_ADMIN_PASSWORD صریح provision می‌شود.

## تغییر schema

برای هر تغییر persistence:

1. owner domain را مشخص کنید.
2. schema.prisma را تغییر دهید.
3. migration بسازید و SQL را review کنید.
4. backward/forward compatibility را بررسی کنید.
5. seed/fixtures/e2e را اصلاح کنید.
6. database.md و domain-model.md را به‌روز کنید.
7. rollback story داشته باشید، مخصوصاً برای تغییر destructive.

## دادهٔ حساس

User phone، session data، report-card data و هر PII واقعی نباید وارد fixture عمومی یا log شود. برای نمونه‌ها از دادهٔ مصنوعی استفاده کنید.
