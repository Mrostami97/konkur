# Deployment و عملیات

این سند معماری عملیاتی را توضیح می‌دهد. commandهای production دقیق و recovery procedures در ../ops/runbook.md مرجع نهایی عملیات هستند.

## Production Compose

docker-compose.yml stack زیر را تعریف می‌کند:

| Service | نقش |
|---|---|
| postgres | PostgreSQL 16 |
| redis | Redis 7، provisioned برای توسعهٔ آینده |
| minio | S3-compatible object storage |
| api | NestJS application |
| web | Next.js application |
| certs-init | certificate bootstrap |
| nginx | edge/TLS/reverse proxy |
| certbot | ACME issuance/renew loop |

Named volumeها دادهٔ Postgres، Redis، MinIO، certificates و ACME challenge را حفظ می‌کنند.

## Network flow

~~~mermaid
flowchart LR
    Internet --> N[nginx 80/443]
    N --> W[web:3000]
    N --> A[api:3001]
    W -->|INTERNAL_API_URL| A
    A --> P[(postgres:5432)]
    A --> M[(minio:9000)]
~~~

Database و MinIO مستقیماً publish نشده‌اند.

## TLS

compose فعلی certs-init و certbot را دارد. TLS_MODE و ACME variables رفتار certificate را کنترل می‌کنند.

متغیرهای مهم:
- WEB_DOMAIN
- API_DOMAIN
- TLS_MODE
- ACME_EMAIL
- ACME_STAGING
- ACME_RENEW_INTERVAL_SECONDS
- ACME_RETRY_INTERVAL_SECONDS

برای localhost/bootstrap ممکن است certificate غیرعمومی استفاده شود؛ production باید certificate trusted و domain/DNS صحیح داشته باشد.

## NGINX

nginx template در ops/nginx/default.conf.template است. certificate watcher اجازهٔ reload هنگام تغییر cert را می‌دهد.

هنگام redeploy containerها، upstream resolution باید با Docker DNS سازگار بماند؛ nginx را فقط با hostname/IP cached شکننده تنظیم نکنید.

## Health

### /health

lightweight:
- status=ok
- timestamp

### /healthz

deep:
- database SELECT 1
- object storage ping
- per-check latency
- app version
- uptime
- timestamp

در صورت شکست dependency، HTTP 503 و status=degraded برمی‌گردد.

Redis عمداً healthz check ندارد چون هنوز dependency واقعی مسیر کد نیست.

## Deployment pipeline

CI پس از gates:
1. production images را build/validate می‌کند.
2. imageها را به GHCR publish می‌کند.
3. در صورت وجود deploy configuration به server deploy می‌کند.
4. /healthz را تا آماده شدن بررسی می‌کند.

Secrets و SSH configuration را در repository commit نکنید.

## Migration در deploy

قاعده:
- backup قبل از migration destructive/risky
- migrate deploy، نه migrate dev
- migration باید forward/rollback plan داشته باشد
- app/schema compatibility در rolling change لحاظ شود

اگر migration و app version tight-coupled هستند، ترتیب deploy در runbook صریح شود.

## Backup

ops/backup.sh و runbook مسیر backup را تعریف می‌کنند. backup معتبر فقط «فایل تولیدشده» نیست؛ restore test لازم است.

حداقل چیزهای مهم:
- PostgreSQL
- object storage data یا strategy بازیابی آن
- deployment env/secrets در secret manager مناسب
- certificate state اگر recovery plan نیاز دارد

## Restore

ops/restore.sh را فقط با شناخت target environment اجرا کنید. restore می‌تواند destructive باشد.

پیش از restore:
1. traffic/write را کنترل کنید.
2. snapshot فعلی بگیرید.
3. target DB/container را verify کنید.
4. نسخهٔ app/migration compatible را مشخص کنید.
5. بعد از restore /healthz + smoke test.

## Rollback bad deploy

سه نوع rollback را جدا کنید:
- application image rollback
- database migration rollback
- content version rollback

Content rollback از Ingestion/ContentVersion است و با infrastructure rollback یکی نیست.

DB rollback قبل از هر اجرا backup می‌خواهد. بعضی migrationها ذاتاً reversible نیستند و نیاز به forward-fix دارند.

## Logs

~~~bash
docker compose logs --tail=200 api
docker compose logs --tail=200 web
docker compose logs --tail=200 nginx
docker compose logs --tail=200 postgres
docker compose logs --tail=200 minio
docker compose logs --tail=200 certbot
~~~

برای incident:
- timestamp/timezone را ثبت کنید.
- request/trace context اگر موجود است حفظ کنید.
- secret/session/OTP/PII را paste نکنید.
- deploy SHA/image tag را ثبت کنید.

## Redis

Redis service حاضر است اما AppModule/healthz وابستگی runtime فعالی به آن نشان نمی‌دهند. تا وقتی queue/cache/distributed rate limiter واقعاً اضافه نشده، Redis outage را outage اپلیکیشن اعلام نکنید.

## Object storage

MinIO dependency واقعی API است. bucket اصلی compose: konkurcom-media.

Resource protected نباید با raw storage key یا public signed URL دائمی expose شود. stream/access endpoint باید policy را enforce کند.

## Domain/DNS checklist

برای production:
- WEB_DOMAIN DNS → server
- API_DOMAIN DNS → server
- 80/443 باز
- ACME challenge قابل دسترس
- FRONTEND_URL دقیقاً origin مورد انتظار CORS
- cookie Secure در NODE_ENV=production
- verification tokens فقط اگر لازم‌اند

## Release checklist

- CI green
- migration reviewed
- backup verified
- .env/secrets present
- image tags known
- DNS/TLS healthy
- docker compose config valid
- deploy
- /healthz 200
- public home/API smoke
- auth smoke
- protected resource smoke
- logs بدون error loop
- rollback target مشخص

جزئیات command-level: ../ops/runbook.md.
