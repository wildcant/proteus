import postgres from 'postgres'
import { appConfigInput } from '../../config.js'
import { bootstrapContainer } from '../../container.js'
import { createNodeDbProvider } from '../../core/db/node-provider.js'
import type { EventBusAdapterName, WorkflowEngineName } from '../../core/types/config.js'
import { env } from '../../env.js'
import { subscriberRegistry } from '../event-bus/registry.js'
import { createTemporalEventBus, type TemporalEventBus } from '../event-bus/temporal-adapter.js'
import { WinstonLogger } from '../logger/winston-logger.js'
import { createTemporalWorkflowEngine, type TemporalWorkflowEngine } from '../workflows/temporal-adapter.js'

/**
 * A Worker's composition root. Same modules, same links, same database as the API's — it is the
 * process that actually executes step actions and event subscribers, so it needs everything a route
 * handler needs.
 *
 * A Worker pins its own workflow engine and its own event bus rather than taking the derived
 * defaults. The workflow Worker wants **simple**: two workflows call another workflow's `.run()`
 * from inside a step (`create-product`, `complete-customer-auth`), and those nested runs are meant
 * to stay inline. On the derived default each one would start its own Temporal execution from inside
 * an Activity — a different failure and compensation shape than the one those workflows were written
 * against, for no durability the outer execution does not already provide.
 *
 * **`eventBus` has no default, deliberately.** Both Workers want `temporal` — a step that publishes
 * from inside an Activity should go durable rather than dispatch a subscriber inline while holding
 * that Activity's slot — so a default would be *correct* and still wrong: this function would then
 * hand one process a pin chosen for the other, silently, which is the failure this comment used to
 * describe while the code did it. Making it required costs each caller five words and makes the
 * choice readable at the call site, which is where it matters.
 *
 * `engine` keeps its default: `simple` is what the older and larger caller wants, and changing that
 * is not this ticket's to do.
 *
 * Kept separate from `container.node.ts` rather than reusing it, because that module is a resolved
 * singleton for the HTTP server: importing it here would build the API's container, engine
 * included, as a side effect of starting a Worker.
 */
export async function createWorkerContainer(options: { engine?: WorkflowEngineName; eventBus: EventBusAdapterName }) {
  const { engine = 'simple', eventBus } = options

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
    // The container argument goes unused here: a publisher starts an activity rather than resolving
    // a subscriber. The workerd root's Cloudflare adapter is the one that needs it.
    createEventBusAdapter: () => {
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
