import postgres from 'postgres'
import { appConfigInput } from '../../config.js'
import { bootstrapContainer } from '../../container.js'
import type { WorkflowEngineName } from '../../core/config/types.js'
import { createNodeDbProvider } from '../../core/db/node-provider.js'
import { env } from '../../env.js'
import { WinstonLogger } from '../logger/winston-logger.js'

/**
 * A Worker's composition root. Same modules, same links, same database as the API's — it is the
 * process that actually executes step actions, so it needs everything a route handler needs.
 *
 * One thing differs, and deliberately: the Worker pins an engine for itself rather than taking the
 * derived default. The workflow Worker pins **simple**, which is why that is the default here. Two
 * workflows call another workflow's `.run()` from inside a step (`create-product`,
 * `complete-customer-auth`), and those nested runs are meant to stay inline. Leaving that Worker on
 * the derived default would make each one start its own Temporal execution from inside an
 * Activity — a different failure and compensation shape than the one those workflows were written
 * against, for no durability the outer execution does not already provide.
 *
 * The pin is a parameter rather than a constant because a second Worker process will want the other
 * value, and inheriting a pin nobody chose is the failure that costs a debugging session. Passing
 * nothing keeps today's behaviour exactly.
 *
 * Kept separate from `container.node.ts` rather than reusing it, because that module is a resolved
 * singleton for the HTTP server: importing it here would build the API's container, engine
 * included, as a side effect of starting a Worker.
 */
export async function createWorkerContainer(options: { engine?: WorkflowEngineName } = {}) {
  const { engine = 'simple' } = options

  const client = postgres(env.DATABASE_URL, { prepare: false })
  const dbProvider = createNodeDbProvider(client)
  const logger = new WinstonLogger()

  const container = await bootstrapContainer({
    logger,
    dbProvider,
    config: {
      ...appConfigInput,
      projectConfig: { ...appConfigInput.projectConfig, workflows: { engine } },
    },
  })

  return {
    container,
    logger,
    shutdown: async () => {
      await container.dispose()
      await client.end()
    },
  }
}
