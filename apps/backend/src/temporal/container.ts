import { env } from '@env'
import postgres from 'postgres'
import { appConfigInput } from '../config.js'
import { bootstrapContainer } from '../container.js'
import { createNodeDbProvider } from '../core/db/node-provider.js'
import { WinstonLogger } from '../framework/logger/winston-logger.js'

/**
 * The Worker's composition root. Same modules, same links, same database as the API's — it is the
 * process that actually executes step actions, so it needs everything a route handler needs.
 *
 * One thing differs, and deliberately: the Worker pins the **simple** engine for itself. Two
 * workflows call another workflow's `.run()` from inside a step (`create-product`,
 * `complete-customer-auth`), and those nested runs are meant to stay inline. Leaving the Worker on
 * the derived default would make each one start its own Temporal execution from inside an
 * Activity — a different failure and compensation shape than the one those workflows were written
 * against, for no durability the outer execution does not already provide.
 *
 * Kept separate from `framework/runtime/container.node.ts` rather than reusing it, because that
 * module is a resolved singleton for the HTTP server: importing it here would build the API's
 * container, engine included, as a side effect of starting a Worker.
 */
export async function createWorkerContainer() {
  const client = postgres(env.DATABASE_URL, { prepare: false })
  const dbProvider = createNodeDbProvider(client)
  const logger = new WinstonLogger()

  const container = await bootstrapContainer({
    logger,
    dbProvider,
    config: {
      ...appConfigInput,
      projectConfig: { ...appConfigInput.projectConfig, workflows: { engine: 'simple' } },
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
