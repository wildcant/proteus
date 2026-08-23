---
name: backend-test
description: Write backend integration tests (Vitest against a real Postgres) following project conventions. Use when creating, editing, or debugging tests under apps/backend.
allowed-tools: Read Grep Glob Edit Write Bash(npx -w backend *) Bash(npm run *) Bash(npx biome *) Bash(pgrep *)
---

## Project-Specific Setup

Backend tests are **integration tests against a real Postgres database** (`.env.test`,
`127.0.0.1:5433/proteus_test`). Repositories and services are never mocked. `db-setup.ts`
drops and re-migrates every module's schema before *every* test, so each one starts empty.

### Key files
- `apps/backend/tests/setup/test-extend.ts` — the only place `test` comes from. Fixtures: `db`, `getDb`, `logger`, `createApi`, `makeRequest`, `dto`, `factories`, `service`
- `apps/backend/tests/setup/create-api.ts` — `createApi()`: bootstrapped container + sorted routes + listening Express server
- `apps/backend/tests/setup/db-setup.ts` — the global `beforeEach` that drops and re-migrates
- `apps/backend/tests/setup/setup-test-env.ts` — console spy (`console.error`/`console.warn` **throw**), loaded via `setupFiles`
- `apps/backend/tests/factories/{module}-dto.ts` — DTO generators, `generateCreateXDTO(overrides?)`
- `apps/backend/tests/factories/services/` — service factories, container-first. **`cart.ts` is the reference implementation**
- `apps/backend/tests/factories/db/` — direct Drizzle inserts, used by the E2E suite (see the `e2e-test` skill)
- `apps/backend/tests/utils/make-request.ts` — builds an `HttpRequest`, for middleware/auth unit tests that call a handler directly
- `apps/backend/vitest.config.ts` — aliases `@tests`, `@core`, `@framework`, `@workflows`; `fileParallelism: false`

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
npm run --workspace=backend test    # full suite, ~190s
npm run verify                      # gate: format, typecheck, lint, deps, src/api tests only
```
**Never run two backend test processes at once** — see Known Gotchas.

## Instructions

1. **Never bootstrap by hand.** No `bootstrapContainer`, `DbProvider` stub, `createExpressApp`
   or `createServer` in a test file — call `createApi`.
2. **Never resolve a service in a test.** No `container.resolve(...)` in a `__tests__` file —
   go through `service.create.*` / `service.update.*` / `service.read.*`.
3. **Never write a DTO literal.** Build it with a generator and pass only the fields the test
   asserts on. A field the test does not name should be faked, not hardcoded.
4. **A factory that only forwards its arguments is not worth writing.** If it has a DTO,
   it generates one; if it has no DTO, it exists to keep `container.resolve` out of the test.
5. **Assertions must be able to fail.** No vacuous `expect`s — mutate the code and confirm
   the test bites.
6. **Run the file you changed** before moving on, then the full suite before a PR.

## Known Gotchas

### One shared database
Every backend test process uses the same `proteus_test` database, and `db-setup.ts` drops the
schema in a `beforeEach`. A second process — another terminal, a VS Code Vitest watcher, or a
backgrounded run you forgot about — corrupts both. The signatures are
`duplicate key value ... "pg_namespace_nspname_index"` and
`relation "drizzle.migrations_<module>" does not exist`, and they read as mass code breakage.

Check `pgrep -fl vitest` before blaming the code, then re-run alone.

### `console.error` / `console.warn` throw
`setup-test-env.ts` spies on both and throws. When a test legitimately logs, call
`consoleError.mockImplementation(() => {})`. `console.info` is swallowed entirely — use
`process.stderr.write` when probing.

### Migrations are regenerated in place
One migration per module, same tag, never a `0001_*` file. Tests only tolerate this because
every test starts from a dropped schema.

## Reference

For detailed patterns, consult [REFERENCE.md](REFERENCE.md):
- `createApi` options, HTTP verb helpers, and calling handlers without HTTP
- The three factory layers and when each applies
- DTO generator rules
- Service factory shape (the `cart.ts` pattern)

$ARGUMENTS
