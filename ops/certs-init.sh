#!/bin/sh
set -eu

CERT_DIR=/certs
CERT_FILE="$CERT_DIR/fullchain.pem"
KEY_FILE="$CERT_DIR/privkey.pem"
WEB_DOMAIN="${WEB_DOMAIN:-localhost}"
API_DOMAIN="${API_DOMAIN:-api.localhost}"
WWW_DOMAIN="www.$WEB_DOMAIN"
TLS_MODE="${TLS_MODE:-auto}"

valid_hostname() {
  [ -n "$1" ] || return 1
  [ "${#1}" -le 253 ] || return 1
  printf '%s\n' "$1" | grep -Eiq '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
}

append_san() {
  candidate="$1"
  valid_hostname "$candidate" || return 1
  case ",$SAN_NAMES," in
    *",$candidate,"*) return 0 ;;
    *) SAN_NAMES="${SAN_NAMES:+$SAN_NAMES,}$candidate" ;;
  esac
}

certificate_pair_is_valid() {
  [ -s "$CERT_FILE" ] && [ -s "$KEY_FILE" ] || return 1

  cert_pub="$CERT_DIR/.cert-public.$$"
  key_pub="$CERT_DIR/.key-public.$$"
  if ! openssl x509 -in "$CERT_FILE" -pubkey -noout 2>/dev/null \
      | openssl pkey -pubin -outform DER > "$cert_pub" 2>/dev/null; then
    rm -f "$cert_pub" "$key_pub"
    return 1
  fi
  if ! openssl pkey -in "$KEY_FILE" -pubout -outform DER > "$key_pub" 2>/dev/null; then
    rm -f "$cert_pub" "$key_pub"
    return 1
  fi

  if cmp -s "$cert_pub" "$key_pub"; then
    result=0
  else
    result=1
  fi
  rm -f "$cert_pub" "$key_pub"
  return "$result"
}

case "$TLS_MODE" in
  auto|acme|selfsigned) ;;
  *) echo "ERROR: TLS_MODE must be auto, acme, or selfsigned (got '$TLS_MODE')." >&2; exit 1 ;;
esac

valid_hostname "$WEB_DOMAIN" || {
  echo "ERROR: WEB_DOMAIN is not a valid hostname: '$WEB_DOMAIN'." >&2
  exit 1
}

SAN_NAMES=
append_san "$WEB_DOMAIN"
append_san "$WWW_DOMAIN" || {
  echo "ERROR: WWW_DOMAIN is not a valid hostname: '$WWW_DOMAIN'." >&2
  exit 1
}
append_san "$API_DOMAIN" || {
  echo "ERROR: API_DOMAIN is not a valid hostname: '$API_DOMAIN'." >&2
  exit 1
}

if certificate_pair_is_valid; then
  echo "A valid matching certificate/key pair is already present in $CERT_DIR; keeping it."
  exit 0
fi

mkdir -p "$CERT_DIR"
TMP_CERT="$CERT_DIR/.fullchain.pem.$$"
TMP_KEY="$CERT_DIR/.privkey.pem.$$"
rm -f "$TMP_CERT" "$TMP_KEY"

echo "No valid certificate pair found in $CERT_DIR; generating a temporary self-signed bootstrap certificate."
openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout "$TMP_KEY" \
  -out "$TMP_CERT" \
  -subj "/CN=$WEB_DOMAIN" \
  -addext "subjectAltName=$(printf '%s' "$SAN_NAMES" | sed 's/\(^\|,\)/\1DNS:/g')"

chmod 600 "$TMP_KEY"
chmod 644 "$TMP_CERT"
mv -f "$TMP_KEY" "$KEY_FILE"
mv -f "$TMP_CERT" "$CERT_FILE"

if [ "$TLS_MODE" = "selfsigned" ] || { [ "$TLS_MODE" = "auto" ] && [ "$WEB_DOMAIN" = "localhost" ]; }; then
  echo "Self-signed certificate generated for: $SAN_NAMES."
else
  echo "Temporary bootstrap certificate generated for: $SAN_NAMES. Certbot will replace it after ACME validation succeeds."
fi
