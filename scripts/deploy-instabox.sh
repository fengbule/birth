#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
: "${BIRTH_PORT:=8086}"
export BIRTH_PORT
case "$BIRTH_PORT" in ''|*[!0-9]*) echo 'BIRTH_PORT must be a port number' >&2; exit 1;; esac
test "$BIRTH_PORT" -ge 1024 && test "$BIRTH_PORT" -le 65535
command -v docker >/dev/null
command -v instabox-port >/dev/null
node scripts/build.mjs
docker compose -p birth config --quiet
docker compose -p birth up -d --wait --wait-timeout 60
curl --fail --silent --show-error "http://127.0.0.1:$BIRTH_PORT/healthz"
printf '\n'
instabox-port publish "$BIRTH_PORT"
