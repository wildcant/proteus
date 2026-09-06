import type { HttpRequest } from '../../server/ports.js'
import type { MiddlewareFunction } from './types.js'

export async function runMiddlewares(
  middlewares: readonly MiddlewareFunction[],
  req: HttpRequest,
): Promise<HttpRequest> {
  for (const middleware of middlewares) {
    req = await middleware(req)
  }
  return req
}
