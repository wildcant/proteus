import type { MiddlewareFunction } from '@framework/http/types.js'

export function setPricingContext(): MiddlewareFunction {
  return (req) => {
    // TODO(pricing): resolve currency from region_id query param or cart
    // TODO(pricing): resolve customer groups for context-based pricing
    req.pricingContext = { currencyCode: 'usd' }
    return req
  }
}
