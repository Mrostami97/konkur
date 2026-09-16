#!/bin/sh
set -u

MARKER=/etc/nginx/certs/reload.version
INTERVAL="${CERT_RELOAD_INTERVAL_SECONDS:-60}"

case "$INTERVAL" in
  ''|*[!0-9]*) INTERVAL=60 ;;
esac
if [ "$INTERVAL" -lt 10 ]; then
  INTERVAL=10
fi

fingerprint() {
  if [ -s "$MARKER" ]; then
    cksum "$MARKER" 2>/dev/null || true
  else
    printf '%s\n' missing
  fi
}

previous="$(fingerprint)"

while sleep "$INTERVAL"; do
  current="$(fingerprint)"
  [ "$current" = "$previous" ] && continue

  # nginx -t opens the certificate and key together. If a partially written or
  # mismatched pair ever appears, keep serving the currently loaded certificate
  # and retry on the next pass instead of taking nginx down.
  if nginx -t && nginx -s reload; then
    previous="$current"
    echo "TLS certificate changed; nginx reloaded."
  else
    echo "TLS certificate change could not be activated; keeping the loaded certificate." >&2
  fi
done
