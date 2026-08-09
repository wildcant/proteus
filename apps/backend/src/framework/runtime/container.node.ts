/** Node entry point — singleton connection pool, winston logger. */

import postgres from 'postgres'
import { bootstrapContainer } from '../../container.js'
import { createNodeDbProvider } from '../../core/db/node-provider.js'
import { env } from '../../env.js'
import { WinstonLogger } from '../logger/winston-logger.js'
import { registerScheduler } from '../scheduler/index.js'

const client = postgres(env.DATABASE_URL, { prepare: false })
const dbProvider = createNodeDbProvider(client)
const logger = new WinstonLogger()

export const container = await bootstrapContainer({ logger, dbProvider })
registerScheduler(container, logger)
