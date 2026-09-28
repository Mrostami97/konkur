# تست، Quality Gates و CI/CD

## فلسفه

پروژه فقط به build سبز متکی نیست. لایه‌های تست برای contract، domain/API، migration، corpus محتوا، SSR/SEO، route semantics و production runtime وجود دارد.

هر feature باید نزدیک‌ترین test مناسب را داشته باشد؛ E2E جای unit و unit جای contract test را نمی‌گیرد.

## Root gates

~~~bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
~~~

این commandها recursively workspace scripts را اجرا می‌کنند.

## Contracts

contracts دارای:
- schemas
- fixtures valid/invalid
- validator/type code
- Jest tests

هر schema version جدید باید هم fixture مثبت و هم fixture منفی داشته باشد.

## API

apps/api:
- Jest unit tests
- Jest E2E
- migration verification helper
- Prisma schema/migration checks از طریق CI

نکتهٔ مهم: E2E فعلی از DATABASE_URL تنظیم‌شده استفاده می‌کند و serial اجرا می‌شود. آن را روی database واقعی/production اجرا نکنید.

## Web

Web test suite شامل corpus gateهای چند فاز و checkهای مخصوص SEO/SSR/routing است.

Commandهای مهم:
- test
- test:phase17
- test:seo
- test:phase11:ssr
- test:phase12:ssr
- test:phase13:ssr
- test:phase18:routing

این testها فقط UI component test نیستند؛ بخشی از integrity محتوای checked-in را نیز enforce می‌کنند.

## GitHub Actions

workflow اصلی .github/workflows/ci.yml یک job به نام build-test-deploy دارد. ترتیب stepهای فعلی:

1. Install dependencies
2. Generate Prisma Client and build workspaces
3. Lint and typecheck
4. Tests (contracts, migrations and API unit)
5. Start pinned MinIO for S3 integration tests
6. API e2e tests
7. Public SSR and SEO smoke tests
8. Dynamic route HTTP semantics
9. Build production images
10. Validate production image runtimes and size
11. Validate nginx TLS gateway bootstrap
12. Publish production images to GHCR
13. Deploy to server, then wait for /healthz

بنابراین سبز بودن unit tests به‌تنهایی معادل deployable بودن نیست.

## MinIO در CI

CI یک MinIO واقعی برای integration path بالا می‌آورد تا ingestion/media tests به mock صرف وابسته نباشند. Object storage یک dependency واقعی healthz است.

## Production image checks

CI imageهای API/Web را build می‌کند و runtime/size را بررسی می‌کند. این gate برای catch کردن مشکلات multi-stage Docker، pnpm/Corepack، Prisma/OpenSSL و missing runtime files مهم است.

## NGINX/TLS gate

gateway bootstrap نیز validate می‌شود. تغییر nginx template، cert scripts یا compose باید این gate را سبز نگه دارد.

## Post-deploy check

آخر workflow deploy، /healthz را منتظر می‌ماند. healthz فقط process check نیست و database/object storage را واقعاً probe می‌کند.

اگر deploy شد ولی healthz degraded بود، انتشار موفق فرض نشود.

## چه چیزی را کجا تست کنیم؟

| تغییر | تست حداقلی |
|---|---|
| pure service rule | unit |
| controller/auth/RBAC | e2e |
| schema contract | fixture + contract test |
| migration | migration verification + e2e |
| ingestion/media | e2e با MinIO |
| public content route | SSR/HTTP semantics |
| metadata/sitemap/SEO | SEO smoke |
| editorial corpus | corpus test |
| Docker/runtime | image validation |
| nginx/TLS | gateway bootstrap |
| deploy | /healthz |

## تست دسترسی

برای هر protected feature حداقل این حالت‌ها مهم‌اند:
- anonymous
- authenticated without entitlement
- entitled
- revoked/expired entitlement
- wrong role
- correct role

UI hidden state کافی نیست؛ API باید denial را تست کند.

## تست محاسبات

Mastery/rank/score چون تصمیم‌سازند باید:
- version ثابت داشته باشند.
- fixture deterministic داشته باشند.
- edge cases sparse/empty data را پوشش دهند.
- backtest/calibration در analytics حفظ شود.

## قبل از PR

~~~bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
~~~

اگر feature مربوط به API DB است، E2E را روی database disposable اجرا کنید.

## شکست CI

ترتیب triage:
1. اولین step شکست‌خورده را بخوانید.
2. همان command را local بازتولید کنید.
3. اگر Docker/runtime است، فقط unit test را تکرار نکنید؛ image را اجرا کنید.
4. اگر SSR است، API/internal networking و seed data را بررسی کنید.
5. اگر migration است، schema drift و DATABASE_URL را بررسی کنید.
6. برای deploy failure سراغ ops/runbook.md و healthz بروید.
