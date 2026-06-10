#!/usr/bin/env bash
# Block until PostgreSQL accepts connections, then exec the given command.
# Keeps Flyway / Hikari from racing a cold database at container start.
set -euo pipefail

PG_ISREADY="$(ls -d /usr/lib/postgresql/*/bin/pg_isready | head -n1)"

echo "[backend] Waiting for PostgreSQL on 127.0.0.1:5432 ..."
until "$PG_ISREADY" -h 127.0.0.1 -p 5432 -U postgres >/dev/null 2>&1; do
    sleep 1
done
echo "[backend] PostgreSQL is ready — starting: $*"
exec "$@"
