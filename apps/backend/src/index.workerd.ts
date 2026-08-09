import type { Logger } from './core/types/logger.js'
import { ContainerRegistrationKeys } from './core/utils/index.js'
import { env } from './env.js'
import { container } from './framework/runtime/container.workerd.js'
import { createHonoApp } from './framework/runtime/hono/app.js'
import { prepareRoutes } from './routes.js'

const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER)
const routes = prepareRoutes(logger)

export default createHonoApp({
  routes,
  container,
  logger,
  corsOrigins: env.CORS_ORIGIN,
})
