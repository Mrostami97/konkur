# KonkurCom 360

## Secrets to configure

### GitHub Actions (repo secrets, for `.github/workflows/deploy.yml`)

| Secret | Purpose |
|---|---|
| `SSH_HOST` | Target server to deploy to |
| `SSH_USER` | SSH user on that server |
| `SSH_KEY` | Private key for that user |
| `DEPLOY_PATH` | Absolute path on the server holding the checked-out repo |

### Deploy server environment (for `docker-compose.prod.yml`)

| Variable | Purpose | Default if unset |
|---|---|---|
| `POSTGRES_PASSWORD` | Postgres password | `konkur` (insecure — set a real one) |
| `MINIO_ROOT_PASSWORD` | MinIO root password | `konkur123` (insecure — set a real one) |
| `PUBLIC_API_URL` | Public URL the web app calls for the API | `http://localhost:3001` |

### API runtime (`apps/api/.env`, see `.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `PORT` | API listen port |
| `FRONTEND_URL` | Web app origin, for CORS |
| `SESSION_TTL_HOURS` | Session cookie lifetime |
| `OTP_TTL_MINUTES` | OTP code lifetime |
| `OTP_MAX_ATTEMPTS` | OTP verify attempts before lockout |
| `S3_ENDPOINT`, `S3_PORT`, `S3_USE_SSL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` | MinIO/S3 connection for media storage |
