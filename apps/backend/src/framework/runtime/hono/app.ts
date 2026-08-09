import type { AwilixContainer } from 'awilix'
import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import qs from 'qs'
import type { DbProvider } from '../../../core/db/ports.js'
import { errorHandler } from '../../../core/errors/index.js'
import type { Logger } from '../../../core/types/logger.js'
import { ContainerRegistrationKeys } from '../../../core/utils/index.js'
import type { PreparedRoute } from '../../../server/ports.js'
import { corsHeaders } from '../../http/cors.js'

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

type CreateHonoAppOptions = {
  routes: PreparedRoute[]
  container: AwilixContainer
  logger: Logger
  corsOrigins: string[]
}

export function createHonoApp({ routes, container, logger, corsOrigins }: CreateHonoAppOptions) {
  const app = new Hono()
  const dbProvider: DbProvider = container.resolve(ContainerRegistrationKeys.DB_PROVIDER)

  // Per-request DB connection for Workers
  app.use('*', async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      await next()
      return
    }
    await dbProvider.withConnection(() => next())
  })

  app.on('OPTIONS', '*', (c) => {
    for (const [key, value] of Object.entries(corsHeaders(c.req.header('origin') ?? '', corsOrigins))) {
      c.header(key, value)
    }
    return c.body(null, 204)
  })

  app.use('*', async (c, next) => {
    for (const [key, value] of Object.entries(corsHeaders(c.req.header('origin') ?? '', corsOrigins))) {
      c.header(key, value)
    }
    await next()
  })

  for (const route of routes) {
    const method = route.method.toLowerCase() as HttpMethod
    app[method](route.matcher, async (c) => {
      const url = new URL(c.req.url)
      const query = qs.parse(url.search, { ignoreQueryPrefix: true }) as Record<string, unknown>
      const hasBody = !['GET', 'HEAD', 'DELETE'].includes(c.req.method)
      const body = hasBody ? await c.req.json().catch(() => undefined) : undefined
      const headers: Record<string, string> = {}
      c.req.raw.headers.forEach((value, key) => {
        headers[key] = value
      })

      logger.http(`${c.req.method} ${url.pathname}`)
      try {
        const result = await route.handler({
          params: c.req.param() as Record<string, string>,
          query,
          validatedQuery: {},
          body,
          headers,
          scope: container.createScope(),
        })
        return c.json(result.json, result.status as ContentfulStatusCode)
      } catch (error) {
        const { status, json } = errorHandler(error, logger)
        return c.json(json, status as ContentfulStatusCode)
      }
    })
  }

  return app
}
