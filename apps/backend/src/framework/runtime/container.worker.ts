import postgres from 'postgres'
import { appConfigInput } from '../../config.js'
import { bootstrapContainer } from '../../container.js'
import type { EventBusAdapterName, WorkflowEngineName } from '../../core/config/types.js'
import { createNodeDbProvider } from '../../core/db/node-provider.js'
import { subscriberRegistry } from '../../core/event-bus/registry.js'
import { createTemporalEventBus, type TemporalEventBus } from '../../core/event-bus/temporal-adapter.js'
import { createTemporalWorkflowEngine, type TemporalWorkflowEngine } from '../../core/workflows/temporal-adapter.js'
import { env } from '../../env.js'
import { WinstonLogger } from '../logger/winston-logger.js'

/**
 * A Worker's composition root. Same modules, same links, same database as the API's — it is the
 * process that actually executes step actions and event subscribers, so it needs everything a route
 * handler needs.
 *
 * Two things differ, and deliberately: a Worker pins its own workflow engine and its own event bus
 * rather than taking the derived defaults. The workflow Worker pins **simple**, which is why that is
 * the default here. Two workflows call another workflow's `.run()` from inside a step
 * (`create-product`, `complete-customer-auth`), and those nested runs are meant to stay inline.
 * Leaving that Worker on the derived default would make each one start its own Temporal execution
 * from inside an Activity — a different failure and compensation shape than the one those workflows
 * were written against, for no durability the outer execution does not already provide.
 *
 * Both pins are parameters rather than constants because the second Worker process wants a different
 * answer for one of them, and inheriting a pin nobody chose is the failure that costs a debugging
 * session. `src/core/event-bus/temporal/worker.ts` is that process and asks for `temporal`.
 *
 * Kept separate from `container.node.ts` rather than reusing it, because that module is a resolved
 * singleton for the HTTP server: importing it here would build the API's container, engine
 * included, as a side effect of starting a Worker.
 */
export async function createWorkerContainer(
  options: { engine?: WorkflowEngineName; eventBus?: EventBusAdapterName } = {},
) {
  const { engine = 'simple', eventBus = 'temporal' } = options

  const client = postgres(env.DATABASE_URL, { prepare: false })
  const dbProvider = createNodeDbProvider(client)
  const logger = new WinstonLogger()

  /**
   * Held here rather than only inside the container, for the reason `container.node.ts` holds its
   * engine: nothing else can hand the gRPC connections back, and a Worker draining on SIGTERM is
   * exactly the path where that matters.
   */
  let temporalEngine: TemporalWorkflowEngine | undefined
  let temporalEventBus: TemporalEventBus | undefined

  const container = await bootstrapContainer({
    logger,
    dbProvider,
    config: {
      ...appConfigInput,
      projectConfig: {
        ...appConfigInput.projectConfig,
        workflows: { engine },
        eventBus: { adapter: eventBus },
      },
    },
    createTemporalWorkflowEngine: () => {
      // `retry` empty for the reason `container.node.ts` gives: today's steps are not idempotent, so
      // a retry double-executes. A step earns an entry once it is proven safe to run twice.
      temporalEngine = createTemporalWorkflowEngine({ retry: {} })
      return temporalEngine
    },
    createTemporalEventBus: () => {
      temporalEventBus = createTemporalEventBus({ registry: subscriberRegistry, logger })
      return temporalEventBus
    },
  })

  return {
    container,
    logger,
    shutdown: async () => {
      await container.dispose()
      await temporalEngine?.close()
      await temporalEventBus?.close()
      await client.end()
    },
  }
}
