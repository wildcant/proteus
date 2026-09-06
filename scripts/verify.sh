#!/usr/bin/env bash
# Post-implementation verification gate.
#
# Formatting runs first and alone: `biome format --write` rewrites files, so it cannot
# race the suites that read them. The read-only suites afterwards share no state, so they
# run concurrently and the wall clock collapses to the slowest one (the backend integration
# tests). Each suite's output is buffered and printed as it finishes, so the streams never
# interleave.
#
# The job list below is the single definition of what "checked" means for this repo — each
# suite invokes its tool directly so the gate owns the flags it passes. Biome is the reason:
# it needs --error-on-warnings here, while plain `npm run check` stays lenient for ad-hoc use.
# A new project-wide check belongs in this list; nothing else aggregates them.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

JOBS="typecheck lint conventions deps test admin store"

job_typecheck() { npm run typecheck; }

# Warnings are failures here even though `npm run check` tolerates them. `npm exec` pins this
# to the Biome in the workspace's node_modules — the same binary `npm run check` uses.
job_lint() { npm exec -- biome check --error-on-warnings .; }

# Every check runs even after one fails, so a single run reports every violation at once.
job_conventions() {
  local code=0
  ./scripts/check-env-usage.sh || code=1
  # Both of these inspect exactly one workspace, so they live in it and are invoked through it. The
  # env check stays here because it spans backend and store.
  npm run --workspace=backend --silent check:errors || code=1
  npm run --workspace=@proteus/http-schemas --silent check:datetime || code=1
  # Schema rules that grep cannot express — cascade relationships and index predicates only
  # exist once drizzle has built the table, so this one imports the models. See
  # apps/backend/scripts/checks/run.ts.
  npm run --workspace=backend --silent check:schema || code=1
  # Replay purity — the rule the Temporal adapter rests on. Parses the workflow handlers, so it
  # cannot be a grep. See apps/backend/scripts/replay-purity.ts.
  npm run --workspace=backend --silent check:workflow-purity || code=1
  # The Worker's workflow list is generated from src/workflows/ rather than typed by hand, so this
  # is the step that notices when the two have drifted. --check never writes, so it behaves the same
  # here and under --ci. See scripts/generate-workflow-registry.ts.
  npm run --workspace=backend --silent check:workflow-registry || code=1
  # Code-shape rules — the mutation-hook contract in docs/mutation-hooks.md today. Spans store and
  # admin, so it lives at the root like the env check. ast-grep matches the syntax tree rather than
  # lines: a hook forwarding one callback and swallowing the other reads as compliant to any
  # line-wise pattern. `--error=unused-suppression` fails the run when an `ast-grep-ignore` outlives
  # the code it exempted. See ast-grep/README.md for the rule tree.
  npm run --silent check:code-shape || code=1
  # The rules' own tests. A rule that stops matching its `invalid` case prints exactly what a clean
  # codebase prints, and this is what tells the two apart.
  npm run --silent check:code-shape:test || code=1
  return $code
}

job_deps() {
  local code=0
  npm run --workspace=backend check:deps || code=1
  npm run --workspace=admin check:deps || code=1
  npm run --workspace=store check:deps || code=1
  return $code
}

# The API tests plus the unit tests worth gating — the option-combination matrix, the Stripe
# adapter's currency and status tables, which decide what a shopper is charged, and the platform
# adapters, which decide whether a webhook signature can be verified at all. The full
# suite is ~96s and would dominate the gate. One vitest process, not two: every backend test file
# pulls in db-setup, and the suite is not safe to run twice concurrently against the shared test
# database.
job_test() { npm run --workspace=backend test:gate; }

# The admin's pure logic — the variant matrix the create wizard enumerates and what the options
# drawer says a change will destroy. No database and no browser, so it runs alongside the rest.
job_admin() { npm run --workspace=admin test; }

# The store's pure logic — the shopper-facing payment copy, whose bucketing rule decides whether
# a declined card tells a prober which decline it was. No browser, so it runs alongside the rest;
# the rendered payment step is Playwright's, which the gate does not run.
job_store() { npm run --workspace=store test; }

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
      echo "  Formats the tree, then runs typecheck, lint, convention checks, dependency"
      echo "  rules and the backend API tests in parallel."
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
    lint) echo "Lint & format rules (warnings fail)" ;;
    conventions) echo "Env usage, error, schema & code-shape conventions" ;;
    deps) echo "Dependency rules (backend, admin, store)" ;;
    test) echo "Backend API tests" ;;
    admin) echo "Admin unit tests" ;;
    store) echo "Store unit tests" ;;
  esac
}

echo ""
if [[ "$ci_mode" == true ]]; then
  # CI must not rewrite the tree: unformatted code has to fail the build rather than be
  # silently fixed here, which would also mask it from the lint suite's `biome check`.
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
job_count="$(echo "$JOBS" | wc -w | xargs)"
echo -e "${BOLD}Running ${job_count} suites in parallel${RESET} ${DIM}(output appears as each finishes)${RESET}"

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
echo -e "${DIM}  Only src/api and pure unit tests ran. Full suite: npm run --workspace=backend test${RESET}"
echo ""
