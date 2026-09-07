import { env as bindings } from 'cloudflare:workers'
import { createCloudflareQueuesConsumer } from './core/event-bus/cloudflare-queues-adapter.js'
import { subscriberRegistry } from './core/event-bus/registry.js'
import type { Logger } from './core/types/logger.js'
import { ContainerRegistrationKeys } from './core/utils/index.js'
import { env } from './env.js'
import { createWorkerdContainer, dbProvider } from './framework/runtime/container.workerd.js'
import { createHonoApp } from './framework/runtime/hono/app.js'
import { Cron } from './framework/scheduler/kuron/index.js'
import { jobs } from './jobs/index.js'
import { prepareRoutes } from './routes.js'

/**
 * `bindings` is workerd's own env, and it is a different thing from `./env.js` — one holds live
 * objects the runtime built from `wrangler.jsonc`, the other holds parsed strings. A queue binding
 * cannot be serialised into a string, so it can only be read here, and reading it here is also what
 * keeps `cloudflare:workers` out of every module the node build shares.
 */
const container = await createWorkerdContainer({ events: bindings.EVENTS })

const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER)
const routes = prepareRoutes(logger)

const app = createHonoApp({
  routes,
  container,
  logger,
  corsOrigins: env.CORS_ORIGIN,
})

const cron = new Cron()
for (const job of jobs.filter((j) => !j.disabled)) {
  cron.schedule(job.schedule, async () => {
    logger.info(`[CronScheduler] Running "${job.name}"`)
    await job.handler(container)
  })
}

/**
 * The event consumer, alongside the cron one. Both run work that no request is waiting for, and
 * both need a database connection of their own — the connection belonging to the request that
 * published an event is closed long before its message is delivered.
 */
const queue = createCloudflareQueuesConsumer({ registry: subscriberRegistry, container, logger, dbProvider })

export default {
  fetch: app.fetch,
  scheduled: cron.scheduled,
  queue,
}
