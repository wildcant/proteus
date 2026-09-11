import type { OpenAPIRegistry, RouteConfig } from '@asteasolutions/zod-to-openapi'
import { ErrorTypes } from '@core/errors/app-error.js'
import { typeToStatus } from '@core/errors/error-handler.js'
import type { RouteDefinition } from '@framework/http/types.js'
import type { z } from 'zod'
import { BEARER_SCHEME_NAME } from './registry.js'

/** One line per `ErrorTypes` member. The `Record` is what makes a new member a compile error here
 *  rather than a spec carrying an undescribed response. */
const describe: Record<ErrorTypes, string> = {
  [ErrorTypes.UNAUTHORIZED]: 'Unauthorized',
  [ErrorTypes.FORBIDDEN]: 'Forbidden',
  [ErrorTypes.NOT_FOUND]: 'Not found',
  [ErrorTypes.NOT_ALLOWED]: 'Validation error',
  [ErrorTypes.INVALID_DATA]: 'Validation error',
  [ErrorTypes.INVALID_ARGUMENT]: 'Validation error',
  [ErrorTypes.CONFLICT]: 'Conflict',
  [ErrorTypes.DUPLICATE_ERROR]: 'Unprocessable entity',
  [ErrorTypes.DB_ERROR]: 'Internal server error',
  [ErrorTypes.UNEXPECTED_STATE]: 'Internal server error',
  [ErrorTypes.SERVICE_UNAVAILABLE]: 'Service unavailable',
}

const methodMap = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete',
} as const

export function registerOpenApiRoute(registry: OpenAPIRegistry, routePath: string, config: RouteDefinition) {
  const method = methodMap[config.method]
  const openApiPath = routePath.replace(/:(\w+)/g, '{$1}')

  const request: RouteConfig['request'] = {}

  if (config.input?.params) {
    request.params = config.input.params as unknown as NonNullable<RouteConfig['request']>['params']
  }
  // A GET's own query describes the rows it wants; `contextQuery` describes where any request is
  // coming from, so it is documented on every method. Merged rather than assigned, because
  // OpenAPI takes one schema for the whole query string.
  const query = config.method === 'GET' ? config.input?.query : undefined
  const contextQuery = config.input?.contextQuery
  const mergedQuery =
    query && contextQuery ? (query as unknown as z.ZodObject).extend(contextQuery.shape) : (query ?? contextQuery)
  if (mergedQuery) {
    request.query = mergedQuery as unknown as NonNullable<RouteConfig['request']>['query']
  }
  if (config.method === 'POST' || config.method === 'PUT' || config.method === 'PATCH') {
    const multipartBody = config.multipartBody
    if (multipartBody) {
      request.body = { content: { 'multipart/form-data': { schema: multipartBody } } }
    } else if (config.input?.body) {
      request.body = { content: { 'application/json': { schema: config.input.body } } }
    }
  }

  // A root-level `security` is not inherited by operations as far as Spectral is concerned —
  // it reads the JSONPath literally — so every operation states its own requirement.
  const isPublic = (config.auth ?? 'required') === 'public'
  const security: RouteConfig['security'] = isPublic ? [] : [{ [BEARER_SCHEME_NAME]: [] }]

  const hasParams = config.input?.params != null
  const responses: RouteConfig['responses'] = {
    200: {
      description: 'Successful response',
      ...(config.output ? { content: { 'application/json': { schema: config.output } } } : {}),
    },
    400: { description: 'Validation error' },
  }

  // Structural, and so not restated in `throws`: `applyNamespaceAuth` injects `authenticate` for
  // every policy but `public`, which sends a 401 before the handler is reached.
  if (!isPublic) {
    responses[401] = { description: 'Unauthorized' }
  }

  // A heuristic that outlives `throws` on purpose. Module services raise their own `NOT_FOUND` —
  // `retrieveOrder` and its siblings — and those throws are neither in a handler nor in a workflow,
  // so nothing declares them. Until that tier is covered, a route addressing one entity keeps
  // documenting the 404 it has always documented.
  if (hasParams) {
    responses[404] = { description: 'Not found' }
  }

  // `throws` is the complete failure contract, so it names `UNEXPECTED_STATE` and the other
  // invariant violations too — the rules in `standards/` demand it, or they could not tell a missing
  // declaration from a deliberate one. The *document* publishes only the part a caller can act on.
  // A 5xx is not something the request can be reshaped to avoid, and declaring it would put a
  // dead error branch in every generated client.
  for (const type of config.throws ?? []) {
    const status = typeToStatus[type]
    // Already-declared statuses keep the wording set above — several types share a 400, and the
    // structural one is the honest description of it.
    if (status >= 500 || responses[status]) continue
    responses[status] = { description: describe[type] }
  }

  const routeConfig: RouteConfig = {
    method,
    path: openApiPath,
    operationId: config.operationId,
    ...(config.summary !== undefined && { summary: config.summary }),
    ...(config.description !== undefined && { description: config.description }),
    tags: config.tags,
    security,
    request,
    responses,
  }

  registry.registerPath(routeConfig)
}
