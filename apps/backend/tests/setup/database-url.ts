import { availableParallelism } from 'node:os'

/**
 * Where the test cluster is when nothing in the environment says otherwise.
 *
 * Five processes reach for this — the backend's Drizzle client, `packages/testing`'s, the Playwright
 * factory, its global setup, and the script that creates a suite's database — and the two suffixing
 * helpers below only ever qualify it. A copy that drifts points one of them at a database the others
 * are not using, which is the failure this whole file exists to prevent. 5433 is what
 * `docker-compose.test.yml` publishes.
 */
export const DEFAULT_TEST_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/proteus_test'

/**
 * How many databases the run provisions, and therefore how many vitest workers may exist.
 * `vitest.config.ts` caps `maxWorkers` with this so a worker never asks for a database
 * `globalSetup` did not create.
 *
 * Capped at 8 because each worker holds two postgres clients and the default
 * `max_connections` is 100 — see the `max` given to the clients in `db-setup.ts`.
 */
export const WORKER_COUNT = Math.max(1, Math.min(availableParallelism() - 1, 8))

/**
 * Per-worker database name. Vitest gives each worker a 1-based `VITEST_POOL_ID`, and each
 * worker needs its own database or the per-test `TRUNCATE` in one would wipe rows out from
 * under another — which is what forced `fileParallelism: false`.
 *
 * With no pool id — the Playwright e2e server, seed scripts — the base name is returned
 * unchanged. Both `playwright.config.ts` files boot `dev:test` off `.env.test`, so the
 * unsuffixed database has to keep working.
 */
export function withWorkerDatabase(baseUrl: string, poolId = process.env.VITEST_POOL_ID) {
  if (!poolId) return baseUrl

  const workerId = Number(poolId)
  if (workerId > WORKER_COUNT) {
    throw new Error(
      `VITEST_POOL_ID ${workerId} exceeds the ${WORKER_COUNT} databases globalSetup provisioned. ` +
        'Drop --maxWorkers, or raise WORKER_COUNT in tests/setup/database-url.ts.',
    )
  }

  const url = new URL(baseUrl)
  url.pathname = `${url.pathname}_${workerId}`
  return url.toString()
}

/**
 * Per-app end-to-end database name. `withWorkerDatabase` above isolates vitest workers from each
 * other; this isolates the Playwright suites from each other for the same reason — each one's
 * `globalSetup` truncates every table in `public`, so store and admin sharing one database means
 * whichever starts second wipes the rows the first is still asserting against.
 *
 * `E2E_APP` is set by `defineE2eConfig` (packages/testing/fixtures/e2e-config.ts) in the Playwright
 * main process and inherited by every worker and web server forked from it. Unset — vitest, the
 * seed scripts, a hand-started `dev:test` — the base name is returned unchanged, so nothing outside
 * an e2e run changes database.
 *
 * Composes with `withWorkerDatabase` rather than competing with it: exactly one of `VITEST_POOL_ID`
 * and `E2E_APP` is ever set, so the two suffixes cannot both apply.
 */
export function withAppDatabase(baseUrl: string, app = process.env.E2E_APP) {
  if (!app) return baseUrl

  const url = new URL(baseUrl)
  url.pathname = `${url.pathname}_${app}`
  return url.toString()
}
