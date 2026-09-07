/** Node entry point — singleton connection pool, winston logger, Temporal-backed workflows. */

import { env } from '@env'
import postgres from 'postgres'
import { bootstrapContainer } from '../../container.js'
import { createNodeDbProvider } from '../../core/db/node-provider.js'
import { subscriberRegistry } from '../../core/event-bus/registry.js'
import { createTemporalEventBus, type TemporalEventBus } from '../../core/event-bus/temporal-adapter.js'
import { createTemporalWorkflowEngine, type TemporalWorkflowEngine } from '../../core/workflows/temporal-adapter.js'
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

/** Held for the same reason, and closed by the same function. */
let temporalEventBus: TemporalEventBus | undefined

/**
 * No `config` override at all. `RUNTIME` is `node` here, so both derived defaults — the Temporal
 * workflow engine and the Temporal event bus — are already what this process wants, and the
 * `eventBus: 'inline'` pin that stood in for a transport that did not exist yet is gone.
 */
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
  /**
   * The event bus's own Temporal factory, imported here for the same reason and kept separate from
   * the engine's: the two subsystems are peers that may not import each other, so they are two
   * injections rather than one.
   *
   * This process is a publisher only. What runs the subscribers is
   * `npm run --workspace=backend worker:events` — and an event published with nothing polling
   * `proteus-events` waits on the queue rather than being lost, which is the point of the transport.
   */
  createTemporalEventBus: () => {
    temporalEventBus = createTemporalEventBus({ registry: subscriberRegistry, logger })
    return temporalEventBus
  },
})
registerScheduler(container, logger)

/**
 * Closes the Temporal connections, if this process opened any — the workflow engine's and the event
 * bus's, which are separate `Client` instances on separate connections by design. A no-op under the
 * in-process adapters, and safe to call twice.
 *
 * `start.ts` force-exits on a signal, so this only matters on the path that does not — an embedded
 * caller awaiting the `shutdown()` that `start()` returns, which would otherwise be left holding
 * open gRPC connections.
 */
export async function closeWorkflowEngine(): Promise<void> {
  const engine = temporalEngine
  const bus = temporalEventBus
  temporalEngine = undefined
  temporalEventBus = undefined
  await engine?.close()
  await bus?.close()
}
