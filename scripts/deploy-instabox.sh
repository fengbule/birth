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
docker compose -p birth up -d --build --wait --wait-timeout 90 api
# Bind-mounted configuration files can change inode after git pull. Recreate web
# so Nginx loads the current file and resolves the API container's current address.
docker compose -p birth up -d --no-deps --force-recreate --wait --wait-timeout 90 web
curl --fail --silent --show-error "http://127.0.0.1:$BIRTH_PORT/healthz"
printf '\n'
curl --fail --silent --show-error "http://127.0.0.1:$BIRTH_PORT/api/health"
printf '\n'
instabox-port publish "$BIRTH_PORT"
