#!/usr/bin/env bash
# Every test this repo has, in parallel.
#
# `verify.sh` is the post-implementation gate: it formats, type-checks, lints, and runs the slice
# of tests worth waiting ~16s for. This runs the suites that gate deliberately leaves out — the
# whole backend suite rather than the API slice, and both Playwright suites — and runs no static
# checks at all. The two scripts are read together, not one instead of the other.
#
# All five run at once, which is only true because nothing they touch is shared any more. The
# backend suite holds `proteus_test_1..N`, one per vitest worker; the store and admin suites hold
# `proteus_test_store` and `proteus_test_admin`, each with its own backend process and its own fake
# payment gateway, assigned by `defineE2eConfig` in packages/testing. Before that split the two
# browser suites truncated one shared database and could not even run back to back reliably.
#
# Not the Temporal suites. `test:temporal` needs a Temporal server up
# (`docker compose -f apps/backend/docker-compose.yml up -d --wait`) and takes the same advisory
# lock on the worker databases that `test` does, so it cannot run beside it; `test:temporal:server`
# downloads a server binary and bundles the workflow sandbox three times over. Both stay explicit
# scripts — see the header comments in the vitest configs they belong to.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

JOBS="backend store admin storeE2e adminE2e"

# The whole suite, not `test:gate`. ~96s, and the reason this script exists separately.
job_backend() { npm run --workspace=backend test; }

job_store() { npm run --workspace=store test; }
job_admin() { npm run --workspace=admin test; }

# --reporter=line overrides the config's `html`, which on a local failure starts a report server
# and blocks — a run that never exits rather than one that fails. `line` still prints full failure
# detail at the end, and the HTML report stays available to anyone running `test:e2e` directly.
job_storeE2e() { npm run --workspace=store test:e2e -- --reporter=line; }
job_adminE2e() { npm run --workspace=admin test:e2e -- --reporter=line; }

for arg in "$@"; do
  case "$arg" in
    -h | --help)
      echo "Usage: npm run verify:full"
      echo ""
      echo "  Runs every test suite in parallel: the full backend suite, the store and admin"
      echo "  unit tests, and both Playwright e2e suites."
      echo ""
      echo "  Static checks are npm run verify. The Temporal suites are excluded — they need"
      echo "  a Temporal server and cannot share the backend suite's databases."
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: npm run verify:full" >&2
      exit 1
      ;;
  esac
done

label_of() {
  case "$1" in
    backend) echo "Backend suite (full)" ;;
    store) echo "Store unit tests" ;;
    admin) echo "Admin unit tests" ;;
    storeE2e) echo "Store e2e (:3013 backend, proteus_test_store)" ;;
    adminE2e) echo "Admin e2e (:3015 backend, proteus_test_admin)" ;;
  esac
}

if ! docker compose -f apps/backend/docker-compose.test.yml ps --status running --quiet postgres-test >/dev/null 2>&1; then
  echo ""
  echo -e "${RED}✖${RESET} ${BOLD}The test database is not running.${RESET}"
  echo -e "  Start it with ${BOLD}npm run --workspace=backend db:test:up${RESET}."
  echo ""
  exit 1
fi

LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$LOG_DIR"' EXIT

run_job() {
  local name=$1
  shift
  local started=$SECONDS
  "$@" >"$LOG_DIR/$name.log" 2>&1
  local code=$?
  echo $((SECONDS - started)) >"$LOG_DIR/$name.time"
  echo $code >"$LOG_DIR/$name.exit"
}

echo ""
job_count="$(echo "$JOBS" | wc -w | xargs)"
echo -e "${BOLD}Running ${job_count} suites in parallel${RESET} ${DIM}(output appears as each finishes)${RESET}"
echo -e "${DIM}  Browsers and the backend suite share this machine — expect several minutes.${RESET}"

for name in $JOBS; do
  run_job "$name" "job_$name" &
done

failures=0

report() {
  local name=$1
  local code duration
  code="$(cat "$LOG_DIR/$name.exit")"
  duration="$(cat "$LOG_DIR/$name.time")"
  echo ""
  if [[ "$code" -eq 0 ]]; then
    echo -e "${GREEN}✔${RESET} ${BOLD}$(label_of "$name")${RESET} ${DIM}(${duration}s)${RESET}"
    return
  fi

  echo -e "${RED}✖${RESET} ${BOLD}$(label_of "$name")${RESET} ${DIM}(${duration}s)${RESET}"
  cat "$LOG_DIR/$name.log"
  # The backend suite claims its worker databases with an advisory lock, so a second vitest run
  # — an orphaned process, or an editor's watcher — fails here rather than corrupting this one.
  if grep -q 'Another vitest run already holds the test databases' "$LOG_DIR/$name.log"; then
    echo ""
    echo -e "  ${BOLD}Hint:${RESET} find it with ${BOLD}pgrep -fl vitest${RESET} and re-run once it is clear."
  fi
  # Both e2e suites keep `reuseExistingServer`, which cannot tell a stale backend from one this run
  # started — and a stale one is pointed at a different database.
  if grep -q 'Timed out waiting .* from config.webServer' "$LOG_DIR/$name.log"; then
    echo ""
    echo -e "  ${BOLD}Hint:${RESET} a server may already hold this suite's port. Check with"
    echo -e "  ${BOLD}lsof -nP -iTCP:3011,3012,3013,3014,3015,3016 -sTCP:LISTEN${RESET}."
  fi
  failures=$((failures + 1))
}

pending="$JOBS"
while [[ -n "$pending" ]]; do
  still_running=""
  for name in $pending; do
    if [[ -f "$LOG_DIR/$name.exit" ]]; then
      report "$name"
    else
      still_running="$still_running $name"
    fi
  done
  pending="$(echo "$still_running" | xargs)"
  [[ -n "$pending" ]] && sleep 1
done

wait

echo ""
if [[ $failures -gt 0 ]]; then
  echo -e "${RED}✖${RESET} ${BOLD}${failures} suite(s) failed.${RESET}"
  echo ""
  exit 1
fi

echo -e "${GREEN}✔${RESET} ${BOLD}All tests passed.${RESET}"
echo -e "${DIM}  Static checks are npm run verify. Temporal: npm run --workspace=backend test:temporal${RESET}"
echo ""
