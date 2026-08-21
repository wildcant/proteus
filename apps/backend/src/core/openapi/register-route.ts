import type { OpenAPIRegistry, RouteConfig } from '@asteasolutions/zod-to-openapi'
import type { RouteDefinition } from '@framework/http/types.js'

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

  const hasParams = config.input?.params != null
  const responses: RouteConfig['responses'] = {
    200: {
      description: 'Successful response',
      ...(config.output ? { content: { 'application/json': { schema: config.output } } } : {}),
    },
    400: { description: 'Validation error' },
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
    request,
    responses,
  }

  registry.registerPath(routeConfig)
}
