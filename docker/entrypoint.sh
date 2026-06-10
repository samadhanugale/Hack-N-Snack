#!/usr/bin/env bash
# Initialise the PostgreSQL data directory on first boot (idempotent), then
# hand off to supervisord which runs postgres + backend + nginx together.
set -euo pipefail

PGDATA=/var/lib/postgresql/data
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | head -n1)"
export PATH="$PGBIN:$PATH"

mkdir -p "$PGDATA"
chown -R postgres:postgres /var/lib/postgresql
chmod 700 "$PGDATA"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "[entrypoint] Initialising PostgreSQL data directory at $PGDATA ..."
    su postgres -c "$PGBIN/initdb -D '$PGDATA' -E UTF8 --auth-local=trust --auth-host=md5"

    {
        echo "listen_addresses = '127.0.0.1'"
        echo "port = 5432"
    } >> "$PGDATA/postgresql.conf"

    echo "[entrypoint] Bootstrapping role + database ..."
    # DB_PASSWORD is configurable via .env / -e (default 'root'). It is applied
    # only when the data dir is first created; to change it on an existing
    # volume, recreate the DB with `docker compose down -v`.
    DB_PASSWORD="${DB_PASSWORD:-root}"
    su postgres -c "$PGBIN/pg_ctl -D '$PGDATA' -w -o '-c listen_addresses=127.0.0.1' start"
    su postgres -c "$PGBIN/psql -v ON_ERROR_STOP=1 -d postgres -c \"ALTER USER postgres WITH PASSWORD '${DB_PASSWORD}';\""
    if ! su postgres -c "$PGBIN/psql -tAc \"SELECT 1 FROM pg_database WHERE datname='smart_quiz_hub'\"" | grep -q 1; then
        su postgres -c "$PGBIN/psql -v ON_ERROR_STOP=1 -d postgres -c 'CREATE DATABASE smart_quiz_hub'"
    fi
    su postgres -c "$PGBIN/pg_ctl -D '$PGDATA' -w stop"
    echo "[entrypoint] PostgreSQL bootstrap complete."
else
    echo "[entrypoint] Existing PostgreSQL data directory found — skipping init."
fi

echo "[entrypoint] Starting supervisord (postgres + backend + nginx) ..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
