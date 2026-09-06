import type { OpenAPIRegistry, RouteConfig } from '@asteasolutions/zod-to-openapi'
import type { RouteDefinition } from '@framework/http/types.js'
import { BEARER_SCHEME_NAME } from './registry.js'

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
  if (config.method === 'GET' && config.input?.query) {
    request.query = config.input.query as unknown as NonNullable<RouteConfig['request']>['query']
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

  if (!isPublic || config.returnsUnauthorized) {
    responses[401] = { description: 'Unauthorized' }
  }

  if (hasParams) {
    responses[404] = { description: 'Not found' }
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
