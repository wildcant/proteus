#!/usr/bin/env bash
# Two knip passes over one config. Neither catches what the other does, so a finding in either fails.
#
#   probe injected into this repo                          pass 1   pass 2
#   unused devDependency in apps/backend/package.json      caught   missed
#   unused catalog entry in pnpm-workspace.yaml            caught   missed
#   unused fixture in apps/backend/tests/factories/        caught   missed
#   src/ file imported only from a __tests__ file          missed   caught
#
# Pass 1 counts a test import as a reference, so it cannot see the last row. Pass 2 cannot see the
# first three:
#   - devDependencies, catalog and catalogReferences are pushed onto the exclude list whenever
#     `isProduction` (knip's get-included-issue-types), and no flag adds them back;
#   - the `!tests/**!` and `!src/**/__tests__/**!` negations in knip.jsonc drop test files from the
#     production project, so production has nothing left to call unused there.
#
# `--include nsExports,nsTypes` adds to the default report instead of replacing it — knip appends its
# defaults when every `--include` is one of those two add-on types. Report is every issue type except
# `cycles`, which is dependency-cruiser's per ADR-0020. Nothing else is filtered: what is not a
# finding is written down in knip.jsonc with the reason.
#
# `--tags=-testSeam` skips exports tagged `@testSeam` — "production does not read this, a named test
# harness does". Third answer to a pass 2 finding, after deleting the code and after dropping the
# `export`.
#
# Run by hand as `pnpm -w run check:unused`. The `-w` matters: knip roots the project at the current
# directory, so from a workspace it reads neither knip.jsonc nor pnpm-workspace.yaml and reports a
# tree it was never configured for.

set -uo pipefail

cd "$(dirname "$0")/../.."

code=0

pnpm exec knip --no-progress --include nsExports,nsTypes || code=1
pnpm exec knip --no-progress --production --tags=-testSeam --include nsExports,nsTypes || code=1

exit $code
