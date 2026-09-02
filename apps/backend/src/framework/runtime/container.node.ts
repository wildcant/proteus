/** Node entry point — singleton connection pool, winston logger, Temporal-backed workflows. */

import postgres from 'postgres'
import { bootstrapContainer } from '../../container.js'
import { createNodeDbProvider } from '../../core/db/node-provider.js'
import { createTemporalWorkflowEngine, type TemporalWorkflowEngine } from '../../core/workflows/temporal-adapter.js'
import { env } from '../../env.js'
import { WinstonLogger } from '../logger/winston-logger.js'
import { registerScheduler } from '../scheduler/index.js'

const client = postgres(env.DATABASE_URL, { prepare: false })
const dbProvider = createNodeDbProvider(client)
const logger = new WinstonLogger()

/**
 * Held here rather than only inside the container because `setWorkflowEngine` stores the engine in
 * a module global that `container.dispose()` never sees, so nothing else can give the gRPC
 * connection back. `container.ts` cannot hold the concrete type: `check:deps` counts a type-only
 * import as a dependency, and `no-temporal-in-workerd` would fail on it.
 */
let temporalEngine: TemporalWorkflowEngine | undefined

export const container = await bootstrapContainer({
  logger,
  dbProvider,
  /**
   * Imported here and nowhere shared, so `@temporalio/*` stays out of the workerd bundle.
   *
   * `retry` is deliberately empty. Every step runs with `maximumAttempts: 1`, which is what makes
   * this engine behaviour-identical to the simple one — today's steps are not idempotent, so a
   * retry double-executes. Opt a step in here once it is proven safe to run twice, e.g.
   * `{ 'complete-cart': { 'authorize-payment': { maximumAttempts: 3 } } }`.
   */
  createTemporalWorkflowEngine: () => {
    temporalEngine = createTemporalWorkflowEngine({ retry: {} })
    return temporalEngine
  },
})
registerScheduler(container, logger)

/**
 * Closes the Temporal connection, if this process opened one. A no-op under the simple engine, and
 * safe to call twice.
 *
 * `start.ts` force-exits on a signal, so this only matters on the path that does not — an embedded
 * caller awaiting the `shutdown()` that `start()` returns, which would otherwise be left holding an
 * open gRPC connection.
 */
export async function closeWorkflowEngine(): Promise<void> {
  const engine = temporalEngine
  temporalEngine = undefined
  await engine?.close()
}
