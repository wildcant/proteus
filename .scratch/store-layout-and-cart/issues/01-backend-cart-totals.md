# 01 — Backend cart totals

**What to build:** Two backend cart improvements:

**1. Wire `currencyCode` from middleware into cart creation.** `currencyCode` has been removed from the `CreateCart` request body schema. The cart creation API route now needs to read `req.pricingContext.currencyCode` and merge it into the service call data. Add the `setPricingContext` middleware (from the products middleware) to the cart route definitions so the pricing context is available.

**2. Add computed totals to the cart detail response.** The `GET /store/carts/:id` endpoint currently returns a cart with its line items and shipping methods but no computed totals. Add a `totals` object so the storefront can display items total, shipping total, and cart total without client-side arithmetic on arbitrary-precision numeric strings.

The totals shape:

```ts
type StoreCartTotals = {
  itemsTotal: string   // sum of (unitPrice * quantity) per line item
  shippingTotal: string // sum of shipping method amounts
  cartTotal: string     // itemsTotal + shippingTotal
}
```

Totals computation is a presentation concern — it belongs in the API route handler that assembles the cart detail response, not in the cart module service. Do NOT add a service method.

**Arithmetic:** The `bignum` column type returns `BigNumber` instances (from `bignumber.js`) at runtime, not strings. The Zod schema uses `bigNumberToString` (which calls `.toFixed()`) to serialize them. The order module's `computeOrderTotals` demonstrates the pattern: `item.unitPrice.multipliedBy(item.quantity)` with `.plus()` accumulation on a `new BigNumber(0)` accumulator. Follow this pattern exactly — do not convert to `Number` or use string arithmetic.

**Zod schema:** The `StoreCartTotals` schema fields must use `bigNumberToString` (not `z.string()`), so the API route can pass `BigNumber` objects and Zod transforms them to strings. Reference `StoreOrderTotals` in `packages/http-schemas/src/store/order/entities.ts` for the exact pattern — same shape, just with `cartTotal` instead of `orderTotal`.

Add the `StoreCartTotals` schema to the cart entities in `http-schemas` and extend `StoreCartDetailResponse` to include it. After the schema change, regenerate everything with `npm run openapi:generate` (this dumps the OpenAPI spec AND regenerates both admin and store Orval clients in one command).

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Cart creation API route reads `currencyCode` from `req.pricingContext.currencyCode` and merges it into the service call
- [ ] `setPricingContext` middleware applied to cart routes (reuse from products or extract to shared location)
- [ ] `StoreCartTotals` Zod schema added to `http-schemas` store cart entities
- [ ] `StoreCartDetailResponse` extended to include `totals`
- [ ] Cart detail API route computes `itemsTotal` from line items (`unitPrice * quantity` summed)
- [ ] Cart detail API route computes `shippingTotal` from shipping methods (`amount` summed)
- [ ] Cart detail API route computes `cartTotal` as `itemsTotal + shippingTotal`
- [ ] Totals are zero-safe (empty cart returns `"0"` for all totals, not null or undefined)
- [ ] Orval store client regenerated — generated types include `totals` on the cart detail response (run `npm run openapi:generate` which does both OpenAPI dump + Orval regen)
