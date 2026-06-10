#!/usr/bin/env bash
# Run the PostgreSQL server in the foreground (for supervisord), resolving the
# versioned binary path so this works regardless of the packaged PG version.
set -euo pipefail
exec "$(ls -d /usr/lib/postgresql/*/bin/postgres | head -n1)" -D /var/lib/postgresql/data
