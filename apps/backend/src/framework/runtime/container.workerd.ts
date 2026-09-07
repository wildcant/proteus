/** Workers entry point — per-request connections, console logger. */

import { env } from '@env'
import { bootstrapContainer } from '../../container.js'
import { createWorkersDbProvider } from '../../core/db/workers-provider.js'
import { ConsoleLogger } from '../logger/console-logger.js'

const dbProvider = createWorkersDbProvider(env.DATABASE_URL)
const logger = new ConsoleLogger()

export const container = await bootstrapContainer({ logger, dbProvider })
export { dbProvider }
