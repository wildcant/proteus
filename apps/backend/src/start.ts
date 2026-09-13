import type { Server } from 'node:http'
import swaggerUi from 'swagger-ui-express'
import type { DbProvider } from './core/db/ports.js'
import type { Logger } from './core/types/logger.js'
import { ContainerRegistrationKeys } from './core/utils/container.js'
import { env } from './env.js'
import { createRegistry, documentInfo, generateDocument } from './framework/http/openapi/registry.js'
import { closeWorkflowEngine, container } from './framework/runtime/container.node.js'
import { createExpressApp } from './framework/runtime/express/app.js'
import { assertTemporalFrontendReachable, probeTemporalFrontend } from './framework/temporal/preflight.js'
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

  // ---- Temporal preflight ----

  // First, and before the port is bound, because everything below it depends on a reachable
  // Temporal and nothing below it says so when it is missing: a checkout route dispatches a
  // workflow, and every `bus.emit` becomes an activity on a queue. Without this the failure mode is
  // a process that answered `/health` with 200 and then died on an unhandled rejection out of the
  // first request that needed the server. See `framework/temporal/preflight.ts`.
  await assertTemporalFrontendReachable({ address: env.TEMPORAL_ADDRESS, probe: probeTemporalFrontend })

  const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const dbProvider: DbProvider = container.resolve(ContainerRegistrationKeys.DB_PROVIDER)

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

  // ---- Static routes ----

  expressApp.get('/health', (_req, res) => res.json({ status: 'ok' }))
  expressApp.use((_req, res) => res.status(404).json({ error: 'Not Found' }))

  // ---- HTTP server ----

  const server = await new Promise<Server>((resolve, reject) => {
    // Express 5 delivers a bind failure to this callback instead of throwing it, so a port
    // collision resolves `start()` with a server that never listened unless we reject here.
    const onListening = (error?: Error) => (error ? reject(error) : resolve(httpServer))
    const httpServer = host ? expressApp.listen(port, host, onListening) : expressApp.listen(port, onListening)
  })

  // ---- Graceful shutdown ----

  async function shutdown() {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
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
