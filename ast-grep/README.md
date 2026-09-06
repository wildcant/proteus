# Code-shape rules

The counterpart to the dependency rules in each app's `deps-analyzer/.dependency-cruiser.cjs`.
Those say which file may import which; these say what a file's *contents* must look like. Both are
declarative, both run in the `conventions` job of `npm run verify`, and neither is a script.

```bash
npm run check:code-shape        # scan the repo
npm run check:code-shape:test   # run the rules' own tests
```

## Where a rule goes

The tree mirrors the code it governs, so a rule has an obvious home before anyone has to ask.
`frontend/` is the shape both SPAs share — [bulletproof-react's project
structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md),
which `apps/store` and `apps/admin` both follow — minus the `src/` segment, which is the same for
every rule and so never tells two of them apart.

```
ast-grep/
  rules/
    frontend/
      features/
        api/          query and mutation hooks         → docs/query-hooks.md,
                                                          docs/mutation-hooks.md
        hooks/        form hooks                       → docs/form-hooks.md
        components/   feature-specific UI
      components/     shared UI
      lib/            fetcher, form-hook, query keys
    backend/
      modules/        models, repositories, services   → docs/adding-a-module.md
      api/            route files                      → docs/middleware-and-openapi.md
      workflows/      steps and compensation
  rule-tests/
    <same tree>/<rule-id>-test.yml
    __snapshots__/    flat — ast-grep keys these by rule id, not by path
```

A directory appears when its first rule does. Rules that span both frontends live under
`frontend/`; a rule for only one app says so in its own `files:` glob.

## Writing one

One rule per file, named for its id, and every rule owns a test holding the code it must flag and
the code it must not:

```
ast-grep/rules/frontend/features/api/mutation-hook-missing-on-error.yml
ast-grep/rule-tests/frontend/features/api/mutation-hook-missing-on-error-test.yml
```

`check:code-shape:test` fails when a rule stops matching its own `invalid` case. That is the point
of the test: a check that has silently stopped matching prints exactly what a clean codebase
prints, and this is what tells the two apart.

Rule ids are global — the folder is for humans, the `files:` glob is what the tool enforces. Keep
the two saying the same thing; the directory is not a filter.

## Exempting a site

Suppress by id, with the reason written above it:

```ts
// The failed row renders its own retryable message, so a toast would be the same news told twice.
// ast-grep-ignore: mutation-hook-missing-error-toast
onError: (...args) => {
  onError?.(...args)
},
```

The suppression names one rule and silences only that rule — the same handler still fails every
other rule. A misspelt id suppresses nothing. And `check:code-shape` passes
`--error=unused-suppression`, so the build fails the day an exemption outlives the code it was
written for.
