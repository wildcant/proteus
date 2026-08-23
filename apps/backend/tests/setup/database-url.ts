import { availableParallelism } from 'node:os'

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
