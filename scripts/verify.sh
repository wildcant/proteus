#!/usr/bin/env bash
# Post-implementation verification gate.
#
# Formatting runs first and alone: `biome format --write` rewrites files, so it cannot
# race the suites that read them. The three read-only suites afterwards share no state,
# so they run concurrently and the wall clock collapses to the slowest one (the backend
# integration tests). Each suite's output is buffered and printed as it finishes, so the
# streams never interleave.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

JOBS="typecheck check test"

# CI mode: report formatting instead of applying it. Triggered by --ci or by the CI env
# var that every CI provider sets, so the workflow file needs no extra wiring.
ci_mode=false
[[ -n "${CI:-}" ]] && ci_mode=true

for arg in "$@"; do
  case "$arg" in
    --ci) ci_mode=true ;;
    -h | --help)
      echo "Usage: npm run verify [-- --ci]"
      echo ""
      echo "  Formats the tree, then runs typecheck, check:all and the backend API tests"
      echo "  in parallel."
      echo ""
      echo "  --ci   Fail on unformatted files instead of rewriting them."
      echo "         Implied when the CI environment variable is set."
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: npm run verify [-- --ci]" >&2
      exit 1
      ;;
  esac
done

label_of() {
  case "$1" in
    typecheck) echo "Type checking (backend, store, admin)" ;;
    check) echo "Lint, env usage & dependency rules" ;;
    test) echo "Backend API tests" ;;
  esac
}

echo ""
if [[ "$ci_mode" == true ]]; then
  # CI must not rewrite the tree: unformatted code has to fail the build rather than be
  # silently fixed here, which would also mask it from the `biome check` inside check:all.
  echo -e "${BOLD}Checking formatting${RESET} ${DIM}(CI — reporting only, no files rewritten)${RESET}"
  if ! npm run format:check; then
    echo ""
    echo -e "${RED}✖${RESET} ${BOLD}Unformatted files.${RESET}"
    echo -e "  Run ${BOLD}npm run format${RESET} locally and commit the result."
    echo ""
    exit 1
  fi
else
  echo -e "${BOLD}Formatting${RESET} ${DIM}(must finish before the checks read the files)${RESET}"
  if ! npm run format; then
    echo -e "${RED}✖${RESET} ${BOLD}Formatting failed${RESET}"
    exit 1
  fi
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
echo -e "${BOLD}Running 3 suites in parallel${RESET} ${DIM}(output appears as each finishes)${RESET}"

run_job typecheck npm run typecheck &
run_job check npm run check:all &
# Only the API tests run here — the full suite is ~96s and would dominate the gate.
run_job test npm run --workspace=backend test:api &

failures=0

report() {
  local name=$1
  local code duration
  code="$(cat "$LOG_DIR/$name.exit")"
  duration="$(cat "$LOG_DIR/$name.time")"
  echo ""
  if [[ "$code" -eq 0 ]]; then
    echo -e "${GREEN}✔${RESET} ${BOLD}$(label_of "$name")${RESET} ${DIM}(${duration}s)${RESET}"
  else
    echo -e "${RED}✖${RESET} ${BOLD}$(label_of "$name")${RESET} ${DIM}(${duration}s)${RESET}"
    cat "$LOG_DIR/$name.log"
    # The suite drops and recreates the public schema in a beforeEach against a single
    # shared database, so a second test process (an orphaned run, or an editor's test
    # watcher) corrupts this one's schema mid-flight rather than failing on its own.
    if grep -qE 'pg_namespace_nspname_index|relation "drizzle\.migrations_' "$LOG_DIR/$name.log"; then
      echo ""
      echo -e "  ${BOLD}Hint:${RESET} these errors mean another process was running tests against the same"
      echo -e "  test database. The backend suite is not safe to run twice concurrently."
      echo -e "  Check with ${BOLD}ps aux | grep vitest${RESET} and re-run once it is clear."
    fi
    failures=$((failures + 1))
  fi
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

echo -e "${GREEN}✔${RESET} ${BOLD}All checks passed.${RESET}"
echo -e "${DIM}  Only src/api tests ran. Full suite: npm run --workspace=backend test${RESET}"
echo ""
