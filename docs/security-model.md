# مدل امنیت

این سند architecture-level security را ثبت می‌کند. برای vulnerability disclosure از ../SECURITY.md پیروی کنید.

## Authentication

دو مسیر login فعلی:
- OTP
- password

این دو مستقل‌اند تا user passwordless مجبور به password migration نشود.

### Session

پس از login موفق، cookie با نام session تنظیم می‌شود:
- HttpOnly
- SameSite=Lax
- Secure در NODE_ENV=production
- max age بر اساس SESSION_TTL_HOURS

Database token خام را نگه نمی‌دارد؛ Session.tokenHash یکتا ذخیره می‌شود. logout session را revoke می‌کند.

## Password / OTP

Password credential nullable است. hashing در password-hasher abstraction انجام می‌شود.

OTP:
- codeHash در DB
- expiresAt
- attempts
- consumedAt
- OTP_TTL_MINUTES
- OTP_MAX_ATTEMPTS

request endpoint: 5/min/IP.
verify/password login: 10/min/IP.
global default: 60/min/IP.

Throttler فعلی in-memory و per-instance/IP است؛ distributed limiter نیست.

## Authorization / RBAC

Roleها:
- STUDENT
- MENTOR
- AUTHOR
- REVIEWER
- ADMIN
- FINANCE

RolesGuard باید بعد از SessionAuthGuard در protected admin routes استفاده شود. یک User چند Role می‌تواند داشته باشد.

نمونهٔ principle of least privilege:
- Author می‌نویسد/submit می‌کند.
- Reviewer review/approve/reject می‌کند.
- Finance order/product read دارد ولی admin mutation کامل ندارد.
- Mentor CRM access دارد.
- rollback content فقط ADMIN است.

## Input validation

Global ValidationPipe:
- whitelist=true
- forbidNonWhitelisted=true
- transform=true

یعنی property ناشناخته صرفاً ignore نمی‌شود؛ request رد می‌شود. endpoint جدید باید DTO class-validator داشته باشد؛ unknown body روی endpointهایی که عمداً payload generic می‌گیرند باید با احتیاط review شود.

## CORS

API فقط FRONTEND_URL را origin مجاز قرار می‌دهد و credentials=true است. production FRONTEND_URL باید origin دقیق و trusted باشد.

## CSRF consideration

SameSite=Lax بخشی از ریسک cross-site cookie submission را کاهش می‌دهد، اما برای mutationهای حساس طراحی CSRF باید آگاهانه review شود، مخصوصاً اگر cross-site flows یا cookie policy تغییر کند.

## Content access

Entitlement source of truth است. UI lock کافی نیست.

Resource content:
- accessMode PUBLIC/ACCOUNT/ENTITLEMENT
- backend access check
- protected content response: private, no-store
- object storage key به client داده نمی‌شود

/media/:checksum artifactهای Resource current/history/audit را عمداً 404 می‌کند تا protected resource از public media route قابل bypass نباشد.

## Editorial / supply-chain data safety

External producer نمی‌تواند canonical DB را مستقیم بنویسد. batch:
contract validation → staging → review → publish.

این separation جلوی تبدیل OCR/agent output به production truth بدون human review را می‌گیرد.

SourceArtifact checksum integrity دارد. با این حال checksum جای malware/content-type inspection جامع را نمی‌گیرد.

## Provenance و حقوق محتوا

ContentSource rights flags دارد. security فقط cyber نیست؛ مجوز host/reproduce/translate نیز باید enforce شود تا asset غیرمجاز وارد storage/public response نشود.

## Secrets

هرگز commit نشوند:
- production .env
- DATABASE_URL واقعی
- MinIO/S3 secret
- ACME account/private material
- SSH private key
- session/OTP token
- payment secrets آینده

.env.example باید placeholder امن بماند.

## Admin bootstrap

bootstrap opt-in است. اگر BOOTSTRAP_ADMIN_PHONE/PASSWORD خالی باشند admin credential از سورس ساخته نمی‌شود.

بعد از bootstrap:
- secretها rotate/remove شوند.
- credential مشترک دائمی نسازید.
- فعالیت admin در audit قابل ردیابی باشد.

## PII

داده‌های حساس احتمالی:
- phone
- profile
- report card
- admissions/choice data
- study/attempt history
- CRM interactions

Fixture و public corpus باید synthetic/anonymized باشند. ReportCard publicConsent باید قبل از public exposure رعایت شود.

## Audit

AuditLog actor، action، target type/id، metadata و timestamp دارد. عملیات حساس جدید باید audit trail مناسب داشته باشند، بدون اینکه secret/credential داخل metadata ذخیره شود.

## Health exposure

/healthz error متن dependency را برمی‌گرداند. اگر edge exposure در آینده به اینترنت عمومی ریسک اطلاعاتی ایجاد کرد، سطح جزئیات public response را محدود و جزئیات را در internal monitoring نگه دارید.

## Rate limit scale-up

هنگام multi-instance شدن API، in-memory limiter بین instanceها share نمی‌شود. در آن مرحله Redis-backed/distributed rate limit یک hardening منطقی است.

## Security checklist برای feature

- auth لازم است؟
- role درست چیست؟
- object ownership لازم است؟
- entitlement لازم است؟
- چه PII برمی‌گردد؟
- log/audit چه چیزی ذخیره می‌کند؟
- input validation کامل است؟
- idempotency/replay مهم است؟
- file upload limit/type/checksum چیست؟
- source rights چیست؟
- test anonymous/wrong-role/no-access وجود دارد؟
- secret جدید در secret manager است؟
