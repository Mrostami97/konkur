#!/bin/sh
set -u

LE_DIR=/etc/letsencrypt
CHALLENGE_DIR=/var/www/certbot
ACTIVE_DIR=/active-certs
WEB_DOMAIN="${WEB_DOMAIN:-localhost}"
WWW_DOMAIN="www.$WEB_DOMAIN"
API_DOMAIN="${API_DOMAIN:-api.localhost}"
TLS_MODE="${TLS_MODE:-auto}"

is_local_name() {
  case "$1" in
    localhost|*.localhost|*.local) return 0 ;;
    *) return 1 ;;
  esac
}

is_public_dns_name() {
  is_local_name "$1" && return 1
  [ "${#1}" -le 253 ] || return 1
  printf '%s\n' "$1" | grep -Eiq '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
}

find_python() {
  for candidate in python3 python /opt/certbot/bin/python; do
    if command -v "$candidate" >/dev/null 2>&1; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

PYTHON_BIN="$(find_python || true)"

resolves_in_public_dns() {
  domain="$1"
  [ -n "$PYTHON_BIN" ] || return 2
  "$PYTHON_BIN" - "$domain" <<'PY'
import socket
import sys

try:
    answers = socket.getaddrinfo(sys.argv[1], 80, type=socket.SOCK_STREAM)
except OSError:
    raise SystemExit(1)

raise SystemExit(0 if answers else 1)
PY
}

idle_with_error() {
  echo "ERROR: $1" >&2
  while :; do sleep 86400; done
}

case "$TLS_MODE" in
  auto)
    if is_local_name "$WEB_DOMAIN"; then TLS_MODE=selfsigned; else TLS_MODE=acme; fi
    ;;
  acme|selfsigned) ;;
  *) idle_with_error "TLS_MODE must be auto, acme, or selfsigned (got '$TLS_MODE')." ;;
esac

if [ "$TLS_MODE" = selfsigned ]; then
  echo "TLS_MODE=selfsigned; ACME renewal is disabled for local/development use."
  while :; do sleep 86400; done
fi

is_public_dns_name "$WEB_DOMAIN" || idle_with_error "WEB_DOMAIN is not a public DNS name: '$WEB_DOMAIN'."

if ! resolves_in_public_dns "$WEB_DOMAIN"; then
  idle_with_error "WEB_DOMAIN does not resolve in public DNS yet: '$WEB_DOMAIN'. ACME cannot validate it."
fi

DOMAINS="$WEB_DOMAIN"
if is_public_dns_name "$WWW_DOMAIN" && resolves_in_public_dns "$WWW_DOMAIN"; then
  DOMAINS="$DOMAINS,$WWW_DOMAIN"
else
  echo "WARNING: WWW_DOMAIN '$WWW_DOMAIN' does not resolve in public DNS and will not be included in this certificate run." >&2
fi

if is_public_dns_name "$API_DOMAIN" && resolves_in_public_dns "$API_DOMAIN"; then
  case ",$DOMAINS," in
    *",$API_DOMAIN,"*) ;;
    *) DOMAINS="$DOMAINS,$API_DOMAIN" ;;
  esac
else
  echo "WARNING: API_DOMAIN '$API_DOMAIN' is local, invalid, or not publicly resolvable and will not be included in this certificate run." >&2
fi

if [ -z "$PYTHON_BIN" ]; then
  idle_with_error "The Certbot image has no usable Python interpreter for the DNS preflight."
fi

CERT_NAME="$WEB_DOMAIN"
printf '%s\n' "$CERT_NAME" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]*$' || \
  idle_with_error "Unsafe certificate name derived from WEB_DOMAIN."

case "${ACME_RENEW_INTERVAL_SECONDS:-43200}" in
  ''|*[!0-9]*) RENEW_INTERVAL=43200 ;;
  *) RENEW_INTERVAL="$ACME_RENEW_INTERVAL_SECONDS" ;;
esac
case "${ACME_RETRY_INTERVAL_SECONDS:-300}" in
  ''|*[!0-9]*) RETRY_INTERVAL=300 ;;
  *) RETRY_INTERVAL="$ACME_RETRY_INTERVAL_SECONDS" ;;
esac
[ "$RENEW_INTERVAL" -ge 3600 ] || RENEW_INTERVAL=3600
[ "$RETRY_INTERVAL" -ge 300 ] || RETRY_INTERVAL=300

mkdir -p "$CHALLENGE_DIR" "$ACTIVE_DIR"

sync_active_certificate() {
  source_dir="$LE_DIR/live/$CERT_NAME"
  [ -s "$source_dir/fullchain.pem" ] && [ -s "$source_dir/privkey.pem" ] || return 1

  if [ -s "$ACTIVE_DIR/fullchain.pem" ] && [ -s "$ACTIVE_DIR/privkey.pem" ] && \
     cmp -s "$source_dir/fullchain.pem" "$ACTIVE_DIR/fullchain.pem" && \
     cmp -s "$source_dir/privkey.pem" "$ACTIVE_DIR/privkey.pem"; then
    echo "Active TLS certificate is already current."
    return 0
  fi

  tmp_cert="$ACTIVE_DIR/.fullchain.pem.$$"
  tmp_key="$ACTIVE_DIR/.privkey.pem.$$"
  tmp_marker="$ACTIVE_DIR/.reload.version.$$"
  rm -f "$tmp_cert" "$tmp_key" "$tmp_marker"

  cp "$source_dir/fullchain.pem" "$tmp_cert" || return 1
  cp "$source_dir/privkey.pem" "$tmp_key" || {
    rm -f "$tmp_cert" "$tmp_key" "$tmp_marker"
    return 1
  }
  chmod 644 "$tmp_cert"
  chmod 600 "$tmp_key"

  # The marker moves only after both files are in place. nginx watches this
  # marker and validates the pair before reloading.
  mv -f "$tmp_key" "$ACTIVE_DIR/privkey.pem"
  mv -f "$tmp_cert" "$ACTIVE_DIR/fullchain.pem"
  printf '%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$tmp_marker"
  mv -f "$tmp_marker" "$ACTIVE_DIR/reload.version"
  echo "Installed renewed certificate for $DOMAINS."
}

request_or_renew() {
  set -- certbot certonly \
    --non-interactive \
    --agree-tos \
    --webroot \
    --webroot-path "$CHALLENGE_DIR" \
    --preferred-challenges http \
    --cert-name "$CERT_NAME" \
    --domains "$DOMAINS" \
    --keep-until-expiring

  if [ -n "${ACME_EMAIL:-}" ]; then
    set -- "$@" --email "$ACME_EMAIL"
  else
    echo "WARNING: ACME_EMAIL is unset; registering without expiry notices." >&2
    set -- "$@" --register-unsafely-without-email
  fi

  if [ "${ACME_STAGING:-0}" = "1" ]; then
    set -- "$@" --staging
  fi

  "$@" && sync_active_certificate
}

trap 'exit 0' INT TERM

while :; do
  if request_or_renew; then
    sleep "$RENEW_INTERVAL"
  else
    echo "ACME issuance/renewal failed; the previously active certificate remains in use. Retrying in ${RETRY_INTERVAL}s." >&2
    sleep "$RETRY_INTERVAL"
  fi
done
