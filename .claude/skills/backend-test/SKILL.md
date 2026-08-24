---
name: backend-test
description: Write backend integration tests (Vitest against a real Postgres) following project conventions. Use when creating, editing, or debugging tests under apps/backend.
allowed-tools: Read Grep Glob Edit Write Bash(npx -w backend *) Bash(npm run *) Bash(npx biome *) Bash(pgrep *)
---

## Project-Specific Setup

Backend tests are **integration tests against a real Postgres database** (`.env.test`,
`127.0.0.1:5433/proteus_test`). Repositories and services are never mocked — including in
workflow tests, which get one from the `createTestContainer` fixture. `global-setup.ts`
builds one schema per vitest worker once per run; `db-setup.ts` `TRUNCATE`s every table in
`public` before each test, so each one starts empty.

### Key files
- `apps/backend/tests/setup/test-extend.ts` — the only place `test` comes from. Fixtures: `db`, `getDb`, `logger`, `createApi`, `makeRequest`, `dto`, `factories`, `service`
- `apps/backend/tests/setup/create-api.ts` — `createApi()`: bootstrapped container + sorted routes + listening Express server
- `apps/backend/tests/setup/create-container.ts` — `createTestContainer()`: the same container with no HTTP surface
- `apps/backend/tests/setup/db-setup.ts` — the global `beforeEach` that truncates
- `apps/backend/tests/setup/global-setup.ts` — per-worker databases, built once per run
- `apps/backend/tests/setup/run-step.ts` — `step.run` / `step.runAndCompensate` for a bare workflow step
- `apps/backend/tests/setup/setup-test-env.ts` — console spy (`console.error`/`console.warn` **throw**), loaded via `setupFiles`
- `apps/backend/tests/factories/{module}-dto.ts` — DTO generators, `generateCreateXDTO(overrides?)`
- `apps/backend/tests/factories/services/` — service factories, container-first. **`cart.ts` is the reference implementation**
- `apps/backend/tests/factories/db/` — direct Drizzle inserts, used by the E2E suite (see the `e2e-test` skill)
- `apps/backend/vitest.config.ts` — aliases `@tests`, `@core`, `@framework`, `@workflows`; one worker per database

### Imports
- Import **only `test`** from `@tests/setup/test-extend.js`.
- `expect` comes from the test callback — `test('...', async ({ expect }) => {})`. Never import it.
- `vi` is the one legitimate `vitest` import (for `vi.spyOn`).
- Use `test.describe` / `test.beforeEach`, never the bare vitest equivalents.

### Naming
Tests that exercise a route live in `__tests__/` beside it and are named `{resource}.api.test.ts`.
Everything else is `{subject}.test.ts`.

### Running tests
```bash
npx -w backend dotenvx run -f ../../.env.test --quiet -- vitest run src/api/admin/products
npm run --workspace=backend test    # full suite, ~40s
npm run verify                      # gate: format, typecheck, lint, deps, src/api tests only
```
**Never run two backend test processes at once** — `globalSetup` takes an advisory lock and
the second run exits immediately naming the collision.

## Instructions

1. **Never bootstrap by hand.** No `bootstrapContainer`, `DbProvider` stub, `createExpressApp`
   or `createServer` in a test file — call `createApi`.
2. **Never resolve a service in a test — except to install a spy.** `vi.spyOn` on a resolved
   service is how a mid-workflow failure is forced, and it is the only use. Every query and
   mutation goes through `service.create.*` / `service.update.*` / `service.read.*`; a
   `container.resolve` not immediately followed by `vi.spyOn` means a factory is missing.
3. **Never write a DTO literal.** Build it with a generator and pass only the fields the test
   asserts on. A field the test does not name should be faked, not hardcoded.
4. **A factory that only forwards its arguments is not worth writing.** If it has a DTO,
   it generates one; if it has no DTO, it exists to keep `container.resolve` out of the test.
5. **Assertions must be able to fail.** No vacuous `expect`s — mutate the code and confirm
   the test bites.
6. **Run the file you changed** before moving on, then the full suite before a PR.

## Known Gotchas

### One set of databases per machine
Worker database names come from `VITEST_POOL_ID`, which restarts at 1 every run, so two
concurrent runs claim the same `proteus_test_*` databases. `globalSetup` takes an advisory lock
and fails the second run immediately — but a run started before that landed, or killed
mid-flight, can still leave strays. Check `pgrep -fl vitest` before blaming the code.

### `console.error` / `console.warn` throw
`setup-test-env.ts` spies on both and throws. When a test legitimately logs, call
`consoleError.mockImplementation(() => {})`. `console.info` is swallowed entirely — use
`process.stderr.write` when probing.

### Migrations are regenerated in place
One migration per module, same tag, never a `0001_*` file. Tests only tolerate this because
`globalSetup` drops the schema and replays every migration at the start of each run.

## Reference

For detailed patterns, consult [REFERENCE.md](REFERENCE.md):
- `createApi` options, HTTP verb helpers, and calling handlers without HTTP
- The three factory layers and when each applies
- DTO generator rules
- Service factory shape (the `cart.ts` pattern)

$ARGUMENTS
