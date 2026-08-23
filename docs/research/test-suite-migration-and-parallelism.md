# Test Suite: Migration Cost and Parallelism

**Status:** both implemented. 190.33s → ~28s, all 611 tests passing, 10 consecutive clean runs.
**Measured:** 2026-08-23, on Postgres 17 (Docker, `127.0.0.1:5433`), 8 logical cores.

## Summary

About **90% of backend test time is spent re-creating the schema**, not running tests.
A full run is 190.70s wall clock; roughly 134s of that is `DROP SCHEMA` + re-migrate,
paid once per test, 611 times.

Two candidate fixes were measured against each other:

| Approach | Per-test cost | Verdict |
| --- | --- | --- |
| Today: drop schema + re-migrate | ~220ms | baseline |
| Postgres template database (what Medusa does) | ~210–1750ms | **slower than the baseline for us** |
| Migrate once + `TRUNCATE` per test | ~25ms | **~9× cheaper** — prototyped, suite 190.33s → 69.01s |

Separately, `fileParallelism: false` leaves 7 of 8 cores idle (the full run averages 0.4
cores). That is a consequence of every test process sharing one database, and it is fixable
with per-worker database names.

## How state is reset today

`apps/backend/tests/setup/db-setup.ts:42-51` registers a global `beforeEach` (loaded through
`setupFiles` in `vitest.config.ts:19`, so it applies to every test in every file):

```ts
beforeEach(async () => {
  await db.execute(dsql`DROP SCHEMA IF EXISTS drizzle CASCADE`)
  await db.execute(dsql`DROP SCHEMA IF EXISTS public CASCADE`)
  await db.execute(dsql`CREATE SCHEMA public`)
  for (const config of moduleMigrations) {
    await migrate(db, config)
  }
})
```

That is 12 migration folders (11 modules + `link-modules`), 60 `CREATE TABLE`s and 107
`CREATE INDEX`es, replayed before every single test. Dropping the `drizzle` schema as well
means drizzle's bookkeeping is gone too, so nothing can be skipped — every run is a cold run.

## Measurements

All figures are warm (first iteration discarded where it differed materially). Each was
produced by a throwaway test file in `apps/backend/src/`, run with
`npx dotenvx run -f ../../.env.test --quiet -- npx vitest run <file>`.

### Baseline

```
Full suite:  55 files, 611 tests
             190.70s wall   (transform 1.88s, setup 18.96s, import 11.17s, tests 155.74s)
             62.17s user, 16.40s system, 40% CPU
```

40% CPU over the whole run means we average well under half of one core. The suite is
almost entirely waiting on Postgres.

### Cost of the reset, isolated

20 tests whose bodies are `expect(1).toBe(1)` — so the only work is `db-setup`'s `beforeEach`:

```
20 empty tests: 4.65s  →  ~232ms per test
```

Broken into phases:

```
drop schemas + recreate public:   ~34ms
migrate 12 folders from scratch: ~187ms
                                 ------
                                 ~221ms
```

Extrapolated: `611 × 221ms ≈ 135s` of the 155.74s spent "in tests".

### What is *not* expensive

Two things worth knowing, because they rule out fixes that would otherwise look attractive:

```
bootstrapContainer (all 12 modules, warm):   7–10ms
migrate() when everything is already applied: ~20ms   (12 folders, drizzle skips each)
```

Container bootstrap being ~8ms is why per-test container creation is fine and does not need
Medusa-style `beforeAll` caching. No-op `migrate()` being ~20ms is what makes the
"migrate once, reset data per test" design viable.

### Option A — Postgres template database (Medusa's approach)

`medusa-test-utils` never re-migrates. It migrates once in `beforeAll`, snapshots with
`CREATE DATABASE "<db>-template" WITH TEMPLATE "<db>"`, and each `beforeEach` drops the
database and recreates it from the template
(`medusa-source/packages/medusa-test-utils/src/medusa-test-runner-utils/postgres-template.ts:157-198`).

Measured against our test database:

```
snapshot (once):  1673.1ms
restore 1:        1753.8ms
restore 2:         649.7ms
restore 3:         263.7ms
restore 4:         210.3ms
restore 5:         816.8ms
```

**This is worse than what we do now**, and erratically so. A template copy is a file-level
copy of the whole data directory — for a database whose 60 tables are empty, that is almost
entirely system catalogs, and the cost does not shrink just because there is no data.

It pays off for Medusa because they have hundreds of migrations across dozens of modules
plus seeded fixture data, so their "before" number is far worse than our 221ms. We have 12
migration files. **The technique does not transfer.**

It also carries real operational weight that we would be adopting for nothing: dropping a
database needs every connection terminated, which is why their implementation needs a
separate admin connection on the maintenance database, `ALTER DATABASE … ALLOW_CONNECTIONS
false`, `pg_terminate_backend`, and a 10-attempt retry loop with backoff
(`postgres-template.ts:117-153`). Our `db-setup.ts` holds one module-scope `postgres-js`
pool and exports `db` as a const that fixtures and factories capture, so every restore would
also mean rebuilding that pool.

### Option B — migrate once, `TRUNCATE` per test

```
TRUNCATE <60 tables> RESTART IDENTITY CASCADE:  21–30ms warm (45.6ms first)
```

Roughly 9× cheaper than the current reset. The cost is O(tables), not O(rows), so it does not
degrade as tests write more data.

Projected effect, using the measured pieces:

```
today:     611 × 221ms                     ≈ 135s of reset
option B:  221ms once + 611 × 25ms         ≈  15s of reset
suite:     190.70s  →  ~70s   (projection, not measured)
```

**Measured after implementing it** — 55 files, 611 tests, all passing:

```
before:  190.33s wall   (setup 18.56s, import 22.94s, tests 144.00s)
after:    69.01s wall   (setup 18.07s, import 20.48s, tests  24.97s)
```

The projection held. `tests` fell 144.00s → 24.97s (5.8×); everything else was untouched,
which is the point — the win is entirely the reset.

The reset being cheap was verified as load-bearing rather than assumed: commenting out the
`TRUNCATE` and re-running `src/api/store/products` + `src/modules/product` fails 8 tests on
leaked rows. With it, 120 pass.

### What dominates now

`setup 18.07s + import 20.48s ≈ 38.5s` of the 69.01s is per-file module loading — 55 files ×
~700ms, paid serially. That is the number per-worker databases would attack, and it is now
the majority of the run rather than a rounding error.

## Where the "migrate once" has to live

Not in `setupFiles`. Vitest isolates the module registry per test file, so `db-setup.ts` is
re-evaluated for each of the 55 files — a module-level `hasMigrated` flag would reset 55
times and buy only part of the win.

`globalSetup` runs once per run, outside the per-file registry. The shape would be:

- **`globalSetup`** — drop schemas, run all 12 migration folders. Once. ~221ms total.
- **`setupFiles` `beforeEach`** — `TRUNCATE` every table in `public`. ~25ms.

### Gotcha: this interacts with the regenerate-migrations-in-place convention

We deliberately regenerate migrations under the same tag rather than adding `0001_*` files.
Drizzle records a hash per applied migration, so a regenerated file with unchanged tag but
changed content is a *different* hash against a database that thinks it is already migrated.
Today that is invisible because every test starts from a dropped schema.

Putting the drop in `globalSetup` preserves that safety — each run still starts cold — but it
means `globalSetup` must keep the `DROP SCHEMA` and not just call `migrate()`. Worth an
explicit comment there, since "we already migrated, skip the drop" is exactly the
optimisation someone would later add.

### Things `TRUNCATE` must not touch

- **Drizzle's bookkeeping** lives in the `drizzle` schema, not `public`, so scoping the
  truncate to `schemaname = 'public'` already excludes it. Confirmed: zero `migrations*`
  tables exist in `public`.
- **The `bullmq` schema** also sits outside `public` and already survives today's
  `DROP SCHEMA public CASCADE`. No change.

### Things `TRUNCATE` handles fine

- **IDs.** Every prefixed ID is `CONCAT('cus_', REPLACE(gen_random_uuid()::text, '-', ''))` —
  no sequences involved, so there is no collision risk from reusing a database.
- **The one `serial` column**, `order.display_id`
  (`src/modules/order/migrations/0000_create_order_tables.sql:62`), is reset by
  `RESTART IDENTITY`, matching current behaviour where a fresh schema restarts it at 1.

### Open question

Whether ~25ms can be pushed lower by truncating only tables that actually have rows.
`pg_stat_user_tables.n_live_tup` is lagged and not trustworthy for correctness, so this would
need either a tracked write-set or accepting the stat's staleness. Probably not worth it —
25ms is already 4% of the current cost.

## Parallelism

`vitest.config.ts:20` sets `fileParallelism: false`. That is not a performance choice; it is
forced by every test process sharing the single `proteus_test` database. Two processes means
one drops the schema out from under the other.

This has cost us real time. In the previous session, phantom failures appeared four times —
once from a `vitest-vscode` watcher running concurrently, three times self-inflicted by
chaining a command onto an already-backgrounded run.

### The fix Medusa uses

Their database name is derived from the worker id:

```ts
const tempName = parseInt(process.env.JEST_WORKER_ID || "1")
this.dbName = config.dbName ?? `medusa-${moduleName.toLowerCase()}-integration-${tempName}`
```
(`medusa-test-runner.ts:91-95`)

One database per worker is the entire reason they can run files in parallel. Our equivalent
is `VITEST_POOL_ID`, read at module scope in `db-setup.ts` where the connection URL is built.

This solves both problems at once: files can run in parallel, *and* a stray second process
lands on its own database instead of corrupting the shared one.

### Constraints to respect

- **The e2e server must keep a stable database name.** Both `apps/admin/playwright.config.ts`
  and `apps/store/playwright.config.ts` start `npm run --workspace=backend dev:test`, which
  reads `.env.test` and therefore `proteus_test`. Suggestion: leave the unsuffixed
  `proteus_test` to the e2e server and give vitest workers `proteus_test_1..N`.
- **Each worker database needs its own migration.** With option B that is ~221ms per worker,
  once — 8 workers ≈ 1.8s. (This is the one place a template database might earn its keep,
  but at ~700ms per restore versus ~221ms per migrate, it still loses.)
- **`getDb` and the exported `db` const** are module-scope in `db-setup.ts`, evaluated per
  file. Deriving the URL there is straightforward; nothing needs to be threaded through
  fixtures.
- **Postgres connection limits.** 8 workers × the pool size each, plus the e2e server, against
  a default `max_connections` of 100. Worth checking before turning parallelism up.

### Measured gain

`WORKER_COUNT = min(availableParallelism() - 1, 8)` — 7 workers here. `globalSetup` provisions
`proteus_test_1..7` (created once and left in place; `CREATE DATABASE` is a template copy and
too expensive to repeat), migrates all seven in parallel, and `db-setup.ts` picks its own via
`VITEST_POOL_ID`.

```
serial + TRUNCATE:    69.01s    95% CPU
parallel + TRUNCATE:  ~28s     268% CPU
```

Ten consecutive full runs: 26.42s–30.45s, 611/611 every time. Against the original baseline
that is **190.33s → ~28s, 6.8×**.

The "roughly 3×" hypothesis was about right (2.5×); Postgres did not become the bottleneck.

### Two things this needed that the plan did not anticipate

**The test Postgres ran out of disk.** Its data directory is a 2 GB tmpfs, and `max_wal_size`
defaults to 1 GB — leaving ~1 GB, of which `proteus_test` alone had bloated to 283 MB from
611 schema drops per run. Seven more databases tipped it over, and the failure surfaces as
`could not create file …: No space left on device` several hundred tests deep.
`docker-compose.test.yml` now runs the container with `fsync=off`, `full_page_writes=off`,
`synchronous_commit=off`, `max_wal_size=256MB` and `max_connections=200`. Durability is
already gone on tmpfs, so none of that costs anything. Usage now plateaus at ~435 MB.

**Per-worker databases do *not* make a stray second process harmless** — the claim made in the
section above is wrong. `VITEST_POOL_ID` restarts at 1 for every run, so a second run claims
the *same* `proteus_test_1..7` and its `globalSetup` drops the schema under the first. It
shows up as `schema "public" does not exist` or a `DROP SCHEMA` deadlock, hundreds of tests
from the cause. This was hit twice while measuring.

`globalSetup` now takes a session-scoped `pg_try_advisory_lock` for the whole run and fails
immediately, with the `pgrep -fl vitest` hint, if another run holds it. Postgres drops the
lock when the connection dies, so a killed run leaves nothing stale. Runs are still strictly
one-at-a-time — the lock only makes that legible instead of corrupting.

## Suggested sequencing

1. ~~**Prototype option B**~~ — done. `globalSetup` builds the schema
   (`tests/setup/global-setup.ts`), `db-setup.ts`'s `beforeEach` truncates, and the migration
   config both share moved to `tests/setup/db-migrations.ts`. No test file changed.
2. ~~**Then per-worker databases.**~~ — done. `tests/setup/database-url.ts` derives the name
   from `VITEST_POOL_ID` and is the single source of truth for `maxWorkers`; both test
   postgres clients (`tests/setup/db-setup.ts` and `tests/db/client.ts`) go through it. With
   no pool id — the Playwright e2e server, seed scripts — the unsuffixed `proteus_test` is
   returned unchanged, so `dev:test` is untouched.
3. **Still open:** whether `verify.sh` still needs to run API tests only. It was ~16s by
   design because the full suite was slow; the full suite is now ~28s, so the trade-off has
   changed.

## Reproducing these numbers

The probe files were throwaway and are not checked in. Each was written to
`apps/backend/src/__<name>.test.ts`, run with
`npx dotenvx run -f ../../.env.test --quiet -- npx vitest run src/__<name>.test.ts`, and
deleted. Timings were emitted with `process.stderr.write` — `console.info` is swallowed by
the console spy in `tests/setup/setup-test-env.ts`.

Make sure nothing else is touching the test database first (`pgrep -fl vitest`, and stop any
editor watcher), or the numbers — and the run — will be wrong.
