import type { RouteHandler } from '@server/ports.js'
import { AppError, ErrorTypes } from '../../core/errors/app-error.js'
import { formatZodIssues } from '../../core/errors/format-zod-issues.js'
import { buildSearchFilter } from '../../core/utils/build-search-filter.js'
import { parseOrder, validateQuery } from '../../core/utils/validate-query.js'
import { runMiddlewares } from './run-middlewares.js'
import type { RouteDefinition } from './types.js'

export function applyMiddleware(definition: RouteDefinition): RouteHandler {
  return (async (req) => {
    if (definition.middlewares) req = await runMiddlewares(definition.middlewares, req)
    if (definition.input?.params) {
      const result = definition.input.params.safeParse(req.params)
      if (!result.success) {
        throw new AppError({
          type: ErrorTypes.INVALID_DATA,
          message: `Invalid path params: ${formatZodIssues(result.error.issues)}`,
        })
      }
      req = { ...req, params: result.data as typeof req.params }
    }

    if (definition.method === 'GET' && definition.input?.query) {
      const validated = validateQuery(definition.input.query, req.query)
      const { offset, limit, order, q, ...filters } = validated as Record<string, unknown>
      const searchFilter =
        typeof q === 'string' && definition.searchableColumns ? buildSearchFilter(q, definition.searchableColumns) : {}
      req = {
        ...req,
        validatedQuery: {
          pagination: { offset, limit, order: parseOrder(order as string | undefined) },
          filters: { ...filters, ...searchFilter },
        },
      }
    }

    if (
      (definition.method === 'POST' || definition.method === 'PUT' || definition.method === 'PATCH') &&
      definition.input?.body
    ) {
      const result = definition.input.body.safeParse(req.body)
      if (!result.success) {
        throw new AppError({
          type: ErrorTypes.INVALID_DATA,
          message: `Invalid request body: ${formatZodIssues(result.error.issues)}`,
        })
      }
      req = { ...req, body: result.data }
    }

    const result = await definition.handler(req)

    return { ...result, json: definition.output.parse(result.json) }
  }) as RouteHandler
}
