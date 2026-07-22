#!/usr/bin/env bash
#
# Run the backend test suites.
#
# Each service under backend/ is a self-contained Lambda deployment unit, so
# they all ship modules with the same names (function.py, postgres_service.py,
# auth_lib.py, conftest.py). A single pytest process can only import one
# `postgres_service`, so collecting every service at once fails. Services are
# isolated at deploy time; they are isolated here too — one pytest process per
# service, exactly matching how they run in production.
#
# Usage:
#   ./backend/run-tests.sh                 # every service
#   ./backend/run-tests.sh auth-service    # one or more named services
#   PYTHON=../.venv/bin/python ./backend/run-tests.sh
#
# Requires a local PostgreSQL matching db/schema.sql — see backend/README.md.
# Exits non-zero if any service's suite fails, after running them all.

set -uo pipefail

cd "$(dirname "$0")"

PYTHON="${PYTHON:-python3}"

if [ "$#" -gt 0 ]; then
    services=("$@")
else
    # Underscore-prefixed folders are examples, not deployed services.
    services=()
    for dir in */; do
        name="${dir%/}"
        case "$name" in _*) continue ;; esac
        [ -f "$name/function.py" ] || continue
        services+=("$name")
    done
fi

failed=()

for service in "${services[@]}"; do
    if [ ! -d "$service" ]; then
        echo "==> $service: no such service directory" >&2
        failed+=("$service")
        continue
    fi

    echo "==> $service"
    if ! (cd "$service" && "$PYTHON" -m pytest "${PYTEST_ARGS:--q}"); then
        failed+=("$service")
    fi
    echo
done

if [ "${#failed[@]}" -gt 0 ]; then
    echo "FAILED: ${failed[*]}" >&2
    exit 1
fi

echo "All ${#services[@]} backend service suites passed."
