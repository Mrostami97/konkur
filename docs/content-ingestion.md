# محتوا، منابع و Ingestion

## اصل بنیادی

Runtime پروژه AI/OCR/LLM را صدا نمی‌زند. ابزار بیرونی می‌تواند OCR یا تولید داده انجام دهد، اما تنها خروجی پذیرفته‌شده برای ورود batch، JSON/ZIP مطابق contract نسخه‌دار است.

هیچ extractor یا agent خارجی نباید مستقیم در PostgreSQL canonical بنویسد.

## Contracts

پوشهٔ contracts شامل:

- JSON Schemaهای نسخه‌دار
- TypeScript types/validators
- fixtureهای valid/invalid
- testهای contract

قراردادهای اصلی پروژه article، question و report-card هستند؛ نسخه‌های جدید باید additive/explicit باشند و consumer قدیمی را بی‌خبر نشکنند.

## دو مسیر محتوا

### Editorial authoring

Author/Admin از admin API Article/Resource می‌سازد. جریان اصلی:

~~~mermaid
flowchart LR
    Draft --> Submit[IN_REVIEW]
    Submit -->|Reviewer approve| Published
    Submit -->|reject| Rejected
    Published --> Revise[New Draft Revision]
~~~

Published canonical تا زمان approval revision جدید live می‌ماند.

### Bulk ingestion

برای دادهٔ بیرونی:

~~~mermaid
flowchart LR
    ZIP --> Receive
    Receive --> ContractValidation
    ContractValidation --> Staging
    Staging --> Normalize
    Normalize --> AssetCheck
    AssetCheck --> Dedupe
    Dedupe --> DomainQA
    DomainQA --> HumanReview
    HumanReview --> Publish
    Publish --> Canonical
    Publish --> VersionHistory
~~~

endpoint: POST /admin/import، multipart field با نام file، سقف 50MB.

ZIP باید payload.json در root داشته باشد و assetهای referenced طبق قرارداد همراه آن باشند.

## ImportJob

ImportJob سطح batch است:
- schemaVersion
- idempotencyKey
- status
- submittedBy
- totalItems

idempotencyKey از دوباره‌کاری batch byte-identical جلوگیری می‌کند.

## ImportItem

هر item مستقل review می‌شود:
- externalId
- rawPayload
- validationErrors
- dedupeStatus
- status
- reviewedBy/reviewedAt/reviewNote
- publishedEntityId/publishedVersion

Status lifecycle: PENDING → VALID/INVALID → APPROVED/REJECTED → PUBLISHED.

DedupeStatus: NEW / MATCH / CONFLICT.

## Canonical publish

Question، ReportCard و Article/Resource canonical نباید قبل از validation/review از batch تغییر کنند. publish نقطهٔ mutation رسمی canonical است.

هر publish باید:
- actor/provenance را حفظ کند.
- version history بسازد.
- dedupe/idempotency را رعایت کند.
- partial failure را طوری مدیریت کند که وضعیت قابل تشخیص بماند.

## ContentVersion

ContentVersion generic است و entityTypeهای ARTICLE، QUESTION، REPORT_CARD و RESOURCE را پوشش می‌دهد.

Snapshot شامل payload، version، schemaVersion، reviewStatus، creator/reviewer timestamps و linkage به import item است.

Rollback destructive نیست. درخواست rollback نسخهٔ قدیمی را مبنا قرار می‌دهد ولی تاریخچه را پاک نمی‌کند.

## SourceArtifact و MinIO

فایل‌های import/upload در object storage قرار می‌گیرند و SourceArtifact metadata زیر را نگه می‌دارد:

- checksum
- filename
- mimeType
- size
- storageKey

checksum identity اصلی artifact است.

## Resource access

Resource accessMode:
- PUBLIC
- ACCOUNT
- ENTITLEMENT

hostingMode:
- METADATA_ONLY
- EXTERNAL_LINK
- OFFICIAL_EMBED
- USER_UPLOAD
- MIRRORED_WITH_PERMISSION

GET /resources/:slug/content قبل از stream/download access را در service بررسی می‌کند و response protected با private, no-store ارائه می‌شود.

## /media/:checksum

این endpoint فقط artifactهایی را public presigned redirect می‌کند که به Resource current/history/audit متصل نباشند. اگر artifact در Resource استفاده شده باشد 404 برمی‌گرداند تا protected bytes از مسیر عمومی دور زده نشوند.

برای paid/protected media جدید از این endpoint به‌عنوان access layer استفاده نکنید.

## Provenance و حقوق منبع

ContentSource اطلاعات زیر را مدل می‌کند:
- canonical/deep URL
- publisher/creator
- source tier و authority scopes
- checked/published/issued dates
- rights holder/basis/license
- مجوزهای link/embed/quote/reproduce/adapt/translate/host
- commercial-use flag

قاعده: وجود URL به معنی مجوز mirror/reproduce نیست.

ArticleSource/ResourceSource locator، claim، relation و order را نگه می‌دارند. اطلاعات رسمی admissions نیز می‌تواند source مستقیم داشته باشد.

## Question contract

Question canonical حداقل این semantics را دارد:
- externalId
- examDegree / examMajor / examYear
- subjectCode / topicCodes
- stemBlocks
- options
- correctOption
- solutionBlocks
- assets
- source/provenance
- version

برای question image-bearing، مسیر ZIP مناسب‌تر از direct authoring فعلی است.

## ReportCard privacy

ReportCard anonymousId و publicConsent دارد. public discovery باید consent را enforce کند. دادهٔ خام شناسایی‌کننده نباید در public corpus یا fixture قرار گیرد.

## Editorial policy

برای قواعد کیفیت محتوا و style:
- docs/content/editorial-policy.md
- docs/content/editorial-style-guide.md

برای snapshot رقبا و product opportunities:
- docs/content/competitor-snapshot.md
- docs/content/product-opportunity-matrix.md

## اضافه کردن Contract version

1. schema جدید را با نام/version جدید اضافه کنید.
2. fixtures valid/invalid بسازید.
3. validator/type را آپدیت کنید.
4. ingestion dispatch را سازگار کنید.
5. migration canonical را اگر لازم است جدا انجام دهید.
6. backward compatibility را تست کنید.
7. docs و sample payload را به‌روز کنید.
8. هیچ producer خارجی را قبل از deploy consumer جدید تغییر ندهید.
