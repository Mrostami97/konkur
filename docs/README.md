# راهنمای مستندات Konkur 360

این پوشه مرجع فنی پروژه است. هدف این است که یک توسعه‌دهنده یا agent بدون اتکا به حافظهٔ گفتگو بتواند ساختار سیستم، قراردادها، flowها، نحوهٔ اجرا و محدودیت‌های فعلی را بفهمد.

## ترتیب پیشنهادی مطالعه

برای ورود به پروژه:

1. [architecture.md](architecture.md) — تصویر کلی و runtime topology
2. [domain-model.md](domain-model.md) — مرز دامنه‌ها و source of truth
3. [database.md](database.md) — مدل داده و versioning
4. [api-reference.md](api-reference.md) — endpoint inventory
5. [frontend.md](frontend.md) — routeها و معماری UI
6. [content-ingestion.md](content-ingestion.md) — قرارداد داده و editorial pipeline
7. [development.md](development.md) — setup و workflow توسعه
8. [testing-ci.md](testing-ci.md) — تست و CI/CD
9. [deployment-operations.md](deployment-operations.md) — deployment و عملیات
10. [security-model.md](security-model.md) — مدل امنیت
11. [current-state-roadmap.md](current-state-roadmap.md) — وضعیت، debt و roadmap

## اسناد موجود خارج از این مجموعه

- ../AGENTS.md: قواعد معماری و phase boundaries؛ قبل از تغییر کد خوانده شود.
- ../TODO.md: برنامهٔ محتوایی/محصولی و gateهای فازها.
- ../ops/runbook.md: دستورهای اجرایی production، migration، backup/restore و rollback.
- ../SECURITY.md: disclosure و credential-handling.
- ../CONTRIBUTING.md: قواعد contribution.
- content/: اسناد تحقیق رقابتی، editorial policy/style و launch briefs.
- ../apps/web/PRODUCT.md: اصول و positioning محصول.

## سلسله‌مراتب حقیقت

اسناد تاریخی ممکن است از کد جلو یا عقب افتاده باشند. برای تشخیص وضعیت فعلی، ترتیب اعتبار این است:

1. کد executable و schema/migration فعلی
2. تست‌های executable و CI
3. تنظیمات runtime مانند docker-compose.yml و nginx
4. این مستندات فنی
5. AGENTS.md/TODO.md و اسناد تاریخی phaseها

اگر بین یک یادداشت قدیمی و runtime فعلی تناقض بود، runtime فعلی مبنا است و سند قدیمی باید اصلاح شود.

## قاعدهٔ به‌روزرسانی Documentation

هر PR که یکی از موارد زیر را تغییر می‌دهد باید سند متناظر را هم تغییر دهد:

- route یا controller جدید → api-reference.md
- model/migration جدید → database.md و domain-model.md
- service/domain boundary جدید → architecture.md و domain-model.md
- public/admin page جدید → frontend.md
- env/service/deploy change → development.md یا deployment-operations.md
- auth/RBAC/data exposure change → security-model.md
- ingestion/schema/versioning change → content-ingestion.md
- CI/test change → testing-ci.md

هدف این نیست که doc کپی کد باشد؛ doc باید «چرایی، مرز و flow» را ثبت کند و جزئیات زودتغییر را به path کد ارجاع دهد.
