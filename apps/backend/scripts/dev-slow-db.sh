#!/usr/bin/env bash
#
# Dev server with latency between it and Postgres, so the API behaves like its database is not on
# localhost. Assumes `npm run db:start` is up — the proxy itself is declared in docker-compose.yml.
#
#   npm run --workspace=backend dev:slow
#   DB_LATENCY_MS=200 npm run --workspace=backend dev:slow
set -euo pipefail

LATENCY_MS="${DB_LATENCY_MS:-50}"
TOXICS=http://127.0.0.1:8474/proxies/postgres-slow/toxics

# Delete before adding, so re-running with a different DB_LATENCY_MS actually changes it rather
# than 409-ing on the name and leaving the old delay in place.
curl -sf -X DELETE "$TOXICS/latency_downstream" >/dev/null 2>&1 || true
curl -sf -X POST "$TOXICS" -H 'Content-Type: application/json' \
  -d "{\"name\":\"latency_downstream\",\"type\":\"latency\",\"stream\":\"downstream\",\"attributes\":{\"latency\":$LATENCY_MS}}" \
  >/dev/null || { echo "No toxiproxy on :8474 — run npm run db:start"; exit 1; }

echo "==> ${LATENCY_MS}ms per query, via 127.0.0.1:5442"
export SLOW_DATABASE_URL="${SLOW_DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:5442/proteus}"
exec npm run dev
