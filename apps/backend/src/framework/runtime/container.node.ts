/** Node entry point — singleton connection pool, winston logger, Temporal-backed workflows. */

import postgres from 'postgres'
import { bootstrapContainer } from '../../container.js'
import { createNodeDbProvider } from '../../core/db/node-provider.js'
import { createTemporalWorkflowEngine } from '../../core/workflows/temporal-adapter.js'
import { env } from '../../env.js'
import { WinstonLogger } from '../logger/winston-logger.js'
import { registerScheduler } from '../scheduler/index.js'

const client = postgres(env.DATABASE_URL, { prepare: false })
const dbProvider = createNodeDbProvider(client)
const logger = new WinstonLogger()

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
  createTemporalWorkflowEngine: () => createTemporalWorkflowEngine({ retry: {} }),
})
registerScheduler(container, logger)
