import type { Logger } from './core/types/logger.js'
import { ContainerRegistrationKeys } from './core/utils/index.js'
import { env } from './env.js'
import { Cron } from './framework/scheduler/kuron/index.js'
import { container } from './framework/runtime/container.workerd.js'
import { createHonoApp } from './framework/runtime/hono/app.js'
import { jobs } from './jobs/index.js'
import { prepareRoutes } from './routes.js'

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

export default {
  fetch: app.fetch,
  scheduled: cron.scheduled,
}
