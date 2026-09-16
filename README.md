# kunkur01 (کنکورصفریک)

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
| `WEB_DOMAIN` | Canonical public hostname for the web app and ACME certificate | `localhost` |
| `API_DOMAIN` | Optional legacy API hostname; browser traffic normally uses same-origin `/api` | `api.localhost` |
| `TLS_MODE` | `auto` uses ACME for public names and self-signed TLS for localhost; also accepts `acme` or `selfsigned` | `auto` |
| `ACME_EMAIL` | Address for certificate-expiry notices (recommended in production) | empty |
| `ACME_STAGING` | Set to `1` while testing ACME without production rate limits | `0` |
| `GOOGLE_SITE_VERIFICATION` | Search Console HTML verification token, when using the URL-prefix method | empty |
| `BING_SITE_VERIFICATION` | Bing Webmaster Tools `msvalidate.01` verification token | empty |
| `SESSION_TTL_HOURS` | Session cookie lifetime | `720` |
| `OTP_TTL_MINUTES` | OTP code lifetime | `5` |
| `OTP_MAX_ATTEMPTS` | OTP verify attempts before lockout | `5` |

## TLS

`nginx` terminates TLS and reverse-proxies the web app plus the same-origin
`/api` gateway. In production (`TLS_MODE=auto` with a public `WEB_DOMAIN`),
Certbot obtains and renews a Let's Encrypt certificate through the HTTP-01
webroot challenge. A temporary self-signed certificate lets nginx start before
the first issuance; nginx validates and hot-reloads renewed certificate files.

For local development, `TLS_MODE=auto` keeps self-signed TLS. The derived
`www.<WEB_DOMAIN>` alias and `API_DOMAIN` are added to the public certificate only when they resolve in
public DNS, so an optional hostname cannot block issuance for the canonical
site. The browser does not require `API_DOMAIN`: authenticated requests use
`https://<WEB_DOMAIN>/api/...`.
