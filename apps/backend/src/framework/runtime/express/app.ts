import path from 'node:path'
import type { AwilixContainer } from 'awilix'
import express from 'express'
import qs from 'qs'
import { errorHandler } from '../../../core/errors/index.js'
import type { Logger } from '../../../core/types/logger.js'
import type { PreparedRoute } from '../../../server/ports.js'
import { isMultipart } from '../../http/content-type.js'
import { corsHeaders } from '../../http/cors.js'
import { extractFiles } from '../../http/multipart.js'

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

type CreateExpressAppOptions = {
  routes: PreparedRoute[]
  container: AwilixContainer
  logger: Logger
  corsOrigins: string[]
}

async function toWebRequest(req: express.Request): Promise<Request> {
  const protocol = req.protocol
  const host = req.get('host') ?? 'localhost'
  const url = `${protocol}://${host}${req.originalUrl}`

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      headers.set(key, value)
    }
  }

  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }

  return new Request(url, {
    method: req.method,
    headers,
    body: Buffer.concat(chunks),
    // @ts-expect-error -- Node needs duplex for request bodies
    duplex: 'half',
  })
}

export function createExpressApp({ routes, container, logger, corsOrigins }: CreateExpressAppOptions) {
  const app = express()

  // `verify` is the only place the untouched bytes are still in hand — by the time the handler
  // runs, `req.body` is a parsed object and the buffer is gone. Keyed off the request object
  // rather than assigned onto it, so no route sees a property Express never promised.
  const rawBodies = new WeakMap<express.Request, Uint8Array>()

  app.use(
    express.json({
      type: 'application/json',
      // Copied, not aliased: the buffer Express hands over is its own and must not outlive the
      // parse it was made for.
      verify: (req, _res, buffer) => rawBodies.set(req as express.Request, new Uint8Array(buffer)),
    }),
  )
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

  app.use('/static', express.static(path.join(process.cwd(), 'static')))

  for (const route of routes) {
    const method = route.method.toLowerCase() as HttpMethod
    app[method](route.matcher, async (req, res) => {
      logger.http(`${req.method} ${req.path}`)
      try {
        const hasBody = !['GET', 'HEAD', 'DELETE'].includes(req.method)
        const multipart = hasBody && isMultipart(req.headers['content-type'])

        const files = multipart ? await extractFiles(await toWebRequest(req)) : undefined
        const body = multipart ? undefined : req.body

        const result = await route.handler({
          params: req.params as Record<string, string>,
          query: req.query as Record<string, unknown>,
          validatedQuery: {},
          body,
          rawBody: rawBodies.get(req),
          files,
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
