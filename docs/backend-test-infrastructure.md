# Backend Test Infrastructure

How the backend test suite is built and why it is shaped this way. For *writing* a test — the
factory rules, assertion conventions, the `createApi` verbs — see the `backend-test` skill
(`.claude/skills/backend-test/`). This document is the layer underneath: what runs before your
test does, and which decisions were measured rather than guessed.

Merged from three superseded docs: the `createApi` refactor plan, the workflow-tests-on-real-modules
plan, and the migration-cost/parallelism research.

**Current shape:** 55 files, 612 tests, ~40s wall clock. `npm run verify` runs `src/api` and pure
unit tests only (~20s); the full suite is `npm run --workspace=backend test`.

## The pieces

| File | Job |
|---|---|
| `tests/setup/global-setup.ts` | Once per run: claim the advisory lock, create the per-worker databases, drop and migrate each |
| `tests/setup/database-url.ts` | `WORKER_COUNT` and `withWorkerDatabase()` — the single source of truth for how many workers may exist |
| `tests/setup/db-migrations.ts` | The list of migration folders, shared by `globalSetup` and any script that needs it |
| `tests/setup/db-setup.ts` | The global `beforeEach` that `TRUNCATE`s, plus the `db` the fixtures capture |
| `tests/setup/setup-test-env.ts` | Console spy — `console.error` / `console.warn` **throw** |
| `tests/setup/create-container.ts` | `createTestContainer()` — the real DI container, no HTTP |
| `tests/setup/create-api.ts` | `createApi()` — that container plus sorted routes and a listening server |
| `tests/setup/run-step.ts` | `step.run` / `step.runAndCompensate` for a bare workflow step |
| `tests/setup/test-extend.ts` | Every fixture: `db`, `getDb`, `logger`, `makeRequest`, `createApi`, `createTestContainer`, `step`, `dto`, `http`, `factories`, `service` |
| `tests/factories/` | DTO generators, HTTP request-body generators (`http/`), service factories, and the E2E-only DB factories |
| `tests/utils/` | Leaf helpers — `assert-defined`, `decode-token`, `auth-header` |

## Database lifecycle

**Per run** (`globalSetup`): one database per vitest worker, `proteus_test_1..N`, each dropped and
migrated from cold. **Per test** (`beforeEach`): `TRUNCATE` every table in `public`.

`WORKER_COUNT = min(availableParallelism() - 1, 8)`. `vitest.config.ts` caps `maxWorkers` with it,
so a worker can never ask for a database `globalSetup` did not create.

### Why not drop-and-re-migrate per test

That was the original design and it cost ~220ms per test — about 90% of a 190s suite. Measured on
Postgres 17, 8 logical cores:

```
drop schemas + recreate public:                     ~34ms
migrate 12 folders from scratch:                   ~187ms
TRUNCATE <60 tables> RESTART IDENTITY CASCADE:   21–30ms
```

`TRUNCATE` is ~9× cheaper and its cost is O(tables), not O(rows), so it does not degrade as tests
write more data. The reset is load-bearing, not decorative: commenting it out fails 8 tests on
leaked rows.

### Why not a template database

The common alternative: migrate once, snapshot with `CREATE DATABASE … WITH TEMPLATE`, restore per
test. Measured against our database:

```
snapshot (once): 1673ms
restores:        1754ms, 650ms, 264ms, 210ms, 817ms
```

**Worse than the 220ms baseline, and erratic.** A template copy is a file-level copy of the data
directory; for 60 empty tables that is almost entirely system catalogs, and the cost does not
shrink because there is no data. The technique earns its keep on suites with hundreds of migrations
and seeded fixture data, where the baseline it replaces is far worse. We have 12 migration folders.

It also carries operational weight we would adopt for nothing: dropping a database needs every
connection terminated, which means a separate admin connection on the maintenance database,
`ALLOW_CONNECTIONS false`, `pg_terminate_backend`, and a retry loop with backoff.

### `globalSetup` must keep the DROP

We regenerate migrations in place under the same tag rather than adding `0001_*` files. Drizzle
records a hash per applied migration, so a regenerated file with an unchanged tag is a *different*
hash against a database that thinks it is already migrated. Every run therefore has to start cold.

"We already migrated, skip the drop" is exactly the optimisation someone will later try to add.
There is a comment in `global-setup.ts` saying so.

### What `TRUNCATE` must not touch

Scoped to `schemaname = 'public'` on purpose. Drizzle's bookkeeping lives in the `drizzle` schema
and must survive or the next file replays every migration. The `bullmq` schema also sits outside
`public`.

Prefixed IDs are generated with `gen_random_uuid()`, so no sequences are involved and reusing a
database carries no collision risk. The one `serial` column, `order.display_id`, is reset by
`RESTART IDENTITY`, matching a freshly migrated schema.

## Parallelism

Files used to run serially (`fileParallelism: false`) because every process shared one database —
two processes meant one dropping the schema under the other. Per-worker databases removed that.

```
baseline (drop + migrate, serial):   190.33s    40% CPU
+ TRUNCATE:                           69.01s    95% CPU
+ 7 workers:                            ~28s   268% CPU
```

Ten consecutive runs landed between 26.4s and 30.5s. (~40s today, with the workflow tests moved
onto real modules.)

### Concurrent runs still corrupt each other

`VITEST_POOL_ID` restarts at 1 every run, so a second run claims the *same* `proteus_test_1..N`.
Per-worker databases do **not** make a stray process harmless — that was the wrong assumption first
time round, and it surfaced as `schema "public" does not exist` hundreds of tests from the cause.

`globalSetup` takes a session-scoped `pg_try_advisory_lock` for the whole run and fails immediately
with a `pgrep -fl vitest` hint if another holds it. Postgres releases it when the connection dies,
so a killed run leaves nothing stale. Runs are still strictly one at a time; the lock only makes
that legible instead of corrupting.

An editor watcher (`vitest-vscode`) is the usual culprit.

### The test Postgres needs tuning

The data directory is a 2 GB tmpfs and `max_wal_size` defaults to 1 GB. With seven more databases
that runs out, surfacing as `could not create file …: No space left on device` deep into a run.
`docker-compose.test.yml` runs with `fsync=off`, `full_page_writes=off`, `synchronous_commit=off`,
`max_wal_size=256MB`, `max_connections=200`. Durability is already gone on tmpfs, so none of it
costs anything. Usage plateaus around 435 MB.

### The e2e server keeps the unsuffixed database

Both `playwright.config.ts` files start `dev:test`, which reads `.env.test` and therefore
`proteus_test`. `withWorkerDatabase()` returns the base URL unchanged when there is no
`VITEST_POOL_ID`, so the e2e path is untouched.

## Containers

`createTestContainer()` bootstraps every module, the link service and the workflow engine.
`createApi()` is that plus sorted routes and a listening `http.Server`; `CreateApiOptions` extends
`CreateContainerOptions`, so `config` and `register` are declared once.

**Built per test, not per suite.** `bootstrapContainer` measures 7–10ms warm, so caching it in a
`beforeAll` would buy nothing and force a `getContainer()` indirection. The fixtures own disposal —
no test writes an `afterEach`.

Nothing disposed containers before `createApi` existed: 611 tests, 611 containers, each holding
twelve modules.

**Route ordering comes from `RoutesSorter`**, the class `prepareRoutes` uses. Two auth test files
used to rebuild that ordering by hand; the real sorter produces the same result.

**`applyNamespaceAuth` is opt-in** (`namespaceAuth: true`) because production applies it to every
`/admin` and `/store` definition but the tests do not. That is why
`/admin/uploads/presigned-urls` returns 400 for a malformed MIME type rather than 401 for a missing
token. Turning it on means threading tokens through the uploads and product tests — its own piece
of work, still not done.

## Workflow tests run against real modules

Workflow tests used to build a fake world per file: an object literal per module service, a fake
`ILinkService`, an Awilix container, `setWorkflowEngine`. Twelve of the fourteen now use
`createTestContainer` and real Postgres. **A typed mock-builder was considered and rejected** — the
reasoning is worth keeping because the instinct recurs:

- It contradicts the suite's first principle: nothing about the module graph is stubbed, so a
  passing test means the wiring works.
- **A mock cannot tell you whether the path it exercises is reachable.** The mocked compensation
  test injected a failure at `addOrderTransaction`; against real modules that step never runs,
  because `record-transactions` opens with `if (captures.length === 0) return` and the default
  provider authorizes without capturing. The mock reached it only by hand-building a payment with
  captures.
- **Mocked assertions check that the code does what the code does.** `complete-cart`'s idempotency
  guarantee is a unique index on `order_cart.cart_id`; the mocked test asserted `createMany` was
  called with links in a given array order. The real test asserts the guarantee — five concurrent
  completions produce one order, one payment, one reserved unit.
- Four of the seven fake link services ignored the repo name (`repo: vi.fn().mockReturnValue(x)`),
  so a workflow resolving the wrong link repo passed.
- Nothing type-checked a stub against the interface it replaced.

The accepted cost: a bug in the cart module now fails cart module tests *and* every workflow test
that touches it. That redundancy is the point. Runtime cost was about +70ms per test, under a
second of wall clock across seven workers.

### Failure injection

Compensation paths need a seam, and it is one line — module services register as
`asValue(service)`, so the resolved object is the one the workflow gets:

```ts
vi.spyOn(container.resolve<IPaymentModuleService>(Modules.PAYMENT), 'authorizePaymentSession')
  .mockRejectedValueOnce(new Error('provider unavailable'))
```

Twelve injection points across the whole workflow suite; everything else needs none. **Installing a
spy is the only thing `container.resolve` may be used for in a test file** — reading or writing
through a resolved service means a factory was not written.

Assert on the state a compensation restored, never on the call that restored it.

## Gotchas worth remembering

- **`console.error` / `console.warn` throw.** When a test legitimately logs, call
  `consoleError.mockImplementation(() => {})`. `console.info` is swallowed — use
  `process.stderr.write` when probing.
- **Notification providers come from the database**, not the DI declarations
  (`notification-provider-service.ts:39`), and the per-test `TRUNCATE` empties that table. A
  `createNotification` persists with `providerId: null` and dispatches nothing — usually what you
  want. A test needing real dispatch must seed a provider row and register a fake through
  `createApi({ register })`.
- **A test that passes alone and fails in the suite** is usually state outside `public` (which
  `TRUNCATE` does not reach) or module-scope state in the test file itself, which persists across
  every test in that file.

## Open

- **Whether `verify.sh` still needs to run API tests only.** It was scoped that way because the
  full suite took ~190s. At ~40s the trade-off has changed.
- **`cancel-order` and `create-order-fulfillment` are still on mocks**, blocked on a production
  defect the migration uncovered: `complete-cart` keys reservations to *cart* line items while both
  workflows look them up by *order* line item, so cancelling never releases stock and fulfilling a
  tracked variant always throws. Written up under `.tasks/next-todos`.
- **Truncating only tables that have rows.** `pg_stat_user_tables.n_live_tup` is lagged and not
  trustworthy for correctness, so this needs a tracked write-set. Probably not worth it — 25ms is
  already 4% of the original cost.

## Re-measuring

Probe files were throwaway: written to `apps/backend/src/__<name>.test.ts`, run with
`npx dotenvx run -f ../../.env.test --quiet -- npx vitest run src/__<name>.test.ts`, deleted after.
Timings go through `process.stderr.write`, since the console spy swallows `console.info`.

Check `pgrep -fl vitest` first and stop any editor watcher, or the numbers — and the run — will be
wrong.
