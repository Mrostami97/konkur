# KonkurCom 360

## Secrets to configure

There is a single deploy target (production), driven by one `docker-compose.yml`.

### GitHub Actions repo secrets (for the deploy steps in `.github/workflows/ci.yml`)

**Required**

| Secret | Purpose |
|---|---|
| `SSH_HOST` | Target server to deploy to |
| `SSH_USER` | SSH user on that server |
| `SSH_KEY` | Private key for that user (primary auth method) |
| `DEPLOY_PATH` | Absolute path on the server holding the checked-out repo |

**Optional**

| Secret | Purpose |
|---|---|
| `SSH_PASS` | Password fallback, only used if the server has no key configured for `SSH_USER` |

### Root `.env` (repo root, read by `docker-compose.yml`)

**Required**

| Variable | Purpose |
|---|---|
| `POSTGRES_PASSWORD` | Postgres password |
| `MINIO_ROOT_PASSWORD` | MinIO root password (also used as the API's S3 secret key) |

**Optional** (default shown)

| Variable | Purpose | Default |
|---|---|---|
| `WEB_DOMAIN` | Public hostname for the web app; also goes into the self-signed cert | `localhost` |
| `API_DOMAIN` | Public hostname for the API; also goes into the self-signed cert | `api.localhost` |
| `SESSION_TTL_HOURS` | Session cookie lifetime | `720` |
| `OTP_TTL_MINUTES` | OTP code lifetime | `5` |
| `OTP_MAX_ATTEMPTS` | OTP verify attempts before lockout | `5` |

## TLS

`nginx` terminates TLS with a self-signed certificate and reverse-proxies to
`web` (`WEB_DOMAIN`) and `api` (`API_DOMAIN`). The certificate is generated
once into the `nginx_certs` Docker volume the first time the stack comes up;
it is kept on the server across redeploys and is only (re)generated if it's
missing from that volume.
