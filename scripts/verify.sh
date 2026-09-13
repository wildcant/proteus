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
# Each gate invokes its tool directly rather than going through a `pnpm run` alias, because that
# is what lets the gate own the flags it passes. Biome is the reason it matters: a
# `useNamingConvention` warning once passed a green gate, since Biome exits 0 on warnings and an
# aggregator summing exit codes never saw it. The gate passes --error-on-warnings; plain
# `pnpm run check` stays lenient for ad-hoc use. The asymmetry is deliberate — the flags belong to
# the gate, not to package.json.
#
# Two conventions inside a job: `pnpm exec <tool>` rather than `pnpm dlx`, so the pinned workspace
# binary is always the one that runs rather than whatever the registry's latest is; and sub-checks
# joined with `|| code=1` rather than `&&`, so a single run reports every violation instead of
# stopping at the first.
#
# A gate that inspects one workspace is invoked with `pnpm --filter <name> run <script>`. Under
# pnpm the filter is not cosmetic the way `--workspace` was: `node_modules/.bin` is per-workspace,
# so a script reaches only the binaries its own package.json declares, and a gate run from the
# wrong place fails with `command not found` rather than silently borrowing the root's copy.
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
JOBS="typecheck lint standards structure versions unused generated openapi test schemas store packages"

job_typecheck() { pnpm run typecheck; }

# Warnings are failures here even though `pnpm run check` tolerates them. `pnpm exec` pins this
# to the Biome the root package.json declares — the same binary `pnpm run check` uses.
job_lint() { pnpm exec biome check --error-on-warnings .; }

# Every check runs even after one fails, so a single run reports every violation at once.
job_standards() {
  local code=0
  ./scripts/check-env-usage.sh || code=1
  # Both of these inspect exactly one workspace, so they live in it and are invoked through it. The
  # env check stays here because it spans backend and store.
  pnpm --silent --filter backend run check:errors || code=1
  pnpm --silent --filter @proteus/http-schemas run check:datetime || code=1
  # The schema rules a rule file cannot express — cascade relationships, index predicates and
  # closure reachability exist only once drizzle has built the table, so this one imports the
  # models. standards/README.md carries the per-check verdict; the ones that were expressible have
  # already moved. See apps/backend/scripts/checks/run.ts.
  pnpm --silent --filter backend run check:schema || code=1
  # Replay purity — the rule the Temporal adapter rests on. Parses the workflow handlers, so it
  # cannot be a grep. See apps/backend/scripts/replay-purity.ts.
  pnpm --silent --filter backend run check:workflow-purity || code=1
  # The standards — what a file's contents must look like, across both frontends, the backend's
  # routes and workflows, and its models. Lives at the root like the env check because it spans
  # workspaces. ast-grep matches the syntax tree rather than
  # lines: a hook forwarding one callback and swallowing the other reads as compliant to any
  # line-wise pattern. `--error=unused-suppression` fails the run when an `ast-grep-ignore` outlives
  # the code it exempted. See standards/README.md for the rule tree.
  pnpm --silent run check:standards || code=1
  # The rules' own tests. A rule that stops matching its `invalid` case prints exactly what a clean
  # codebase prints, and this is what tells the two apart.
  pnpm --silent run check:standards:test || code=1
  return $code
}

# Route trees are checked by content rather than by regeneration, and both apps are checked the same
# way. Two different generators write this file — the `tsr generate` CLI and the router vite plugin —
# and they order the same imports differently, so "run the generator and compare" reports drift
# according to which one wrote it last. Worse, `pnpm dev` regenerates it on every route change, so
# the answer would depend on whether a dev server happened to be running. Both were observed: the
# admin tree alternates between two byte-different-but-equivalent files depending on which generator
# touched it.
#
# So ask the ordering-insensitive question instead — does the tree reference every route file that
# exists? That is the failure that actually bites (a route added, the tree not regenerated), no
# generator disagrees about it, and reading cannot race a writer. The reverse direction needs no
# check: a reference to a route file that was deleted is a broken import, which job_typecheck
# already fails on.
check_route_tree() {
  local label=$1 routes_dir=$2 tree=$3 code=0 file rel
  while IFS= read -r file; do
    rel="${file#"$routes_dir"/}"
    rel="${rel%.tsx}"
    if ! grep -qF "'./routes/${rel}'" "$tree"; then
      echo "$label: src/routes/${rel}.tsx has no entry in routeTree.gen.ts — run its generate-routes"
      code=1
    fi
  done < <(find "$routes_dir" -type f -name '*.tsx')
  return $code
}

# Whether a committed generated file is still what its generator would produce. A failure here is
# not a code problem — it says to re-run a generator — which is why these do not sit in
# job_standards. The four --check generators below never write, so they behave the same here and
# under --ci; the Orval clients and both route trees have no --check of their own and are
# established by the serial step before the parallel batch instead. See regenerate_check.
job_generated() {
  local code=0
  # Decided by regenerate_check during the prologue, because establishing it means running a
  # generator that rewrites files this job's neighbours are reading. Reported here so that all of
  # generated-file currency still has exactly one gate.
  if [ -n "$REGEN_DRIFT" ]; then
    printf '%s' "$REGEN_DRIFT"
    code=1
  fi
  # The Worker's workflow list is generated from src/workflows/ rather than typed by hand, so this
  # is the step that notices when the two have drifted. See scripts/generate-workflow-registry.ts.
  pnpm --silent --filter backend run check:workflow-registry || code=1
  # The event bus dispatches subscribers from a generated import list for the same reasons, so it
  # drifts the same way. See scripts/generate-subscriber-registry.ts.
  pnpm --silent --filter backend run check:subscriber-registry || code=1
  # The cron Worker's job list, third of the same kind — and the one where drift costs the most,
  # since that list is also the desired state reconciliation deletes schedules against. See
  # scripts/generate-job-registry.ts.
  pnpm --silent --filter backend run check:job-registry || code=1
  # The module half of the drizzle schema is one `export *` per model file, so a new model reaches
  # drizzle only once it is regenerated. See scripts/generate-schema.ts.
  pnpm --silent --filter backend run check:schema-registry || code=1
  # Both route trees, by content — see check_route_tree for why not by regeneration. These read and
  # never write, so unlike the Orval check they are safe to run here in the parallel batch.
  check_route_tree "The admin route tree" apps/admin/src/routes apps/admin/src/routeTree.gen.ts || code=1
  check_route_tree "The store route tree" apps/store/src/routes apps/store/src/routeTree.gen.ts || code=1
  # The store is a TanStack Start app, so its tree ends in a footer registering getRouter and
  # startInstance. Only the vite plugin emits that block: `tsr generate` drops it, and losing it
  # leaves src/router.tsx and src/start.ts referenced by nothing, which job_unused then reports as
  # dead files. That is a real regression someone can commit, so assert the block rather than
  # trusting it — `apps/store`'s own `generate-routes` script is what removes it.
  if ! grep -q "declare module '@tanstack/react-start'" apps/store/src/routeTree.gen.ts; then
    echo "The store route tree has lost its '@tanstack/react-start' registration footer — regenerate it with a vite build, not with \`pnpm --filter store run generate-routes\`"
    code=1
  fi
  return $code
}

# Spectral against both committed specs. Every rule the ruleset declares is `error`, and the
# specs report nothing at any severity — so --fail-severity=error currently behaves the same as
# job_lint's --error-on-warnings. It stays explicit because the inherited `spectral:oas` rules
# keep their own severities, and one of those firing should not fail the gate.
job_openapi() { pnpm --silent --filter backend run check:openapi; }

# The bounded primitives in @proteus/http-schemas. The package had no tests before the request
# bodies were bounded; this is where the chosen ceilings are written down as behaviour rather
# than as configuration, so a change to one is a failing test rather than a silent widening.
job_schemas() { pnpm --filter @proteus/http-schemas run test; }

job_structure() {
  local code=0
  pnpm --filter backend run check:structure || code=1
  pnpm --filter admin run check:structure || code=1
  pnpm --filter store run check:structure || code=1
  return $code
}

# That a package a workspace declares is installed at one version. A separate job from `structure`
# on purpose: that one is about which file may import which, this one is about what the lockfile
# resolved, and the two fail for unrelated reasons. Reads pnpm-lock.yaml directly rather than
# asking pnpm, because the answer has to come from the artefact that records the resolution —
# syncpack and manypkg compare manifests and are blind to the case that broke the build, where our
# own declarations agree and a third party's exact pin splits the package anyway. Offline, ~40ms.
# See scripts/checks/one-version.mts; its `accepted` map carries the reason for each split we keep.
job_versions() { node scripts/checks/one-version.mts; }

# The inverse of `versions`: that a package a workspace declares is referenced by that workspace.
# Nothing else here can make that claim. The strict pnpm layout and `typecheck` catch an undeclared
# *import*, because the module is genuinely missing; a declaration nothing imports installs and
# resolves perfectly. dependency-cruiser reads source and reports import to import, never walking a
# manifest in the unused direction. Biome has no unused rule, and a file-at-a-time linter cannot
# make a whole-project claim anyway. `versions` only visits packages the lockfile resolved twice,
# and an unused declaration resolves to exactly one version.
#
# A tool rather than a script — the sibling `one-version.mts` is 40 lines because its claim is a
# regex over a lockfile, while this one needs a real module graph. All four of the things a naive
# script would get wrong are in this tree: `@import "tailwindcss"` in a stylesheet is a reference;
# src/providers/* is reached by string and never imported; drizzle-kit is invoked inside a nested
# `sh -c`; and a commented-out import must not count. Getting any of those wrong makes a gate that
# lies in the expensive direction — red on something real, so you delete what the build needs.
#
# The whole report, with no `include` filter, so the claim is wider than the paragraph above: no
# unused file, export or type either. The widening was earned rather than chosen — knip's first wide
# run was 436 findings, and the triage in .scratch/pnpm-migration/knip-triage.md turned them into
# config (Orval's output, four entry points nothing imports), barrels the repo never went through,
# `export` written on autopilot for ninety file-local symbols, and ports for operations no service
# has. The tree reaches zero, which is the only moment holding every issue type is free.
#
# `catalog` is the row one-version.mts structurally cannot see: it iterates packages that manifests
# declare, so an entry left behind after the last declaration goes has no declaration site and is
# never visited — and this gate is what creates them, since resolving its findings removes
# declarations. `catalogReferences` sits behind an outright install error, and `cycles` is not in
# knip's default report and stays dependency-cruiser's, per ADR-0020. Note that knip's
# `duplicates` is duplicate *exports*, not duplicate versions — it reads like this gate's neighbour
# and is not.
#
# knip.jsonc carries the entry patterns and is where a judgment call goes: a package that is needed
# but unreferenced belongs in `ignoreDependencies` with a comment saying why, the same discipline as
# one-version.mts's `accepted` map. The gate never passes --fix; which declaration to delete is the
# question it exists to surface. ~3s, offline.
#
# Through the root `check:unused` alias rather than invoking knip directly, because the flags here
# and the flags for ad-hoc use are the same — there is no asymmetry for the gate to own, so one
# definition beats two. Run it by hand as `pnpm -w run check:unused`, and note the `-w`: knip roots
# its project at the current directory, so from a workspace directory it finds neither `knip.jsonc`
# nor `pnpm-workspace.yaml` and reports a tree it was never configured for — unresolvable `catalog:`
# references from `packages/utils`, 41 unreachable files from `apps/backend`. No config can fix
# that, because the failure is that the config was not read.
job_unused() { pnpm --silent run check:unused; }

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
# answer is `pnpm --filter backend run test` before opening a PR, not a slower gate. If speed
# comes up again the leverage is in the per-test schema recreation in tests/setup/db-setup.ts, not
# in more parallelism: measured at the time the split was made, the checks were 3.5s serial against
# 96s of tests.
job_test() { pnpm --filter backend run test:gate; }

# The admin's pure logic — the variant matrix the create wizard enumerates and what the options
# drawer says a change will destroy. No database and no browser, so it runs alongside the rest.
# job_admin() { pnpm --filter admin run test; }

# The store's two fast levels: pure logic in node, and components rendered in a real Chromium via
# Vitest Browser Mode. The browser project is in the gate rather than left to Playwright because it
# needs no server, no database and no fixtures — it mounts a component with props — so it costs the
# gate ~3s and catches the render rules that used to be asserted through a stubbed API. It is the
# only job here that needs a browser binary; the hint below is for a checkout that has not installed
# one yet.
job_store() { pnpm --filter store run test; }

# The shared formatters. They are the one place a change lands on both applications at once — the
# storefront asks them for a market's punctuation, the admin asks them for none — so the claim they
# carry is that omitting a locale still prints exactly what it printed before.
job_packages() { pnpm --filter @proteus/utils run test; }

# CI mode: report formatting instead of applying it. Triggered by --ci or by the CI env
# var that every CI provider sets, so the workflow file needs no extra wiring.
ci_mode=false
[[ -n "${CI:-}" ]] && ci_mode=true

for arg in "$@"; do
  case "$arg" in
    # npm swallowed the `--` that separated its own flags from the script's; pnpm forwards it
    # verbatim, so `pnpm verify -- --ci` arrives here as two arguments. Ignored rather than
    # rejected, because that is the form five years of npm muscle memory produces.
    --) ;;
    --ci) ci_mode=true ;;
    -h | --help)
      echo "Usage: pnpm verify [--ci]"
      echo ""
      echo "  Formats the tree, then runs typecheck, lint, the code standards, the import"
      echo "  structure rules, version alignment, dependency usage, generated-file currency, the"
      echo "  backend API tests and the store's unit and component tests in parallel."
      echo ""
      echo "  --ci   Fail on unformatted files instead of rewriting them."
      echo "         Implied when the CI environment variable is set."
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: pnpm verify [--ci]" >&2
      exit 1
      ;;
  esac
done

label_of() {
  case "$1" in
    typecheck) echo "Type checking (root scripts, three apps, four packages)" ;;
    lint) echo "Lint & format rules (warnings fail)" ;;
    standards) echo "Code standards" ;;
    structure) echo "Import structure (backend, admin, store)" ;;
    versions) echo "One version per declared dependency" ;;
    unused) echo "Nothing declared or exported is unreferenced" ;;
    generated) echo "Generated files (registries, schema, Orval clients, route trees)" ;;
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
  if ! pnpm run format:check; then
    echo ""
    echo -e "${RED}✖${RESET} ${BOLD}Unformatted files.${RESET}"
    echo -e "  Run ${BOLD}pnpm run format${RESET} locally and commit the result."
    echo ""
    exit 1
  fi
else
  echo -e "${BOLD}Formatting${RESET} ${DIM}(must finish before the checks read the files)${RESET}"
  if ! pnpm run format; then
    echo -e "${RED}✖${RESET} ${BOLD}Formatting failed${RESET}"
    exit 1
  fi
fi

# Orval's clients and both route trees have no `--check` mode: the only way to learn whether the
# committed output is current is to run the generator and see whether anything moved. That writes to
# the working tree — so, like formatting above and for the same reason, it happens here, alone,
# rather than inside the parallel batch where typecheck, lint and structure are reading those same
# files. Both generators are deterministic (regenerating twice running produces identical bytes), so
# a difference means the committed output is stale, not that the generator is noisy.
#
# Whatever was there is put back either way: this reports drift, it does not fix it, which is the
# same contract as the four `--check` generators in job_generated.
#
# The store needed one thing before it could be gated at all, and `apps/store/tsr.config.json` is
# where it lives because JSON cannot hold the comment. The store is a TanStack Start app, so its
# route tree ends in a `declare module '@tanstack/react-start'` block registering getRouter and
# startInstance — and that block is a *footer*, appended by the `tanstackStart()` vite plugin
# through the generator's `routeTreeFileFooter` option (see start-plugin-core's
# buildRouteTreeFileFooter). The `tsr generate` CLI reads only tsr.config.json, so it knew nothing
# about the footer and regenerated the file without it, which deletes the only reference to
# src/router.tsx and src/start.ts and makes knip call them dead files. Declaring the same footer
# statically in tsr.config.json makes the CLI and the vite build produce byte-identical output —
# verified by running a real `vite build` and diffing — so the gate and a dev session agree.
# The admin needs none of this: it is a plain SPA, so the CLI is already its whole generator.
REGEN_DRIFT=""
regenerate_check() {
  local label=$1 generator=$2
  shift 2
  local snapshot path
  snapshot="$(mktemp -d)"
  tar cf - "$@" | (cd "$snapshot" && tar xf -)
  if ! eval "$generator" >/dev/null 2>&1; then
    REGEN_DRIFT="${REGEN_DRIFT}${label}: the generator itself failed — run \`${generator}\`"$'\n'
  else
    for path in "$@"; do
      if ! diff -rq "$snapshot/$path" "$path" >/dev/null 2>&1; then
        REGEN_DRIFT="${REGEN_DRIFT}${label} — not what the generator produces. Run \`${generator}\` and commit the result"$'\n'
        break
      fi
    done
  fi
  # Delete before restoring, so a generator that *added* a file does not leave it behind for
  # someone to commit by accident. The snapshot is the authority on what was there.
  rm -rf "$@"
  tar cf - -C "$snapshot" . | tar xf -
  rm -rf "$snapshot"
}

echo -e "${BOLD}Regenerating${RESET} ${DIM}(writes in place, so it must finish before the checks read the files)${RESET}"
regenerate_check "The Orval clients" "pnpm run openapi:generate" \
  apps/admin/src/api/generated apps/store/src/api/generated


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
      echo -e "  ${BOLD}Hint:${RESET} run ${BOLD}pnpm --filter store exec playwright install chromium${RESET} once, then re-run."
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
echo -e "${DIM}  Only src/api, component and pure unit tests ran. Everything else: pnpm run verify:full${RESET}"
echo ""
