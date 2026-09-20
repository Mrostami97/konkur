# مستندات فنی کدبیس — کنکورصفرویک (kunkur01)

> این سند یک عکس لحظه‌ای (snapshot) از وضعیت واقعی کد در تاریخ **۲۰۲۶-۰۹-۲۰** است.
> هدف آن پاسخ به این سؤال است: «هر بخش از کد امروز واقعاً چه می‌کند و چقدر کامل است؟»
> — برخلاف اسناد زیر `docs/roadmap/` که جهت‌گیری آینده را توصیف می‌کنند.
> با تغییر معنادار کد، این سند باید به‌روزرسانی شود.
>
> منبع اولویت فعلی مالک پروژه: [`CLAUDE.md`](../CLAUDE.md) (ریشه مخزن) — اولویت
> جاری «تکمیل محصول» (Product Completion) است، پیش از کار روی Knowledge Graph.

## فهرست مطالب

1. [مقدمه و معماری کلی](#۱-مقدمه-و-معماری-کلی)
2. [بک‌اند — `apps/api`](#۲-بکاند--appsapi)
3. [مدل داده — Prisma Schema](#۳-مدل-داده--prisma-schema)
4. [فرانت‌اند — `apps/web`](#۴-فرانتاند--appsweb)
5. [پکیج مشترک — `contracts`](#۵-پکیج-مشترک--contracts)
6. [زیرساخت و DevOps](#۶-زیرساخت-و-devops)
7. [اسکریپت‌های خودکار — `scripts/`](#۷-اسکریپتهای-خودکار--scripts)
8. [تست و پوشش](#۸-تست-و-پوشش)
9. [نقشه اسناد موجود پروژه](#۹-نقشه-اسناد-موجود-پروژه)
10. [جمع‌بندی وضعیت فعلی در برابر اولویت Product Completion](#۱۰-جمعبندی-وضعیت-فعلی-در-برابر-اولویت-product-completion)

---

## ۱. مقدمه و معماری کلی

مخزن یک **مونوریپو pnpm** است (`pnpm-workspace.yaml`: `apps/*` و `contracts`؛
بدون Turborepo — orchestration با اسکریپت‌های `pnpm -r` ساده در `package.json`
ریشه انجام می‌شود). چهار جزء اصلی:

```
apps/api/      NestJS + Prisma — بک‌اند
apps/web/      Next.js 14 (App Router) — فرانت‌اند
contracts/     @konkurcom/contracts — اسکیمای مشترک (Ajv)
ops/           nginx، TLS، backup/restore، runbook عملیاتی
scripts/       اتوماسیون seed و IndexNow
docs/          مستندات (roadmap/content/data + این فایل)
```

**استک فناوری:** Node.js 20+، pnpm 9.12، TypeScript در همه‌جا، PostgreSQL 16،
Redis 7 (در compose تعریف شده)، MinIO (S3-compatible) برای فایل، Docker Compose
به‌عنوان تنها استک (dev و prod یکی است — طبق `AGENTS.md` این دو عمداً ادغام
شده‌اند).

**جریان کلی درخواست:** مرورگر → nginx (TLS termination) → `web` (Next.js, پورت
داخلی) برای صفحات، یا مستقیماً → `api` (NestJS) برای فراخوانی‌های AJAX از
کلاینت. صفحات SSR از طریق شبکه داخلی Docker به API متصل می‌شوند
(`INTERNAL_API_URL`)، نه از طریق nginx عمومی.

---

## ۲. بک‌اند — `apps/api`

ساختار: `apps/api/src/modules/` شامل **۱۳ ماژول NestJS** (تأیید شده با شمارش
مستقیم پوشه‌ها):

```
admissions  analytics  assessment  audit  commerce  content
crm         identity   ingestion   learning  planning
question-bank  taxonomy
```

الگوی رایج هر ماژول: یک `*.controller.ts` (یا چند controller برای ماژول‌های
بزرگ‌تر)، یک `*.service.ts`، و پوشه `dto/` با کلاس‌های `class-validator`. جمعاً
۳۸ فایل DTO در کل بک‌اند.

### شرح ماژول به ماژول

| ماژول | مسئولیت | نکات وضعیت |
|---|---|---|
| **identity** | ثبت‌نام/ورود با OTP یا رمز، مدیریت نشست (session)، پروفایل، نقش‌ها | `otp-provider.ts` → `ConsoleOtpProvider` فقط کد را لاگ می‌کند؛ **هیچ درگاه پیامکی واقعی وصل نیست** |
| **taxonomy** | کاتالوگ Subject/Topic | CRUD ساده، به نظر کامل |
| **content** | مقالات با گردش‌کار نسخه‌بندی/بازبینی/تأیید (`content.controller.ts`)، تحریریه کامل با منابع/نویسندگان (`editorial.controller.ts`)، کشف عمومی محتوا (`content-discovery.controller.ts`) | سه controller — پیچیده‌ترین ماژول از نظر گردش‌کار |
| **ingestion** | پایپلاین وارد کردن داده‌های خارجی: Receive → Schema → Staging → Normalize → Assets → Dedup → QA → Review → Publish | **تنها نویسنده واقعی** جداول `Article`/`Question`/`ReportCard`؛ شامل `object-storage.service.ts` (MinIO) |
| **question-bank** | CRUD و نسخه‌بندی سؤالات | خواندن/نوشتن پایه؛ نرمال‌سازی کامل Option/Tag به فاز آینده موکول شده (طبق کامنت schema) |
| **assessment** | آزمون‌ها، شروع/ثبت پاسخ/ارسال Attempt، گزارش، آمار روان‌سنجی برای ادمین | endpoint های عمومی و ادمین هر دو موجودند |
| **learning** | دوره/ماژول/درس، ثبت‌نام، پیشرفت | endpoint های ادمین برای ساخت/انتشار دوره موجود است |
| **commerce** | محصول/قیمت/سفارش/پرداخت/دسترسی (Entitlement) | `payment-provider.ts` یک اینترفیس است؛ **هیچ درگاه پرداخت واقعی پیاده‌سازی نشده** («manual-sandbox» طبق کامنت schema) |
| **planning** | هدف → برنامه → تسک، بازبرنامه‌ریزی، جلسات مطالعه، Mastery | `MasteryState` قاعده‌محور است، نه یادگیری ماشین |
| **admissions** | دانشگاه/رشته/ظرفیت، لیست انتخاب رشته | — |
| **analytics** | تخمین رتبه (kNN) و backtest | — |
| **crm** | Lead/Case/Interaction/Campaign، مصرف‌کننده Outbox | تنها مصرف‌کننده واقعی الگوی transactional-outbox در کل کد |
| **audit** | فقط سرویس، بدون controller — ثبت `AuditLog` که ماژول‌های دیگر صدا می‌زنند | — |

### احراز هویت و مجوز

مکانیزم **session-cookie**، نه JWT خام: کوکی `session` یک توکن تصادفی نگه
می‌دارد که هش آن در `Session.tokenHash` ذخیره است.

- `SessionAuthGuard` (`apps/api/src/modules/identity/guards/session-auth.guard.ts`)
  — با `IdentityService.validateSession` نشست را تأیید می‌کند.
- `OptionalSessionAuthGuard` — برای endpoint هایی که کاربر مهمان هم مجازند.
- `RolesGuard` + دکوراتور `@Roles()` (`roles.guard.ts`, `roles.decorator.ts`) —
  RBAC بر پایه enum `Role` (`STUDENT | MENTOR | AUTHOR | REVIEWER | ADMIN | FINANCE`)؛
  یک کاربر می‌تواند چند نقش داشته باشد (جدول join `UserRole`).

ورود هم با OTP (شماره تلفن) و هم با رمز عبور پشتیبانی می‌شود. `@nestjs/throttler`
در وابستگی‌ها هست (احتمالاً برای محدودسازی نرخ OTP).

### پس‌زمینه و صف

**بدون** سیستم صف واقعی (بدون BullMQ/Bull). تنها مکانیزم async: در
`crm.service.ts` یک `@Interval(5000)` جدول `OutboxEvent` را poll می‌کند (الگوی
transactional outbox) — مثلاً رویداد `UserOnboarded` باعث ساخت `Lead` در CRM
می‌شود.

### یکپارچگی‌های بیرونی

| سرویس | وضعیت |
|---|---|
| MinIO/S3 | واقعی و متصل (`object-storage.service.ts`) |
| پیامک/OTP | **موکاپ** — فقط لاگ کنسول |
| درگاه پرداخت | **موکاپ** — فقط اینترفیس، بدون گیت‌وی واقعی |
| ایمیل | یافت نشد |
| Import ZIP | `adm-zip` برای آرشیوهای دسته‌ای در ingestion |

### متغیرهای محیطی کلیدی (`apps/api/.env.example`)

`DATABASE_URL`, `PORT`, `FRONTEND_URL`, `SESSION_TTL_HOURS`, `OTP_TTL_MINUTES`,
`OTP_MAX_ATTEMPTS`, `S3_ENDPOINT`, `S3_PORT`, `S3_USE_SSL`, `S3_ACCESS_KEY`,
`S3_SECRET_KEY`, `S3_BUCKET`, `BOOTSTRAP_ADMIN_PHONE`, `BOOTSTRAP_ADMIN_PASSWORD`.

---

## ۳. مدل داده — Prisma Schema

مسیر: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma) —
**۱۳۶۹ خط**، PostgreSQL، با کامنت‌های راهنما و نشانه‌گذاری فاز برای هر بخش. تاریخچه
migration: **۱۴ migration** فازبندی‌شده در `apps/api/prisma/migrations/`.

گروه‌های مدل اصلی (بدون paste کامل schema):

- **هویت** — `User` ↔ `UserRole` (enum `Role`)، `Session`، `OtpCode`، `Consent`،
  `Profile`، `AuditLog`.
- **محتوا** — `Article` (نسخه‌بندی‌شده، provenance، گردش‌کار `ReviewStatus`)،
  `ContributorProfile`، `ContentSource` (متادیتای حق/مجوز) با جدول‌های واسط
  `ArticleSource`/`ResourceSource`، `Resource`، `SourceArtifact` (چک‌سام فایل).
- **یادگیری/تجارت** — `Course` → `CourseModule` → `Lesson`؛ `Enrollment`،
  `LessonProgress`؛ `Product` (`COURSE | RESOURCE | BUNDLE`) با
  `ProductCourseGrant`/`ProductResourceGrant`، `Price`، `Order` → `OrderItem`،
  `Payment`، **`Entitlement`** («تنها منبع حقیقت برای دسترسی» طبق کامنت schema).
- **سؤال/آزمون** — `Question` (داده خام ingest شده)، `ReportCard`؛ `Exam` →
  `ExamForm` → `ExamItem`، `Attempt` → `Answer`/`Score`.
- **Ingestion** — `ImportJob` → `ImportItem` (ماشین‌حالت پایپلاین)،
  `ContentVersion` (تاریخچه نسخه عمومی و rollback-safe برای Article/Question/
  ReportCard/Resource).
- **Taxonomy** — `Subject`/`Topic` با جدول‌های پیش‌نیاز خودارجاع
  (`SubjectPrerequisite`, `TopicPrerequisite`)، `LessonTopic`.
- **برنامه‌ریزی** — `Goal` → `Plan` → `Task`، `PlanRevision`، `StudySession`،
  `SavedResource`، `MasteryState` (قاعده‌محور).
- **Outbox** — `OutboxEvent` (الگوی transactional outbox؛ مصرف‌کننده در CRM).
- **پذیرش** — `University` → `Program` → `Capacity`، `ChoiceList` →
  `ChoiceListItem`.
- **تحلیل** — `RankEstimate`، `BacktestReport` (تخمین‌گر kNN با backtest).
- **CRM** — `Lead` (قیف `LeadStage`) → `Case`/`Interaction`، `Campaign` (ردیابی
  لینک عمیق تلگرام).

---

## ۴. فرانت‌اند — `apps/web`

**Next.js 14.2، App Router**، بدون `pages/`. بدون route group مثل
`(public)`/`(admin)` — مسیرها flat هستند و پنل ادمین زیر `/admin/*` تودرتو است.
**هیچ `middleware.ts`** در کل مخزن وجود ندارد (تأیید شده) — یعنی حفاظت مسیر تنها
سمت کلاینت انجام می‌شود.

### دسته‌بندی مسیرها

**عمومی/محتوایی (Server Component، SSR کامل):** `about`, `admissions`,
`articles` (+`[slug]`), `authors` (+`[slug]`), `corrections`, `courses`
(+`[slug]`), `editorial-policy`, `evidence`, `exams`, `guides` (+`[slug]`),
`programs` (+`[code]`), `report-cards`, `resources` (+`[slug]`), `search`,
`source-policy`, `subjects` (+`[slug]`), `topics` (+`[slug]`), `universities`
(+`[code]`). این‌ها از `generateStaticParams`/`generateMetadata` استفاده
می‌کنند و داده را با `apiGetPublic` (فقط سمت سرور، مستقیم به `INTERNAL_API_URL`)
می‌گیرند.

**حساب‌کاربری/آزمون (Client Component، احراز هویت لازم):** `account`, `today`,
`choices`, `lessons/[id]`, `questions`, `questions/[id]`, `attempts/[id]`,
`attempts/[id]/report`, `rank-estimate`, `login`. این‌ها با `apiFetch` (سمت
مرورگر، `credentials: "include"`) در `useEffect` داده می‌گیرند.

**پنل ادمین (Client Component، ۱۷ صفحه — تأیید شده با شمارش):**
`admin` (index), `admissions`, `analytics`, `articles` (+`[id]`,
`[id]/preview`), `commerce`, `content-sources`, `contributors`, `courses`,
`crm` (+`leads`, `leads/[id]`), `exams`, `import` (+`[jobId]`), `questions`,
`resources`, `taxonomy`. همگی از نظر عملکردی به API واقعی وصل‌اند (نه موکاپ) اما
استایل حداقلی دارند — `style={}` درون‌خطی به‌جای کامپوننت مشترک.

**مسیرهای SEO/زیرساخت (Route Handler، نه صفحه):** `robots.ts`،
`sitemap.xml/route.ts` + هشت زیر-sitemap در `sitemaps/*.xml`،
`rss.xml/route.ts`، `llms.txt/route.ts`.

### لایه API client

فایل واحد [`apps/web/src/lib/api.ts`](../apps/web/src/lib/api.ts):

- `apiGetPublic<T>(path)` — فقط سرور، `INTERNAL_API_URL`، `cache: "no-store"`،
  ۴۰۴ → `null`.
- `apiFetch<T>(path, {method, body})` — مرورگر، `API_URL`، کوکی‌محور
  (`credentials: "include"`)، خطا با `ApiError`.
- `apiUpload<T>` — آپلود چندبخشی.

نکته: پکیج `@konkurcom/contracts` در فرانت‌اند **استفاده نمی‌شود** — فقط توسط
بک‌اند برای پایپلاین ingestion به کار می‌رود.

### احراز هویت سمت کلاینت

بدون JWT سمت کلاینت، بدون middleware. `AdminGuard`
(`apps/web/src/components/AdminGuard.tsx`) با فراخوانی `/auth/me` نقش کاربر را
در برابر `STAFF_ROLES` چک می‌کند و در صورت ۴۰۱ به `/login` هدایت می‌کند —
کامنت خود فایل صریح می‌گوید: «این فقط جلوی نمایش فرم به دانشجو را می‌گیرد؛
اجرای واقعی مجوز روی گاردهای API است.» یعنی **لایه امنیتی واقعی همیشه سمت
بک‌اند است**، نه فرانت‌اند.

### SEO و RTL

مرکزی در [`apps/web/src/lib/seo.ts`](../apps/web/src/lib/seo.ts):
`pageMetadata()` کانونیکال/OpenGraph/Twitter/robots می‌سازد؛ `layout.tsx`
JSON-LD سازمانی را تزریق می‌کند؛ `robots.ts` حتی allowlist مخصوص خزنده‌های AI
(GPTBot، ClaudeBot، PerplexityBot) دارد. زبان تنها فارسی است، بدون i18n
library — RTL با `<html lang="fa" dir="rtl">` تنظیم می‌شود.
[`apps/web/src/lib/format.ts`](../apps/web/src/lib/format.ts) اعداد فارسی را
تبدیل می‌کند.

### استایل

بدون Tailwind، بدون CSS Modules. یک `globals.css` واحد (۷۳۸ خط) با کلاس‌های
معنایی سفارشی. کیت UI مشترک کوچک در
[`apps/web/src/components/ui.tsx`](../apps/web/src/components/ui.tsx)
(`PageHeader`, `SectionHeader`, `StatCard`, `ProgressBar`, `EmptyState`).

---

## ۵. پکیج مشترک — `contracts`

`@konkurcom/contracts` — پکیجی مبتنی بر **Ajv 2020** برای اعتبارسنجی JSON
Schema نسخه‌دار:

- `contracts/src/types.ts` — انواع TS: `ArticleV1`, `ArticleV2`, `ReportCardV1`,
  `QuestionV1`/`QuestionOption`.
- `contracts/src/validators.ts` — `validateArticle`, `validateArticleV2`,
  `validateReportCard`, `validateQuestion` + قاعده کسب‌وکاری دستی
  `checkQuestionOptionIntegrity` (شماره گزینه‌ها باید دقیقاً {۱،۲،۳،۴} باشد، هرکدام
  یک‌بار).
- `contracts/schemas/*.schema.json` — چهار اسکیمای نسخه‌دار.
- `contracts/fixtures/{valid,invalid}/` — نمونه‌های تست.

**تنها مصرف‌کننده:** بک‌اند، در پایپلاین ingestion — طبق `AGENTS.md` این تنها
مسیری است که داده JSON/ZIP خارجی می‌تواند وارد جداول اصلی شود (Staging →
Validate → Review → Publish). فرانت‌اند این پکیج را import نمی‌کند.

---

## ۶. زیرساخت و DevOps

### `docker-compose.yml`

**یک استک واحد** برای dev و prod (عمداً یکی‌سازی شده — طبق لاگ پاکسازی
زیرساخت در `AGENTS.md`): `postgres:16`، `redis:7`، `minio` (digest ثابت، نه
`latest`)، `api`، `web`، `certs-init` (bootstrap یک‌باره TLS)، `nginx:1.27`
(ترمیناسیون TLS + config قالب‌بندی‌شده)، `certbot` (حلقه تمدید).

### `ops/`

| فایل | نقش |
|---|---|
| `ops/backup.sh` | `pg_dump` به `ops/backups/*.sql.gz` |
| `ops/restore.sh <file>` | بازیابی تعاملی با تأیید |
| `ops/certs-init.sh` | گواهی self-signed یک‌باره اگر گواهی معتبری در volume نیست |
| `ops/nginx/certbot-renew.sh` | حلقه تمدید Let's Encrypt (`certonly --webroot`) |
| `ops/nginx/watch-certs.sh` | reload خودکار nginx با تغییر گواهی |
| `ops/runbook.md` | رانبوک کامل عملیاتی: migration بالا/پایین، backup/restore، rollback، چرخه TLS، ثبت در موتور جست‌وجو، دیپلوی CD/SSH |

### CI/CD — `.github/workflows/ci.yml`

یک job با سرویس Postgres 16، مراحل اصلی:

1. Checkout، نصب pnpm/node، `pnpm install --frozen-lockfile`.
2. `prisma generate` + build کل workspace (contracts اول، طبق توپولوژی).
3. Lint + typecheck.
4. تست contracts و web، سپس **drill معکوس‌پذیری migration** (down/up چند مرحله
   با اسکریپت اعتبارسنجی).
5. راه‌اندازی MinIO پین‌شده برای تست‌های e2e وابسته به S3.
6. تست‌های e2e بک‌اند (Jest, `--runInBand`).
7. Smoke test عمومی SSR/SEO (بوت API + `next start` واقعی، `test:seo`،
   `indexnow:submit --dry-run`).
8. تست رفتار HTTP مسیرهای پویا (`test:phase18:routing`).
9. **فقط در push به `main`:** build ایمیج prod، اعتبارسنجی حجم (<900MiB هرکدام،
   <1400MiB مجموع) و مسیر bootstrap TLS، push به GHCR، دیپلوی SSH خودکار (شامل
   self-provisioning ابزار روی سرور، انتظار برای `/healthz` و بررسی HTTPS/ریدایرکت
   کانونیکال). اگر `SSH_HOST` تنظیم نباشد، دیپلوی بی‌خطر رد می‌شود.

---

## ۷. اسکریپت‌های خودکار — `scripts/`

| اسکریپت | نقش |
|---|---|
| `scripts/generate-editorial-drafts.mjs` | تبدیل محتوای ویرایشی به `apps/api/src/seed-data/editorial-drafts.json` |
| `scripts/generate-resource-drafts.mjs` | اعتبارسنجی/تبدیل کورپوس منابع (آرشیو تلگرام) با قواعد سخت‌گیرانه حق نشر |
| `scripts/submit-indexnow.mjs` | ثبت URL های sitemap در IndexNow (پشتیبانی `--dry-run`) |

---

## ۸. تست و پوشش

**بک‌اند** (`apps/api/test/`, ۲۱ فایل): ۶ تست واحد
(`identity.service.spec.ts`, `ingestion-checksum.spec.ts`,
`phase15-public-data.spec.ts`, `planning-helpers.spec.ts`,
`roles.guard.spec.ts`, `seed-admin.spec.ts`) + ۱۵ تست e2e پوشش‌دهنده
analytics-admissions، assessment، auth، commerce-learning، crm، health،
ingestion، و چند فاز محتوا/پذیرش (نام‌گذاری بر اساس شماره فاز ساخت پروژه).

**فرانت‌اند** (`apps/web/test/`, ۱۱ اسکریپت `.mjs`): بدون Playwright/Cypress —
اسکریپت‌های سفارشی Node برای بررسی کورپوس/SSR/مسیریابی
(`phase10-seo.mjs` تا `phase18-routing.mjs`).

**contracts** (`contracts/test/validators.spec.ts`): تست Jest برای اسکیماهای
Ajv.

---

## ۹. نقشه اسناد موجود پروژه

### `docs/roadmap/` — آینده‌نگر

| فایل | موضوع |
|---|---|
| `PRODUCT_COMPLETION_AND_KNOWLEDGE_GRAPH.md` | روادمپ اصلی: فاز ۱۸A (تکمیل محصول، جاری) تا فاز ۲۳ (یادگیری تطبیقی) |
| `STUDENT_NEED_INTELLIGENCE_CONTENT_ENGINE.md` | چرخه کشف نیاز دانشجو → محتوا؛ runtime همیشه بدون AI |
| `LEARNING_GROWTH_ACCESS_AND_AEO.md` | مدل دسترسی به بانک سؤال، رشد یادگیری، AEO |

### `docs/content/` — سیاست و برنامه محتوا

| فایل | موضوع |
|---|---|
| `competitor-snapshot.md` | رصد رقبا (فقط برای شناخت نیاز، نه کپی) |
| `editorial-policy.md` | سیاست منبع/بازبینی/اصلاح |
| `editorial-style-guide.md` | راهنمای لحن فارسی |
| `KNOWLEDGE_GRAPH_CONTENT_STRATEGY.md` | جهت‌گیری راهبردی محتوا به‌عنوان گراف |
| `masters-launch-briefs.md` | بریف‌های صفحات راه‌اندازی ارشد |
| `product-opportunity-matrix.md` | ماتریس اولویت فرصت محتوایی |

### `docs/data/` — envanتری داده موجود

| فایل | موضوع |
|---|---|
| `EXAM_INTELLIGENCE_EXISTING_ASSETS.md` | دیتاست نتایج/کارنامه کنکور موجود خارج از مخزن که باید یکپارچه شود، نه بازطراحی |

### در ریشه مخزن

`AGENTS.md` (خلاصه عملیاتی برگرفته از سند معماری بیرونی، وضعیت فاز به فاز)،
`TODO.md` (چک‌لیست اجرایی فارسی هم‌راستا با `AGENTS.md`)، `CLAUDE.md` (اولویت
جاری مالک — منبع مرجع این سند).

---

## ۱۰. جمع‌بندی وضعیت فعلی در برابر اولویت Product Completion

طبق [`CLAUDE.md`](../CLAUDE.md)، اولویت جاری «تبدیل کدبیس موجود به یک محصول
آموزشی صیقل‌خورده و قابل‌استفاده» است، پیش از کار روی Knowledge Graph. بر اساس
بررسی کد (نه فقط checkmark فازها)، موارد زیر باید در نظر گرفته شوند:

- **درگاه پرداخت واقعی وصل نیست** (`apps/api/src/modules/commerce/payment-provider.ts`)
  — تجاری‌سازی (`Course purchase`, `Entitlement grant`) از نظر داده کامل است اما
  بدون گیت‌وی واقعی پرداخت نمی‌تواند عملیاتی شود.
- **پیامک/OTP واقعی وصل نیست** (`apps/api/src/modules/identity/otp-provider.ts`)
  — ورود با شماره تلفن فعلاً فقط در کنسول لاگ می‌شود؛ بدون این، ورود واقعی
  کاربران غیرممکن است.
- **پنل ادمین از نظر عملکرد کامل ولی از نظر UI/UX حداقلی است** — همه ۱۷ صفحه
  ادمین به API واقعی وصل‌اند (نه موکاپ)، اما با `style={}` درون‌خطی و بدون
  کامپوننت مشترک — دقیقاً همان چیزی که بند ۲ اولویت‌های `CLAUDE.md`
  («یک پنل ادمین واقعی و قابل‌استفاده») به آن اشاره دارد.
- **حفاظت مسیر فرانت‌اند فقط کلاینتی است** — بدون `middleware.ts`؛
  `AdminGuard` صرفاً تجربه کاربری را بهبود می‌دهد، مجوز واقعی همیشه روی
  `SessionAuthGuard`/`RolesGuard` سمت API اجرا می‌شود. این خودش نقض امنیتی
  نیست (چون API مستقل enforce می‌کند) اما یعنی هر صفحه جدید کلاینتی باید از
  ابتدا فرض کند frontend gate قابل‌دور زدن است.
- **بدون صف واقعی** — تنها الگوی async، polling هر ۵ ثانیه روی `OutboxEvent` در
  CRM است؛ برای عملیات سنگین‌تر (مثل پردازش ingestion حجیم) ممکن است نیاز به
  صف واقعی در آینده مطرح شود (خارج از دامنه فعلی Product Completion).
- **تست‌های فرانت‌اند استاندارد نیستند** — بدون Playwright/Cypress، فقط
  اسکریپت‌های Node سفارشی برای SSR/سئو. برای رگرسیون UI تعاملی (فرم‌ها،
  جریان خرید، آزمون‌گیری) این سطح ممکن است ناکافی باشد.
- **بدون marker صریح TODO/FIXME در کد** — یعنی ناقص‌بودن‌ها را نمی‌توان با grep
  ساده پیدا کرد؛ تشخیص «route exists» در برابر «feature قابل‌استفاده» نیازمند
  بررسی دستی UX هر صفحه است (دقیقاً روش اجرایی که خود `CLAUDE.md` تجویز کرده).

این جمع‌بندی، فهرست کامل کار Product Completion نیست — فقط شکاف‌هایی است که از
خواندن کد (نه اسناد روادمپ) قابل استخراج بود. برای دامنه کامل به
`docs/roadmap/PRODUCT_COMPLETION_AND_KNOWLEDGE_GRAPH.md` مراجعه کنید.
