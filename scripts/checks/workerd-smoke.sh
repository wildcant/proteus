#!/usr/bin/env bash
# That the Worker boots on workerd and answers a request that reads the database.
#
# The failure this exists for is not a compile error. `bootstrapContainer` runs at module init on
# this runtime, which is global scope — where workerd forbids socket I/O outright, and where the
# per-request database store `withConnection()` fills is empty. Code that does either boots fine
# under node and throws on the first fetch of every isolate, so typecheck, lint, the structure rules
# and the whole backend test suite stay green while production returns 500 on every route.
#
# Two probes, because they fail apart. `/health` touches nothing, so it answers 200 whenever the
# isolate got through module init at all; `/store/products` goes through Hono, the container, a
# module service and a real connection, so it is the one that notices a database provider wired for
# node. A bundle that cannot build never reaches either, which is why there is no separate
# `wrangler deploy --dry-run` gate — this one subsumes it.
#
# The database is the one `.env.workerd` names, which is the same local Postgres `pnpm dev` uses.
# The port is whatever the kernel hands out rather than a fixed one, so a `dev:workerd` session
# already listening on 8787 neither breaks this nor gets probed in its place.

set -uo pipefail

BACKEND="$(cd "$(dirname "$0")/../../apps/backend" && pwd)"
cd "$BACKEND"

free_port() {
  node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'
}

PORT="$(free_port)"
INSPECTOR_PORT="$(free_port)"
LOG="$(mktemp)"

# The wrangler entry directly rather than `pnpm exec wrangler`: the pnpm wrapper is the process that
# would be killed, leaving workerd holding the port — and a second run then probes *that* server and
# passes without having built anything.
node node_modules/wrangler/bin/wrangler.js dev \
  --config wrangler.jsonc \
  --env-file .env.workerd \
  --port "$PORT" \
  --inspector-port "$INSPECTOR_PORT" \
  --log-level warn >"$LOG" 2>&1 &
wrangler_pid=$!

cleanup() {
  kill "$wrangler_pid" 2>/dev/null
  wait "$wrangler_pid" 2>/dev/null
  local stray
  stray="$(lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null)"
  [ -n "$stray" ] && kill $stray 2>/dev/null
  rm -f "$LOG"
}
trap cleanup EXIT

fail() {
  echo "$1"
  echo ""
  cat "$LOG"
  exit 1
}

ready=1
for _ in $(seq 1 160); do
  if curl -sf -m 2 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    ready=0
    break
  fi
  # The server died rather than being slow — stop waiting out the full 40s for a process that is gone.
  kill -0 "$wrangler_pid" 2>/dev/null || break
  sleep 0.25
done

[ $ready -eq 0 ] || fail "The Worker never answered GET /health — it failed to boot on workerd."

status="$(curl -s -o /dev/null -w '%{http_code}' -m 20 "http://127.0.0.1:$PORT/store/products")"
[ "$status" = "200" ] || fail "GET /store/products returned $status on workerd — the Worker boots but cannot serve a request that reads the database."
