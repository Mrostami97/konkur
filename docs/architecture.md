# معماری سیستم

## هدف سیستم

Konkur 360 یک اکوسیستم آموزشی واحد است، نه مجموعه‌ای از ابزارهای جدا. دانشجو با یک هویت وارد می‌شود و همان identity در آموزش، آزمون، برنامهٔ مطالعه، تحلیل، خرید، انتخاب رشته و CRM استفاده می‌شود.

قاعدهٔ اصلی: قابلیت‌ها می‌توانند modular باشند، اما تجربهٔ دانشجو و مدل هویت/دسترسی fragmented نمی‌شود.

## Monorepo

~~~text
apps/api        NestJS application
apps/web        Next.js application
contracts       Versioned data contracts
ops             Production operations
scripts         Offline/repository automation
docs            Documentation
~~~

Workspace با pnpm مدیریت می‌شود. Root scripts build/lint/typecheck/test را به workspaceها dispatch می‌کنند.

## Runtime topology

~~~mermaid
flowchart TB
    Browser -->|HTTPS| Nginx
    Nginx -->|public web| Web[Next.js]
    Nginx -->|API| API[NestJS]
    Web -->|SSR INTERNAL_API_URL| API
    API --> DB[(PostgreSQL)]
    API --> S3[(MinIO/S3)]
    Redis[(Redis)] -. provisioned; no current app dependency .- API
    CertInit[certs-init] --> Nginx
    Certbot --> Nginx
~~~

### نقش سرویس‌ها

PostgreSQL source of truth تراکنشی است. MinIO فایل‌های import/resource/media را نگه می‌دارد. nginx TLS termination و reverse proxy را انجام می‌دهد. Certbot/certs-init چرخهٔ certificate را پشتیبانی می‌کنند. Redis در compose provision شده ولی healthz عمداً آن را dependency واقعی اعلام نمی‌کند، چون مسیر کد فعلی به آن وابسته نیست.

## Backend composition

AppModule این domainها را کنار هم قرار می‌دهد:

Identity, Audit, Content, Learning, Commerce, Ingestion, Taxonomy, QuestionBank, Assessment, Planning, Analytics, Admissions, CRM.

Cross-cuttingهای فعلی:

- PrismaModule برای database access
- ScheduleModule برای interval/cron-style jobs
- global ThrottlerGuard
- ValidationPipe با whitelist + forbidNonWhitelisted + transform
- cookie-parser
- CORS credentialed فقط برای FRONTEND_URL

## Dependency rules

~~~mermaid
flowchart LR
    Identity --> Learning
    Identity --> Commerce
    Identity --> Planning
    Identity --> Assessment
    Content --> Learning
    Content --> Ingestion
    Taxonomy --> QuestionBank
    QuestionBank --> Assessment
    Assessment --> Analytics
    Analytics --> Planning
    Analytics --> Admissions
    Commerce --> Learning
    Commerce --> Content
    CRM --> Identity
~~~

نمودار جهت «مصرف داده/قابلیت» را نشان می‌دهد، نه الزام import مستقیم در TypeScript.

قواعد مهم:

- module دیگر مالک User نمی‌شود؛ فقط userId نگه می‌دارد.
- access logic نباید در Learning/Content دوباره اختراع شود؛ Entitlement متعلق به Commerce است.
- score/answer خارج از Assessment authoritative نیست.
- external batch نباید مستقیم در Question/Article/ReportCard بنویسد؛ Ingestion gateway است.
- analytics باید versioned/reproducible باشد.
- CRM حق تغییر مستقیم score یا access را ندارد.

## Flowهای حیاتی

### ورود کاربر

~~~mermaid
sequenceDiagram
    participant C as Client
    participant I as Identity
    participant D as PostgreSQL
    C->>I: POST /auth/otp/request
    I->>D: create/find User + OTP hash
    C->>I: POST /auth/otp/verify
    I->>D: validate OTP, create Session token hash
    I-->>C: HttpOnly session cookie
~~~

Password login مسیر مستقل دارد تا OTP/password قابل coexist باشند.

### انتشار محتوای batch

~~~mermaid
flowchart LR
    ZIP --> Receive --> Validate --> Stage --> Dedupe --> Review --> Publish --> Canonical
    Publish --> Version[ContentVersion]
    ZIP --> Artifact[SourceArtifact / S3]
~~~

Rollback تاریخچه را rewrite نمی‌کند؛ snapshot قدیمی مبنای یک version جدید می‌شود.

### آزمون

~~~mermaid
flowchart LR
    Exam --> Form --> Attempt --> Answers --> Submit --> Score
    QuestionBank --> Form
    Score --> Mastery
    Score --> Analytics
~~~

STATIC یک form curated دارد. DYNAMIC برای هر attempt از question pool یک form ایجاد می‌کند.

### برنامه و تحلیل

~~~mermaid
flowchart LR
    Answers --> MasteryState
    Goal --> Plan
    MasteryState --> Plan
    Plan --> Task
    Task --> StudySession
    ReportCard --> RankEstimate
    RankEstimate --> AcceptanceChance
    Program --> AcceptanceChance
    AcceptanceChance --> ChoiceList
~~~

## Frontend architecture

Web روی Next.js App Router است. public routes برای SEO/SSR و student/admin routes برای workflowهای تعاملی استفاده می‌شوند. Server-side fetch از INTERNAL_API_URL استفاده می‌کند؛ درخواست browser باید از public API gateway عبور کند.

KaTeX برای blockهای latex استفاده می‌شود. محتوا از block structures می‌آید، نه HTML آزاد کاربر.

## Reliability

دو health endpoint وجود دارد:

- GET /health: process-level lightweight check
- GET /healthz: deep check برای PostgreSQL و object storage، همراه latency/version/uptime

Deployment pipeline بعد از انتشار /healthz را wait می‌کند.

## معماریِ تغییرپذیر

بعضی implementationها عمداً ساده‌اند: in-memory rate limit، polling outbox consumer، sandbox payment provider، console OTP provider در حالت فاقد vendor واقعی، و search محدود. این‌ها interface/boundary دارند تا بدون شکستن ownership جایگزین شوند.

برای جزئیات debt: [current-state-roadmap.md](current-state-roadmap.md).
