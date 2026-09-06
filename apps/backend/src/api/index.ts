/**
 * Backend-as-library exports.
 *
 * When the store imports route handlers via `createServerFn`, there is no
 * HTTP layer — so the route loader's middleware never runs. This module wraps
 * each handler with the same middleware (validation, query parsing) that the
 * HTTP path applies, using the route definitions as the single source of truth.
 */

import { applyMiddleware } from '@framework/http/apply-middleware.js'
import type { RouteDefinition } from '@framework/http/types.js'
import type { RouteHandler } from '@server/ports.js'
import customerDefinitions from './admin/customers/definitions.js'
import userDefinitions from './admin/users/definitions.js'

export { apiCall } from '@server/api-caller.js'

function withMiddleware(matcher: string, definitions: RouteDefinition[]): Record<string, RouteHandler> {
  const result: Record<string, RouteHandler> = {}
  for (const definition of definitions) {
    if (definition.matcher === matcher) {
      result[definition.method] = applyMiddleware(definition)
    }
  }
  return result
}

export const usersApi = withMiddleware('/admin/users', userDefinitions)
export const userByIdApi = withMiddleware('/admin/users/:id', userDefinitions)
export const customersApi = withMiddleware('/admin/customers', customerDefinitions)
export const customerByIdApi = withMiddleware('/admin/customers/:id', customerDefinitions)
