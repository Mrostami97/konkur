# Konkur 360

پلتفرم یکپارچهٔ آموزشی فارسی برای آمادگی کنکور کارشناسی ارشد و دکتری مهندسی کامپیوتر، علوم کامپیوتر و فناوری اطلاعات.

این مخزن فقط «بانک سؤال» یا «آزمون‌ساز» نیست. هستهٔ محصول یک mother site با هویت واحد دانشجو، محتوای نسخه‌دار، آموزش، بانک سؤال، آزمون، برنامه‌ریزی مطالعه، تحلیل، تخمین رتبه، انتخاب رشته، فروش/دسترسی و CRM است.

> این README نمای سریع پروژه است. مستندات فنی کامل در [docs/README.md](docs/README.md) قرار دارد.

## وضعیت فعلی

مبنای این مستندات کد موجود در شاخهٔ main در ۱۹ سپتامبر ۲۰۲۶ است. فازهای ۰ تا ۱۷ در AGENTS.md به‌عنوان انجام‌شده ثبت شده‌اند و فاز ۱۸ (Polish, release, measurement) مرحلهٔ بعدی است.

اصول غیرقابل‌مذاکرهٔ معماری:

- یک هویت، یک پروفایل دانشجو و یک مدل Entitlement برای کل اکوسیستم.
- دادهٔ خارجی فقط از مسیر نسخه‌دار contracts → staging → validate → review → publish وارد دادهٔ canonical می‌شود.
- Runtime سایت هیچ AI/LLM/OCR/RAG/embedding provider را فراخوانی نمی‌کند.
- محاسبات حساس به تصمیم مانند mastery و rank estimate باید deterministic/versioned و قابل بازتولید باشند.
- Commerce تنها source of truth برای فعال بودن دسترسی است.
- Assessment تنها source of truth برای پاسخ، attempt و score است.
- Ingestion تنها درگاه رسمی ورود batch خارجی است.

## معماری در یک نگاه

~~~mermaid
flowchart LR
    U[Browser / Student / Admin] --> N[NGINX :80/:443]
    N --> W[Next.js Web]
    N --> A[NestJS API]
    A --> P[(PostgreSQL)]
    A --> S[(MinIO / S3)]
    A -. provisioned, not current app dependency .-> R[(Redis)]
    C[Certbot + certs-init] --> N
~~~

- Web: Next.js 14 + React 18، App Router، RTL/Persian UI، SSR/SEO، KaTeX
- API: NestJS 10 + Prisma 5
- Database: PostgreSQL 16
- Object storage: MinIO/S3-compatible
- Edge/TLS: nginx + Certbot/certs-init
- Workspace: pnpm 9.12، Node.js 20+
- Contracts: JSON Schema + validators + fixtures
- CI/CD: GitHub Actions، build/lint/typecheck/test/image validation/GHCR/deploy/healthz

## دامنه‌های Backend

| دامنه | مسئولیت اصلی |
|---|---|
| Identity | کاربر، نقش، Session، OTP/password، Consent، Profile |
| Audit | ثبت عملیات مهم |
| Content | مقاله، منبع، Contributor، Resource، workflow تحریریه |
| Learning | Course/Module/Lesson/Enrollment/Progress |
| Commerce | Product/Price/Order/Payment/Entitlement |
| Ingestion | ZIP import، staging، review، publish، version/rollback، media |
| Taxonomy | Subject/Topic و prerequisiteها |
| Question Bank | مرور/فیلتر/ساخت سؤال و نسخه‌ها |
| Assessment | Exam/Form/Attempt/Answer/Score/psychometrics |
| Planning | Goal/Plan/Task/StudySession/SavedResource |
| Analytics | Mastery، RankEstimate، Backtest، acceptance chance |
| Admissions | University/Program/Capacity/ChoiceList |
| CRM | Lead/Case/Interaction/Campaign و attribution |

جزئیات مرزها و flowها: [docs/domain-model.md](docs/domain-model.md)

## شروع سریع

نیازمندی‌ها:

- Node.js 20+
- pnpm 9.12+
- Docker Engine + Docker Compose plugin

~~~bash
git clone https://github.com/Mrostami97/konkur.git
cd konkur
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --build
~~~

برای توسعهٔ workspace:

~~~bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm dev:api
pnpm dev:web
~~~

راهنمای کامل توسعه: [docs/development.md](docs/development.md)

## ساختار مخزن

~~~text
apps/
  api/          NestJS + Prisma backend
  web/          Next.js frontend
contracts/      JSON schemas, validators, fixtures
docs/           Technical + product/content documentation
docs/content/   Editorial/research/content-operating documents
ops/            nginx, TLS, backup/restore, runbook
scripts/        Editorial/resource/IndexNow automation
.github/        CI/CD and contribution templates
~~~

## مستندات اصلی

| سند | کاربرد |
|---|---|
| [Documentation index](docs/README.md) | نقطهٔ ورود مستندات |
| [Architecture](docs/architecture.md) | معماری سیستم و flowهای اصلی |
| [Domain model](docs/domain-model.md) | مالکیت دامنه‌ها و source of truth |
| [Database](docs/database.md) | Prisma schema و روابط |
| [API reference](docs/api-reference.md) | endpointها، auth و roles |
| [Frontend](docs/frontend.md) | route map و ساختار Next.js |
| [Content & ingestion](docs/content-ingestion.md) | contracts، provenance، review و versioning |
| [Development](docs/development.md) | نصب، env، seed، migration و commandها |
| [Testing & CI](docs/testing-ci.md) | تست‌ها و pipeline |
| [Deployment & operations](docs/deployment-operations.md) | Docker، TLS، health، backup، rollback |
| [Security model](docs/security-model.md) | session، RBAC، rate-limit، secrets، media |
| [Current state & roadmap](docs/current-state-roadmap.md) | وضعیت واقعی و محدودیت‌های شناخته‌شده |

همچنین [ops/runbook.md](ops/runbook.md)، [SECURITY.md](SECURITY.md)، [CONTRIBUTING.md](CONTRIBUTING.md) و [AGENTS.md](AGENTS.md) باید در تغییرات عملیاتی/معماری خوانده شوند.

## Administrator bootstrap

هیچ credential ادمین production داخل سورس وجود ندارد. bootstrap فقط وقتی فعال است که هر دو متغیر زیر صریحاً مقدار داشته باشند:

~~~dotenv
BOOTSTRAP_ADMIN_PHONE=
BOOTSTRAP_ADMIN_PASSWORD=
~~~

بعد از provisioning اولیه، مقادیر bootstrap را حذف کنید.

## کیفیت و CI

قبل از PR:

~~~bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
~~~

Pipeline فعلی علاوه بر موارد بالا، API e2e، SSR/SEO smoke tests، route semantics، production images، nginx/TLS bootstrap و post-deploy /healthz را نیز بررسی می‌کند.

## امنیت

credential، private key، production .env، session token و PII دانشجو نباید وارد commit، fixture، issue یا log شوند. برای گزارش آسیب‌پذیری از [SECURITY.md](SECURITY.md) استفاده کنید.

## License

کد و مستندات اصلی پروژه تحت MIT هستند، مگر اینکه در فایل/دایرکتوری خاص خلاف آن ذکر شده باشد. assetها و منابع third-party خودکار تحت MIT قرار نمی‌گیرند؛ [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) را ببینید.
