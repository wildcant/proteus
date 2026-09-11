#!/usr/bin/env bash
# Post-implementation verification gate.
#
# Formatting runs first and alone: `biome format --write` rewrites files, so it cannot
# race the gates that read them. The read-only gates afterwards share no state, so they
# run concurrently and the wall clock collapses to the slowest one (the backend integration
# tests). Each gate's output is buffered and printed as it finishes, so the streams never
# interleave.
#
# The job list below is the single definition of what "checked" means for this repo. A new
# project-wide check belongs in JOBS and in label_of, or it runs nowhere: nothing else aggregates
# checks, and the root `check:all` that used to was deleted for that reason.
#
# Each gate invokes its tool directly rather than going through an `npm run` alias, because that
# is what lets the gate own the flags it passes. Biome is the reason it matters: a
# `useNamingConvention` warning once passed a green gate, since Biome exits 0 on warnings and an
# aggregator summing exit codes never saw it. The gate passes --error-on-warnings; plain
# `npm run check` stays lenient for ad-hoc use. The asymmetry is deliberate — the flags belong to
# the gate, not to package.json.
#
# Two conventions inside a job: `npm exec -- <tool>` rather than `npx`, so the pinned workspace
# binary is always the one that runs; and sub-checks joined with `|| code=1` rather than `&&`, so a
# single run reports every violation instead of stopping at the first.
#
# After changing a gate, prove it bites: reintroduce the violation, confirm the gate goes red,
# then restore it. A check that has silently stopped matching prints exactly what a clean tree
# prints.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

# Commenting a gate out means dropping its name from here as well as its `job_*` function and
# label — this string is what the loop iterates, and a name with no function behind it fails the
# run with an empty label rather than being skipped.
JOBS="typecheck lint standards structure generated openapi test schemas store packages"

job_typecheck() { npm run typecheck; }

# Warnings are failures here even though `npm run check` tolerates them. `npm exec` pins this
# to the Biome in the workspace's node_modules — the same binary `npm run check` uses.
job_lint() { npm exec -- biome check --error-on-warnings .; }

# Every check runs even after one fails, so a single run reports every violation at once.
job_standards() {
  local code=0
  ./scripts/check-env-usage.sh || code=1
  # Both of these inspect exactly one workspace, so they live in it and are invoked through it. The
  # env check stays here because it spans backend and store.
  npm run --workspace=backend --silent check:errors || code=1
  npm run --workspace=@proteus/http-schemas --silent check:datetime || code=1
  # The schema rules a rule file cannot express — cascade relationships, index predicates and
  # closure reachability exist only once drizzle has built the table, so this one imports the
  # models. standards/README.md carries the per-check verdict; the ones that were expressible have
  # already moved. See apps/backend/scripts/checks/run.ts.
  npm run --workspace=backend --silent check:schema || code=1
  # Replay purity — the rule the Temporal adapter rests on. Parses the workflow handlers, so it
  # cannot be a grep. See apps/backend/scripts/replay-purity.ts.
  npm run --workspace=backend --silent check:workflow-purity || code=1
  # The standards — what a file's contents must look like, across both frontends, the backend's
  # routes and workflows, and its models. Lives at the root like the env check because it spans
  # workspaces. ast-grep matches the syntax tree rather than
  # lines: a hook forwarding one callback and swallowing the other reads as compliant to any
  # line-wise pattern. `--error=unused-suppression` fails the run when an `ast-grep-ignore` outlives
  # the code it exempted. See standards/README.md for the rule tree.
  npm run --silent check:standards || code=1
  # The rules' own tests. A rule that stops matching its `invalid` case prints exactly what a clean
  # codebase prints, and this is what tells the two apart.
  npm run --silent check:standards:test || code=1
  return $code
}

# Whether a committed generated file is still what its generator would produce. A failure here is
# not a code problem — it says to re-run a generator — which is why these two do not sit in
# job_standards. --check never writes, so both behave the same here and under --ci.
job_generated() {
  local code=0
  # The Worker's workflow list is generated from src/workflows/ rather than typed by hand, so this
  # is the step that notices when the two have drifted. See scripts/generate-workflow-registry.ts.
  npm run --workspace=backend --silent check:workflow-registry || code=1
  # The event bus dispatches subscribers from a generated import list for the same reasons, so it
  # drifts the same way. See scripts/generate-subscriber-registry.ts.
  npm run --workspace=backend --silent check:subscriber-registry || code=1
  return $code
}

# Spectral against both committed specs. Every rule the ruleset declares is `error`, and the
# specs report nothing at any severity — so --fail-severity=error currently behaves the same as
# job_lint's --error-on-warnings. It stays explicit because the inherited `spectral:oas` rules
# keep their own severities, and one of those firing should not fail the gate.
job_openapi() { npm run --workspace=backend --silent check:openapi; }

# The bounded primitives in @proteus/http-schemas. The package had no tests before the request
# bodies were bounded; this is where the chosen ceilings are written down as behaviour rather
# than as configuration, so a change to one is a failing test rather than a silent widening.
job_schemas() { npm run --workspace=@proteus/http-schemas test; }

job_structure() {
  local code=0
  npm run --workspace=backend check:structure || code=1
  npm run --workspace=admin check:structure || code=1
  npm run --workspace=store check:structure || code=1
  return $code
}

# The API tests plus the unit tests worth gating — the option-combination matrix, the Stripe
# adapter's currency and status tables, which decide what a shopper is charged, the platform
# adapters, which decide whether a webhook signature can be verified at all, and the event bus,
# whose pin probe is what says the suite published through the adapter it claims to. The full
# suite is ~96s and would dominate the gate. One vitest process, not two: every backend test file
# pulls in db-setup, and the suite is not safe to run twice concurrently against the shared test
# database.
#
# The scope is narrowed on purpose, so do not quietly widen it "to be safe" — the logic lives in
# src/modules and src/workflows, and the gate can miss a service-layer regression by design. The
# answer is `npm run --workspace=backend test` before opening a PR, not a slower gate. If speed
# comes up again the leverage is in the per-test schema recreation in tests/setup/db-setup.ts, not
# in more parallelism: measured at the time the split was made, the checks were 3.5s serial against
# 96s of tests.
job_test() { npm run --workspace=backend test:gate; }

# The admin's pure logic — the variant matrix the create wizard enumerates and what the options
# drawer says a change will destroy. No database and no browser, so it runs alongside the rest.
# job_admin() { npm run --workspace=admin test; }

# The store's two fast levels: pure logic in node, and components rendered in a real Chromium via
# Vitest Browser Mode. The browser project is in the gate rather than left to Playwright because it
# needs no server, no database and no fixtures — it mounts a component with props — so it costs the
# gate ~3s and catches the render rules that used to be asserted through a stubbed API. It is the
# only job here that needs a browser binary; the hint below is for a checkout that has not installed
# one yet.
job_store() { npm run --workspace=store test; }

# The shared formatters. They are the one place a change lands on both applications at once — the
# storefront asks them for a market's punctuation, the admin asks them for none — so the claim they
# carry is that omitting a locale still prints exactly what it printed before.
job_packages() { npm run --workspace=@proteus/utils test; }

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
      echo "  Formats the tree, then runs typecheck, lint, the code standards, the import"
      echo "  structure rules, generated-file currency, the backend API tests and the store's"
      echo "  unit and component tests in parallel."
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
    standards) echo "Code standards" ;;
    structure) echo "Import structure (backend, admin, store)" ;;
    generated) echo "Generated registries (workflow, subscriber)" ;;
    openapi) echo "OpenAPI spec rules (Spectral)" ;;
    test) echo "Backend API tests" ;;
    # admin) echo "Admin unit tests" ;;
    schemas) echo "Request-schema bound tests" ;;
    store) echo "Store unit + component tests" ;;
    packages) echo "Shared package unit tests (utils)" ;;
  esac
}

echo ""
if [[ "$ci_mode" == true ]]; then
  # CI must not rewrite the tree: unformatted code has to fail the build rather than be
  # silently fixed here, which would also mask it from the lint gate's `biome check`.
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
echo -e "${BOLD}Running ${job_count} gates in parallel${RESET} ${DIM}(output appears as each finishes)${RESET}"

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
    # VITEST_POOL_ID restarts at 1 every run, so a second run claims the same proteus_test_1..N
    # databases as this one. globalSetup takes an advisory lock and refuses rather than corrupting;
    # this surfaces that refusal, which otherwise scrolls past inside a gate's buffered log.
    if grep -q 'already holds the test databases' "$LOG_DIR/$name.log"; then
      echo ""
      echo -e "  ${BOLD}Hint:${RESET} another vitest run holds the test databases. The backend suite is not"
      echo -e "  safe to run twice concurrently — an editor watcher (vitest-vscode) is the usual culprit."
      echo -e "  Find it with ${BOLD}pgrep -fl vitest${RESET} and re-run once it is clear."
    fi
    # The component tests render in a real Chromium, which a fresh checkout has not downloaded.
    if grep -q "Executable doesn't exist" "$LOG_DIR/$name.log"; then
      echo ""
      echo -e "  ${BOLD}Hint:${RESET} run ${BOLD}npx playwright install chromium${RESET} once, then re-run."
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
  echo -e "${RED}✖${RESET} ${BOLD}${failures} gate(s) failed.${RESET}"
  echo ""
  exit 1
fi

echo -e "${GREEN}✔${RESET} ${BOLD}All checks passed.${RESET}"
echo -e "${DIM}  Only src/api, component and pure unit tests ran. Everything else: npm run verify:full${RESET}"
echo ""
