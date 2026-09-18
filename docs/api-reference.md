# مرجع API

این سند inventory endpointهای controllerهای فعلی NestJS است. جزئیات DTO و response shape را از فایل controller/service و DTO همان module بخوانید.

## قرارداد عمومی

- API پیش‌فرض روی PORT=3001 اجرا می‌شود.
- CORS فقط FRONTEND_URL را با credentials فعال می‌کند.
- body/query با ValidationPipe: whitelist=true، forbidNonWhitelisted=true، transform=true.
- authentication مبتنی بر cookie به نام session است.
- rate limit عمومی: 60 درخواست در 60 ثانیه برای هر IP؛ endpointهای auth محدودترند.
- مسیرهای admin معمولاً SessionAuthGuard + RolesGuard دارند.

### Roleها

STUDENT، MENTOR، AUTHOR، REVIEWER، ADMIN، FINANCE.

## Health

| Method | Path | Auth | توضیح |
|---|---|---|---|
| GET | /health | Public | process check |
| GET | /healthz | Public | PostgreSQL + object storage deep health، latency/version/uptime |

## Identity و Profile

| Method | Path | Auth/Role | توضیح |
|---|---|---|---|
| POST | /auth/otp/request | Public, 5/min | درخواست OTP |
| POST | /auth/otp/verify | Public, 10/min | verify + set session cookie |
| POST | /auth/password/login | Public, 10/min | login password + cookie |
| POST | /auth/logout | Public | revoke cookie session اگر موجود باشد |
| GET | /auth/me | Session | کاربر جاری |
| GET | /me/profile | Session | get/create profile |
| PATCH | /me/profile | Session | update profile |
| GET | /admin/users | ADMIN | فهرست کاربر/نقش |

## Public content/discovery

| Method | Path | Auth | توضیح |
|---|---|---|---|
| GET | /articles | Public | published articles |
| GET | /articles/:slug | Public | article detail |
| GET | /content/search | Public | جستجوی محتوای عمومی |
| GET | /contributors/:slug | Public | contributor منتشرشده |
| GET | /report-cards | Public | کارنامه‌های دارای شرایط انتشار |
| GET | /resources | Optional session | resource catalog با access-aware result |
| GET | /resources/:slug | Optional session | resource metadata/detail |
| GET | /resources/:slug/content | Optional session | محتوای محافظت‌شده/stream یا JSON |
| GET | /media/:checksum | Public | فقط artifact غیر-Resource؛ redirect presigned |

## Editorial Admin

### Article

- GET /admin/articles — AUTHOR/REVIEWER/ADMIN
- GET /admin/articles/:id — AUTHOR/REVIEWER/ADMIN
- POST /admin/articles — AUTHOR/ADMIN
- PATCH /admin/articles/:id — AUTHOR/ADMIN
- POST /admin/articles/:id/revise — AUTHOR/ADMIN
- PATCH /admin/articles/:id/versions/:version — AUTHOR/ADMIN
- GET /admin/articles/:id/preview — AUTHOR/REVIEWER/ADMIN؛ no-store/noindex
- POST /admin/articles/:id/submit — AUTHOR/ADMIN
- POST /admin/articles/:id/versions/:version/submit — AUTHOR/ADMIN
- POST /admin/articles/:id/approve — REVIEWER/ADMIN
- POST /admin/articles/:id/versions/:version/approve — REVIEWER/ADMIN
- POST /admin/articles/:id/reject — REVIEWER/ADMIN
- POST /admin/articles/:id/versions/:version/reject — REVIEWER/ADMIN

### Source / Contributor / Resource

- GET /admin/content-sources — AUTHOR/REVIEWER/ADMIN
- POST /admin/content-sources — ADMIN
- PATCH /admin/content-sources/:id — ADMIN
- POST /admin/content-sources/:id/archive — ADMIN
- GET /admin/contributors — AUTHOR/REVIEWER/ADMIN
- POST /admin/contributors — ADMIN
- PATCH /admin/contributors/:id — ADMIN
- GET /admin/resources — AUTHOR/REVIEWER/ADMIN
- GET /admin/resources/:id — AUTHOR/REVIEWER/ADMIN
- POST /admin/resources — AUTHOR/ADMIN
- PATCH /admin/resources/:id — AUTHOR/ADMIN
- POST /admin/resources/:id/revise — AUTHOR/ADMIN
- POST /admin/resources/:id/submit — AUTHOR/ADMIN
- POST /admin/resources/:id/approve — REVIEWER/ADMIN
- POST /admin/resources/:id/reject — REVIEWER/ADMIN

## Ingestion / Versioning

| Method | Path | Role | توضیح |
|---|---|---|---|
| POST | /admin/import | REVIEWER/ADMIN | multipart field file؛ ZIP تا 50MB |
| GET | /admin/import | REVIEWER/ADMIN | jobs |
| GET | /admin/import/:jobId | REVIEWER/ADMIN | job |
| GET | /admin/import/:jobId/items | REVIEWER/ADMIN | staged items |
| POST | /admin/import/items/review | REVIEWER/ADMIN | approve/reject |
| POST | /admin/import/:jobId/publish | REVIEWER/ADMIN | publish approved |
| POST | /admin/content/rollback | ADMIN | rollback به‌صورت revision جدید |
| GET | /admin/content/:entityType/:entityId/versions | AUTHOR/REVIEWER/ADMIN | version history |

## Taxonomy

Public:
- GET /subjects
- GET /topics?subjectCode=
- GET /subjects/:slug
- GET /topics/:slug

Admin AUTHOR/ADMIN:
- POST /admin/subjects
- POST /admin/topics

## Question Bank

Public:
- GET /questions
- GET /questions/:id

GET /questions فیلترهای فعلی: subjectCode، topicCode، examDegree=master|phd، examMajor، examYear، q، page، pageSize.

Admin:
- GET /admin/questions/:id/versions — AUTHOR/REVIEWER/ADMIN
- POST /admin/questions — AUTHOR/ADMIN

## Learning

Public:
- GET /courses
- GET /courses/:slug
- GET /lessons/:id — Optional session، access check داخل service

Session:
- GET /me/enrollments
- GET /me/learning-progress
- POST /lessons/:id/complete

AUTHOR/ADMIN:
- GET /admin/courses
- POST /admin/courses
- POST /admin/courses/:id/publish
- POST /admin/courses/:id/modules
- POST /admin/modules/:id/lessons

## Commerce

Public:
- GET /products
- GET /products/:slug

Session:
- POST /checkout
- GET /me/orders
- GET /me/entitlements
- GET /me/library

Admin/Finance:
- GET /admin/products — ADMIN/FINANCE
- GET /admin/orders — ADMIN/FINANCE
- POST /admin/products — ADMIN
- POST /admin/products/:id/prices — ADMIN
- POST /admin/products/:id/course-grants — ADMIN
- POST /admin/products/:id/resource-grants — ADMIN
- POST /admin/entitlements/grant — ADMIN
- POST /admin/entitlements/:id/revoke — ADMIN

## Assessment

Public:
- GET /exams
- GET /exams/:slug

Session:
- POST /exams/:examId/start
- GET /attempts/:id
- PUT /attempts/:id/answers/:questionId
- POST /attempts/:id/submit
- GET /attempts/:id/report

AUTHOR/ADMIN:
- GET /admin/exams
- POST /admin/exams
- POST /admin/exams/:id/items
- POST /admin/exams/:id/publish
- GET /admin/exams/:id/psychometrics

## Planning

تمام مسیرهای زیر Session لازم دارند:

- GET /me/goal
- PUT /me/goal
- POST /me/plan/replan
- GET /me/plan
- GET /me/plan/today
- GET /me/plan/revisions
- POST /me/plan/tasks/:taskId/complete
- GET /me/mastery
- POST /me/study-sessions
- GET /me/study-history
- GET /me/resources/saved
- POST /me/resources/saved
- DELETE /me/resources/saved
- POST /me/plan/resources/:slug

replan reasonCodeهای فعلی: FALLING_BEHIND، MANUAL_REQUEST، GOAL_CHANGED.

## Analytics

Session:
- POST /me/rank-estimates
- GET /me/rank-estimates
- GET /me/rank-estimates/latest
- GET /me/rank-estimates/programs/:programId/acceptance-chance

ADMIN:
- POST /admin/analytics/backtest
- GET /admin/analytics/backtests

## Admissions

Public:
- GET /universities
- GET /universities/:code
- GET /programs
- GET /programs/code/:code
- GET /programs/:id

ADMIN:
- POST /admin/universities
- POST /admin/programs
- POST /admin/programs/:id/capacities

Session choice list:
- GET /me/choices
- GET /me/choices/compare
- POST /me/choices
- POST /me/choices/reorder
- DELETE /me/choices/:programId

## CRM

Public:
- GET /r/:code — campaign attribution + 302 redirect

ADMIN/MENTOR:
- GET /admin/crm/leads
- GET /admin/crm/leads/:id
- POST /admin/crm/leads/:id/recompute
- POST /admin/crm/leads/:id/cases
- POST /admin/crm/cases/:id/resolve
- POST /admin/crm/leads/:id/interactions
- GET /admin/crm/campaigns
- POST /admin/crm/campaigns
- GET /admin/crm/report

## افزودن Endpoint جدید

قبل از merge:
1. DTO validation صریح باشد.
2. owner domain روشن باشد.
3. auth/role guard صریح باشد.
4. data exposure و PII review شود.
5. test مناسب اضافه شود.
6. این فایل به‌روز شود.
