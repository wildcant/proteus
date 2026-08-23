/**
 * Stands up the API the way the real server does — bootstrapped container, sorted routes,
 * middleware applied, listening Express server — so tests do not each hand-roll it.
 */

import { createServer, type Server } from 'node:http'
import type { errorHandler } from '@core/errors/index.js'
import type { Logger } from '@core/types/logger.js'
import { applyMiddleware } from '@framework/http/apply-middleware.js'
import { applyNamespaceAuth } from '@framework/http/namespace-auth.js'
import { RoutesSorter } from '@framework/http/routes-sorter.js'
import type { RouteDefinition } from '@framework/http/types.js'
import type { AwilixContainer } from 'awilix'
import type { Express } from 'express'
import qs from 'qs'
import request, { type Agent } from 'supertest'
import type { ZodType } from 'zod'
import { createExpressApp } from '../../src/framework/runtime/express/app.js'
import type { Database } from '../../src/schema.type.js'
import { type CreateContainerOptions, createTestContainer } from './create-container.js'

export type CreateApiOptions = CreateContainerOptions & {
  /** Definitions to mount. Sorted with the same RoutesSorter the real server uses. */
  definitions?: RouteDefinition[]
  /** Mount only these matchers. Omitted mounts everything passed. */
  matchers?: string[]
  /** Inject the namespace auth middleware prepareRoutes applies to /admin and /store. */
  namespaceAuth?: boolean
}

/**
 * The wire shape of a route's output schema. `HttpResult` infers the *input* side — `Date`
 * objects, as the handler returns them — but a verb reads the response after `dateToIso` and
 * `JSON.parse` have run, so the same schema resolves to ISO strings here.
 */
type InferBody<T> = T extends ZodType ? T['_zod']['output'] : T

/**
 * What `errorHandler` serializes for anything that throws. Pass it as the verb's generic when a
 * test asserts on a failure, so `type` and `message` are typed rather than cast.
 */
export type ApiErrorBody = ReturnType<typeof errorHandler>['json']

/** Only what assertions read. Anything else — response headers, redirects — goes through `request`. */
export type TestResponse<T = Record<string, unknown>> = {
  status: number
  body: InferBody<T>
}

export type RequestOptions = {
  headers?: Record<string, string>
  /** Serialized with `qs`, matching the parser the server uses, so nested operator params
   *  (`$eq`, `$in`) survive the trip. */
  query?: Record<string, unknown>
}

export type RequestVerb = <T = Record<string, unknown>>(
  path: string,
  body?: object,
  options?: RequestOptions,
) => Promise<TestResponse<T>>

export type TestApi = {
  container: AwilixContainer
  /** JSON verbs over the listening server: sets `Content-Type`, sends `body`, unwraps the
   *  response. Callers pass `headers` for things like `{ authorization: 'Bearer …' }`. */
  get: RequestVerb
  post: RequestVerb
  put: RequestVerb
  patch: RequestVerb
  delete: RequestVerb
  /** Raw supertest, for what the verbs deliberately do not cover — multipart, response
   *  headers, cookies. Bound to an already-listening server, so no ephemeral server is
   *  created per call: that startup jitter is enough to stop concurrent requests overlapping. */
  request: Agent
  /** Idempotent. Closes the server and disposes the container. */
  close: () => Promise<void>
}

/**
 * `applyNamespaceAuth` prepends to `definition.middlewares` in place and is not idempotent,
 * so a copy keeps a second `createApi` in the same file from stacking a second auth
 * middleware onto the shared definition object.
 */
function withNamespaceAuth(definition: RouteDefinition): RouteDefinition {
  const copy = { ...definition }
  applyNamespaceAuth(copy)
  return copy
}

const listen = (app: Express) =>
  new Promise<Server>((resolve) => {
    const server = createServer(app)
    server.listen(0, () => resolve(server))
  })

export async function createApi(
  deps: { getDb: () => Database; logger: Logger },
  options: CreateApiOptions = {},
): Promise<TestApi> {
  const { logger } = deps

  const selected = (options.definitions ?? []).filter(
    (definition) => !options.matchers || options.matchers.includes(definition.matcher),
  )
  const mounted = options.namespaceAuth ? selected.map(withNamespaceAuth) : selected

  const { container, close: disposeContainer } = await createTestContainer(deps, options)

  let server: Server | undefined
  let closed = false

  const close = async () => {
    if (closed) return
    closed = true
    const running = server
    if (running) await new Promise<void>((resolve) => running.close(() => resolve()))
    await disposeContainer()
  }

  try {
    if (mounted.length > 0) {
      const routes = new RoutesSorter(mounted).sort().map((definition) => ({
        method: definition.method,
        matcher: definition.matcher,
        handler: applyMiddleware(definition),
      }))
      server = await listen(createExpressApp({ routes, container, logger, corsOrigins: [] }))
    }
  } catch (error) {
    // Otherwise a container — and its twelve modules — leaks for every failed setup.
    await close()
    throw error
  }

  const agent = (): Agent => {
    if (!server) throw new Error('createApi mounted no routes, so nothing is listening')
    return request(server)
  }

  // Content-Type goes on first so a caller-supplied one wins.
  const verb =
    (method: 'get' | 'post' | 'put' | 'patch' | 'delete'): RequestVerb =>
    async (path, body, options) => {
      const search = options?.query ? qs.stringify(options.query) : ''
      const response = await agent()
        [method](search ? `${path}?${search}` : path)
        .set('Content-Type', 'application/json')
        .set(options?.headers ?? {})
        .send(body)
      return { status: response.status, body: response.body }
    }

  const verbs = {
    get: verb('get'),
    post: verb('post'),
    put: verb('put'),
    patch: verb('patch'),
    delete: verb('delete'),
  }

  return {
    container,
    ...verbs,
    get request() {
      return agent()
    },
    close,
  }
}
