#!/bin/sh
set -eu

CERT_DIR=/certs
CERT_FILE="$CERT_DIR/fullchain.pem"
KEY_FILE="$CERT_DIR/privkey.pem"

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
  echo "Certificate already present in $CERT_DIR — keeping it."
  exit 0
fi

echo "No certificate found in $CERT_DIR — generating a self-signed one."
openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -subj "/CN=${WEB_DOMAIN:-localhost}" \
  -addext "subjectAltName=DNS:${WEB_DOMAIN:-localhost},DNS:${API_DOMAIN:-localhost}"

chmod 600 "$KEY_FILE"
echo "Self-signed certificate generated for ${WEB_DOMAIN:-localhost} / ${API_DOMAIN:-localhost}."
