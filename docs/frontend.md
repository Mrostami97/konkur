# معماری Frontend

## Stack

Frontend در apps/web قرار دارد:

- Next.js 14.2
- React 18.3
- TypeScript
- App Router
- KaTeX
- CSS سراسری RTL/Persian
- SSR/public SEO surfaces + authenticated/admin workflows

## ساختار

~~~text
apps/web/src/
  app/          Routes, layouts, metadata, sitemap/RSS endpoints
  components/   UI components
  content/      Static/generated content data
  lib/          API/data/render helpers
~~~

PRODUCT.md در همان package اصول محصول و accessibility/positioning را ثبت می‌کند.

## Route map

در وضعیت فعلی ۶۴ route/page/route-handler زیر app وجود دارد. گروه‌بندی کاربردی:

### Public / trust / discovery

- /
- /about
- /articles
- /articles/[slug]
- /guides
- /guides/[slug]
- /authors/[slug]
- /contributors API-backed
- /editorial-policy
- /source-policy
- /evidence
- /search
- /corrections

### Learning / content

- /courses
- /courses/[slug]
- /lessons/[id]
- /resources
- /resources/[slug]
- /subjects
- /subjects/[slug]
- /topics/[slug]
- /questions
- /questions/[id]

### Assessment / student

- /exams
- /attempts/[id]
- /attempts/[id]/report
- /today
- /account
- /login

### Analytics / admissions

- /rank-estimate
- /report-cards
- /admissions
- /programs
- /programs/[code]
- /universities/[code]
- /choices

### Admin

- /admin
- /admin/admissions
- /admin/analytics
- /admin/articles
- /admin/articles/[id]/preview
- /admin/commerce
- /admin/content-sources
- /admin/contributors
- /admin/courses
- /admin/crm
- /admin/crm/leads/[id]
- /admin/exams
- /admin/import
- /admin/import/[jobId]
- /admin/questions
- /admin/resources
- /admin/taxonomy

### Machine/SEO routes

- /llms.txt
- /rss.xml
- /sitemap.xml
- /sitemaps/admissions.xml
- /sitemaps/articles.xml
- /sitemaps/courses.xml
- /sitemaps/guides.xml
- /sitemaps/pages.xml
- /sitemaps/report-cards.xml
- /sitemaps/resources.xml
- /sitemaps/subjects.xml
- /sitemaps/topics.xml

## API access

دو context متفاوت وجود دارد:

### Server-side / SSR

سرور Next.js باید از INTERNAL_API_URL استفاده کند؛ در Docker Compose مقدار آن http://api:3001 است. دلیل: public domain/TLS برای browser طراحی شده و داخل compose network لازم نیست round-trip از nginx/public DNS انجام شود.

### Browser-side

درخواست browser باید public API origin را استفاده کند و cookie session را با credentials ارسال کند. CORS backend فقط FRONTEND_URL را مجاز می‌کند.

هر تغییر در public API base URL باید با این تفاوت build-time/runtime بررسی شود؛ envهای NEXT_PUBLIC در Next.js عموماً در build bundle می‌شوند.

## Rendering content

Article/resource/question content به شکل block data رندر می‌شود. LaTeX با KaTeX رندر می‌شود. محتوای raw HTML آزاد به‌عنوان قرارداد عمومی پذیرفته نشده است.

هنگام افزودن block type:
1. schema/contract یا validator را به‌روزرسانی کنید.
2. renderer قابل دسترس بسازید.
3. SSR را تست کنید.
4. fallback برای دادهٔ ناشناخته مشخص کنید.
5. export/search/SEO implications را بررسی کنید.

## RTL و فارسی

UI برای فارسی/RTL طراحی شده است. component جدید باید:
- direction را فرضاً LTR نگیرد.
- اعداد/فرمول‌ها/کد را در container مناسب bidi قرار دهد.
- focus state و keyboard navigation داشته باشد.
- متن طولانی فارسی و mobile width را تحمل کند.

## SEO

پروژه sitemapهای domain-specific، RSS، robots و llms.txt دارد. public content نباید فقط client-rendered و غیرقابل crawl باشد.

محتوای draft/review:
- نباید در sitemap/RSS/search عمومی ظاهر شود.
- preview باید no-store و noindex/nofollow باشد.
- canonical/metadata فقط برای نسخهٔ منتشرشده تولید شود.

## Access-aware UI

UI نمایش قفل/دسترسی است، ولی امنیت نباید به UI واگذار شود. Lesson/Resource protected باید server/API access check داشته باشد. مخفی کردن button جای Entitlement validation را نمی‌گیرد.

## Admin UI

Admin routeها thin client برای workflow backend هستند. business rule نهایی باید در service/backend بماند، مخصوصاً:
- approve/reject/publish
- entitlement
- score
- import review
- source-rights checks

## تست‌های frontend

package web شامل corpus tests فازهای 11/12/13/14/17/18، SEO test، SSR smoke tests و routing semantics است. برای جزئیات [testing-ci.md](testing-ci.md).

## افزودن صفحه

برای page جدید:
1. مشخص کنید public/student/admin است.
2. metadata/canonical/indexability را تعیین کنید.
3. data fetching را SSR/client به‌درستی انتخاب کنید.
4. auth فقط در UI نباشد.
5. sitemap/RSS/search inclusion را اگر لازم است به‌روزرسانی کنید.
6. mobile/RTL/accessibility را تست کنید.
7. route map این سند را اصلاح کنید.
