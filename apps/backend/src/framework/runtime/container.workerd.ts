/** Workers entry point — per-request connections, console logger. */

import { env } from '@env'
import { appConfigInput } from '../../config.js'
import { bootstrapContainer } from '../../container.js'
import { createWorkersDbProvider } from '../../core/db/workers-provider.js'
import { ConsoleLogger } from '../logger/console-logger.js'

const dbProvider = createWorkersDbProvider(env.DATABASE_URL)
const logger = new ConsoleLogger()

export const container = await bootstrapContainer({
  logger,
  dbProvider,
  /**
   * The derived adapter here is Cloudflare Queues, which is ILLO-88. Pinned to the in-process one
   * until that lands — nothing on this runtime publishes yet, so the pin has nothing to change.
   * Spread from `appConfigInput` because passing a bare `projectConfig` would drop the http settings
   * and silently turn off customer email verification.
   */
  config: {
    ...appConfigInput,
    projectConfig: { ...appConfigInput.projectConfig, eventBus: { adapter: 'inline' } },
  },
})
export { dbProvider }
