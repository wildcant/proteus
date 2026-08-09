import type { AwilixContainer } from 'awilix'
import express from 'express'
import qs from 'qs'
import { errorHandler } from '../../../core/errors/index.js'
import type { Logger } from '../../../core/types/logger.js'
import type { PreparedRoute } from '../../../server/ports.js'
import { corsHeaders } from '../../http/cors.js'

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

type CreateExpressAppOptions = {
  routes: PreparedRoute[]
  container: AwilixContainer
  logger: Logger
  corsOrigins: string[]
}

export function createExpressApp({ routes, container, logger, corsOrigins }: CreateExpressAppOptions) {
  const app = express()

  app.use(express.json())
  app.set('query parser', (str: string) => qs.parse(str))

  app.use((req, res, next) => {
    const headers = corsHeaders(req.headers.origin ?? '', corsOrigins)
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value)
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    next()
  })

  for (const route of routes) {
    const method = route.method.toLowerCase() as HttpMethod
    app[method](route.matcher, async (req, res) => {
      logger.http(`${req.method} ${req.path}`)
      try {
        const result = await route.handler({
          params: req.params as Record<string, string>,
          query: req.query as Record<string, unknown>,
          validatedQuery: {},
          body: req.body,
          headers: req.headers as Record<string, string>,
          scope: container.createScope(),
        })
        res.status(result.status).json(result.json)
      } catch (error) {
        const { status, json } = errorHandler(error, logger)
        res.status(status).json(json)
      }
    })
  }

  return app
}
