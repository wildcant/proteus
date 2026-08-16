# 02 — Variant-to-price linking and price calculation

**What to build:** A link table connecting product variants to price sets, and a `calculatePrices` service method that resolves the best price per price set for a given currency. After this ticket, you can create a variant, create a price set with a USD price, link them, and call `calculatePrices` to get the resolved price back.

The link table follows ADR-0004 (Link Modules for Cross-Module Joins): a writable link with its own BaseRepository, registered in LinkService. The `priceSetTable` is re-exported through the link modules re-export hub (`apps/backend/src/link-modules/modules-definitions.ts`) — never imported directly from the pricing module.

Two files serve different purposes and both need updates:

- `modules-definitions.ts` — the re-export hub for link module definitions (so link table relations can reference module tables)
- `schema.ts` — the combined schema for Drizzle's typed client (so relational queries resolve pricing tables)

`calculatePrices` is the single entry point for price resolution. For MVP (no rules, no price lists), it queries prices matching the given price set IDs and currency code, returning a `Map<priceSetId, CalculatedPriceSet>`. The `CalculatedPriceSet` type was defined in ticket 01 in `apps/backend/src/core/types/pricing/common.ts`. It contains only `originalAmount` for now — `calculatedAmount` is added later when PriceRule/PriceList arrives (non-breaking addition).

The `calculatePrices` implementation should include TODO comments:

```
// TODO(pricing): when PriceRule exists, apply rule matching and specificity ordering
// TODO(pricing): when PriceList exists, apply SALE vs OVERRIDE logic
// For now: first matching price wins (one price per set per currency)
```

Registration requires updating multiple files in the link module infrastructure:

- In `apps/backend/src/link-modules/services/link-service.ts`: add `productVariantPriceSet: ProductVariantPriceSetRepository` to `LinkRepositoryMap`, add to constructor destructuring and `this.repositories`
- In `apps/backend/src/link-modules/index.ts` (`registerLinkService`): instantiate `ProductVariantPriceSetRepository` with `{ getDb }`, pass to `LinkService` constructor
- The `calculatePrices` method signature was already defined on `IPricingModuleService` in ticket 01 — this ticket adds the implementation

**Blocked by:** 01 — Pricing module core

**Status:** ready-for-agent

- [ ] `productVariantPriceSet` link table defined with `pvps_` ID prefix, `variantId`, `priceSetId`, timestamps, unique index on (variantId, priceSetId) excluding soft-deleted, individual indexes on both columns
- [ ] Drizzle relations to `productVariantTable` and `priceSetTable` (imported via link modules re-export hub)
- [ ] `priceSetTable` re-exported from the link modules definitions hub
- [ ] `ProductVariantPriceSetRepository` extends BaseRepository with `findByVariantIds(variantIds[], context?)` custom method
- [ ] `PRODUCT_VARIANT_PRICE_SET` added to Links enum
- [ ] Repository registered in LinkService
- [ ] Link table added to link module database config schema array (`apps/backend/src/link-modules/database.config.ts`) and definitions index re-export (`apps/backend/src/link-modules/definitions/index.ts`)
- [ ] Link table and relations registered in `apps/backend/src/schema.ts`
- [ ] `LinkRepositoryMap` type, `InjectedDependencies`, and `LinkService` constructor updated in `link-service.ts`
- [ ] `registerLinkService()` in `apps/backend/src/link-modules/index.ts` updated to instantiate and pass `ProductVariantPriceSetRepository`
- [ ] `calculatePrices(priceSetIds[], context: PricingContext)` implemented on PricingModuleService — returns `Map<string, CalculatedPriceSet>`, first matching price per set wins
- [ ] Integration tests: calculatePrices with single price set, multiple price sets, missing price set returns no entry in map, correct currency matching
