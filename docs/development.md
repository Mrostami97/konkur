# راهنمای توسعه

## پیش‌نیازها

- Node.js >= 20
- Corepack
- pnpm 9.12.0
- Docker Engine
- Docker Compose plugin
- Git

نسخهٔ pnpm در root package.json pin شده است. از package manager دیگر برای تغییر lockfile استفاده نکنید.

## Clone و نصب

~~~bash
git clone https://github.com/Mrostami97/konkur.git
cd konkur
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
~~~

## دو روش اجرا

### Full stack با Docker

مسیر نزدیک‌تر به production:

~~~bash
docker compose up -d --build
docker compose ps
~~~

Compose شامل postgres، redis، minio، api، web، certs-init، nginx و certbot است.

### Workspace development

وقتی dependencyها در دسترس‌اند:

~~~bash
pnpm dev:api
pnpm dev:web
~~~

API پیش‌فرض 3001 و Web پیش‌فرض 3000 است.

## Environment variables

### Root / Compose

| Variable | کاربرد | Default/example |
|---|---|---|
| POSTGRES_PASSWORD | رمز PostgreSQL | باید production تغییر کند |
| MINIO_ROOT_PASSWORD | secret object storage | باید production تغییر کند |
| WEB_DOMAIN | دامنهٔ web | localhost |
| API_DOMAIN | دامنهٔ API | api.localhost |
| TLS_MODE | حالت TLS | auto |
| ACME_EMAIL | ایمیل ACME | خالی |
| ACME_STAGING | staging CA | 0 |
| SESSION_TTL_HOURS | عمر session | 720 |
| OTP_TTL_MINUTES | عمر OTP | 5 |
| OTP_MAX_ATTEMPTS | سقف تلاش OTP | 5 |
| GOOGLE_SITE_VERIFICATION | SEO verification | optional |
| BING_SITE_VERIFICATION | SEO verification | optional |
| BOOTSTRAP_ADMIN_PHONE | bootstrap opt-in | خالی |
| BOOTSTRAP_ADMIN_PASSWORD | bootstrap opt-in | خالی |

### API direct development

apps/api/.env.example شامل:
- DATABASE_URL
- PORT
- FRONTEND_URL
- session/OTP variables
- S3_ENDPOINT / S3_PORT / S3_USE_SSL
- S3_ACCESS_KEY / S3_SECRET_KEY / S3_BUCKET
- bootstrap variables

هیچ مقدار example را production secret تلقی نکنید.

## Root commands

~~~bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test

pnpm migrate:dev
pnpm migrate:deploy
pnpm migrate:down
pnpm migrate:reset

pnpm seed

pnpm dev:api
pnpm dev:web

pnpm indexnow:submit
~~~

## API commands

از apps/api یا با filter:

~~~bash
pnpm --filter api run build
pnpm --filter api run test
pnpm --filter api run test:e2e
pnpm --filter api run seed
pnpm --filter api run migration:verify:phase16
~~~

## Web commands

~~~bash
pnpm --filter web run build
pnpm --filter web run test
pnpm --filter web run test:seo
pnpm --filter web run test:phase11:ssr
pnpm --filter web run test:phase12:ssr
pnpm --filter web run test:phase13:ssr
pnpm --filter web run test:phase18:routing
~~~

## Administrator bootstrap

production admin فقط وقتی ساخته/به‌روزرسانی می‌شود که هر دو variable زیر explicit باشند:

~~~dotenv
BOOTSTRAP_ADMIN_PHONE=...
BOOTSTRAP_ADMIN_PASSWORD=...
~~~

این مقادیر را در repository، issue، screenshot یا log قرار ندهید. بعد از bootstrap از environment حذف/rotate شوند.

## Seed safety

E2E/seed دادهٔ deterministic تستی دارد، ولی production bootstrap از آن جدا شده است. هرگز test seed را روی database دارای دادهٔ واقعی اجرا نکنید.

قبل از command destructive:
- DATABASE_URL را چاپ/بررسی کنید، نه password را.
- backup داشته باشید.
- environment را صریح مشخص کنید.

## Migration workflow

تغییر model:
1. schema.prisma
2. migration dev
3. SQL review
4. Prisma generate/build
5. unit/e2e
6. rollback story
7. production migrate deploy

برای migration حساس از ops/runbook.md پیروی کنید.

## ساخت feature جدید

پیشنهاد ترتیب کار:

1. owner domain را از domain-model.md تعیین کنید.
2. contract/API behavior را تعریف کنید.
3. persistence migration را اگر لازم است اضافه کنید.
4. service business logic.
5. controller/DTO/guard.
6. frontend flow.
7. unit/e2e/SSR tests.
8. docs.
9. migration/deploy/rollback impact.

## Logging و debug

ابتدا:

~~~bash
docker compose ps
docker compose logs --tail=200 api
docker compose logs --tail=200 web
docker compose logs --tail=200 nginx
~~~

health:

~~~bash
curl -k https://api.localhost/health
curl -k https://api.localhost/healthz
~~~

برای production certificate معتبر، -k نباید workflow عادی باشد؛ فقط local/self-signed debug.

## اصول تغییر کد

- schema و tests را source of truth نزدیک کد نگه دارید.
- logic دسترسی را در frontend duplicate نکنید.
- service دامنهٔ دیگر را دور نزنید و مستقیم table آن را mutate نکنید.
- AI/OCR runtime dependency اضافه نکنید مگر تصمیم معماری رسمی تغییر کند.
- external tool نباید DB credential برای write canonical بگیرد.
- feature بدون acceptance test و rollback story کامل نیست.

## فایل‌هایی که قبل از تغییر بزرگ باید خوانده شوند

- AGENTS.md
- docs/architecture.md
- docs/domain-model.md
- docs/current-state-roadmap.md
- ops/runbook.md
- SECURITY.md
