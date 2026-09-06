import type { Server } from 'node:http'
import type { RequestHandler } from 'express'
import swaggerUi from 'swagger-ui-express'
import type { DbProvider } from './core/db/ports.js'
import { createRegistry, documentInfo, generateDocument } from './core/openapi/registry.js'
import type { Logger } from './core/types/logger.js'
import type { CronScheduler } from './core/types/scheduler.js'
import { ContainerRegistrationKeys } from './core/utils/index.js'
import { env } from './env.js'
import { closeWorkflowEngine, container } from './framework/runtime/container.node.js'
import { createExpressApp } from './framework/runtime/express/app.js'
import { jobs } from './jobs/index.js'
import { prepareRoutes } from './routes.js'

type StartOptions = {
  port?: number
  host?: string
  shutdownTimeout?: number
}

type StartResult = {
  server: Server
  shutdown: () => Promise<void>
}

export async function start(options?: StartOptions): Promise<StartResult> {
  const { port = 3000, host, shutdownTimeout = 10_000 } = options ?? {}

  const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const dbProvider: DbProvider = container.resolve(ContainerRegistrationKeys.DB_PROVIDER)
  const scheduler: CronScheduler = container.resolve(ContainerRegistrationKeys.SCHEDULER)

  // ---- Routes + OpenAPI ----

  const adminRegistry = createRegistry()
  const storeRegistry = createRegistry()
  const routes = prepareRoutes(logger, { admin: adminRegistry, store: storeRegistry })

  const expressApp = createExpressApp({
    routes,
    container,
    logger,
    corsOrigins: env.CORS_ORIGIN,
  })

  // ---- Swagger UI ----

  const adminDocument = generateDocument(adminRegistry, documentInfo.admin)
  const storeDocument = generateDocument(storeRegistry, documentInfo.store)
  expressApp.use('/admin/docs', swaggerUi.serve, swaggerUi.setup(adminDocument))
  expressApp.use('/store/docs', swaggerUi.serve, swaggerUi.setup(storeDocument))
  expressApp.get('/admin/openapi.json', (_req, res) => res.json(adminDocument))
  expressApp.get('/store/openapi.json', (_req, res) => res.json(storeDocument))

  // ---- Scheduler monitor ----

  expressApp.use('/admin/queues', scheduler.mountMonitor() as RequestHandler)

  // ---- Static routes ----

  expressApp.get('/health', (_req, res) => res.json({ status: 'ok' }))
  expressApp.use((_req, res) => res.status(404).json({ error: 'Not Found' }))

  // ---- HTTP server ----

  const server = await new Promise<Server>((resolve) => {
    const onListening = () => resolve(httpServer)
    const httpServer = host ? expressApp.listen(port, host, onListening) : expressApp.listen(port, onListening)
  })

  // ---- Cron jobs ----

  // The test server shares its database with the backend test suite, and BullMQ's
  // queue lives in that same database. A worker here would compete with the suite's
  // own worker for `proteus-cron-jobs` and swallow the jobs its tests enqueue.
  if (env.NODE_ENV === 'test') {
    logger.info('[CronScheduler] Not started: NODE_ENV=test')
  } else {
    await scheduler.start(jobs)
  }

  // ---- Graceful shutdown ----

  async function shutdown() {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
    await scheduler.shutdown()
    await closeWorkflowEngine()
    await dbProvider.shutdown()
    await container.dispose()
  }

  let shutdownInProgress = false

  async function handleSignal(signal: string) {
    if (shutdownInProgress) return
    shutdownInProgress = true

    logger.info(`Received ${signal}, shutting down...`)

    const forceExit = setTimeout(() => {
      logger.warn('Shutdown timed out, forcing exit')
      process.exit(1)
    }, shutdownTimeout).unref()

    await shutdown()

    clearTimeout(forceExit)
    process.exit(0)
  }

  process.on('SIGTERM', () => handleSignal('SIGTERM'))
  process.on('SIGINT', () => handleSignal('SIGINT'))

  logger.info(`Server ready on port ${port}`)

  return { server, shutdown }
}
