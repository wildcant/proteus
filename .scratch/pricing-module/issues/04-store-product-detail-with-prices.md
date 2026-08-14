# 04 — Store product detail with calculated prices

**What to build:** The store product detail endpoint (`GET /store/products/:id`) returns a `calculatedPrice` object on each variant, so the storefront can display prices. A pricing context middleware sets the currency (hardcoded to USD for now). The store product list endpoint is unchanged — it does not return variants and therefore has no pricing enrichment.

The enrichment flow in the product detail route handler: collect all variant IDs from the product, query `productVariantPriceSet` links to get a variantId-to-priceSetId map, call `calculatePrices()` with the price set IDs and the pricing context from the request, attach `calculatedPrice` to each variant (or `null` if no price set is linked).

Implementation details:

In `apps/backend/src/server/ports.ts`, add to the `HttpRequest` type:

```typescript
pricingContext?: { currencyCode: string }
```

Create middleware at `apps/backend/src/api/store/products/middlewares.ts`:

```typescript
import type { MiddlewareFunction } from '@framework/http/types.js'

export function setPricingContext(): MiddlewareFunction {
  return (req) => {
    // TODO(pricing): resolve currency from region_id query param or cart
    // TODO(pricing): resolve customer groups for context-based pricing
    req.pricingContext = { currencyCode: 'usd' }
    return req
  }
}
```

In `apps/backend/src/api/store/products/definitions.ts`, add `middlewares: [setPricingContext()]` to the product detail route definition (`GET /store/products/:id`).

In `packages/http-schemas/src/store/product/entities.ts`, add:

```typescript
const StoreCalculatedPrice = z.object({
  id: z.string(),
  currencyCode: z.string(),
  originalAmount: bigNumberToString,
  // TODO(pricing): add calculatedAmount when PriceRule/PriceList is implemented
  // TODO(tax): add originalAmountWithTax, originalAmountWithoutTax
})
```

Add `calculatedPrice: StoreCalculatedPrice.nullable()` to the `StoreProductVariant` entity schema. Import `bigNumberToString` from `../../common.js`.

In the store product detail route handler, resolve services:

```typescript
const pricingService = req.scope.resolve<IPricingModuleService>(Modules.PRICING)
const linkService = req.scope.resolve<LinkService>(ContainerRegistrationKeys.LINK)
const linkRepository = linkService.repo('productVariantPriceSet')
```

**Blocked by:** 02 — Variant-to-price linking and price calculation

**Status:** ready-for-agent

- [ ] `HttpRequest` type extended with an optional `pricingContext` property in `apps/backend/src/server/ports.ts` (must be optional to avoid breaking non-pricing routes)
- [ ] Pricing context middleware created at `apps/backend/src/api/store/products/middlewares.ts`
- [ ] Middleware applied to store product detail route definition in `apps/backend/src/api/store/products/definitions.ts`
- [ ] `StoreCalculatedPrice` Zod schema added to `packages/http-schemas/src/store/product/entities.ts` with TODO comments for future fields
- [ ] `calculatedPrice: StoreCalculatedPrice.nullable()` added to the store variant entity schema
- [ ] Store product detail route handler enriches variants with `calculatedPrice` after fetching from the product service
- [ ] Variants with no linked price set get `calculatedPrice: null`
- [ ] Store product list endpoint unchanged (no pricing, no variants)
- [ ] HTTP schema changes regenerated (Orval clients updated)
