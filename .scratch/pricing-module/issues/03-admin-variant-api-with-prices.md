# 03 — Admin variant API with inline prices

**What to build:** Admin can create a variant with prices, retrieve a variant and see its prices, update prices with diff-based reconciliation, and delete a variant with cascade cleanup of pricing records. All through the existing variant REST endpoints with `prices` added to payloads and responses.

**Create flow:** The variant create payload accepts an optional `prices` array (each with `amount` as string). The route handler strips prices, creates the variant, creates a PriceSet + Price(s) (injecting `currencyCode: 'usd'` server-side — currency is never accepted from the client), creates the `productVariantPriceSet` link, and returns the variant with prices attached. Compensation: clean up PriceSet if link creation fails.

**Update flow:** The variant update payload accepts an optional `prices` array. The route handler diffs incoming prices against existing: prices without an `id` are creates, prices with a matching `id` are updates, prices that exist in the DB but are absent from the payload are deletes. If the variant has no PriceSet yet, one is created with a link.

**Delete flow:** Variant deletion cascades to soft-delete the link, all prices in the price set, and the price set itself.

**Retrieve enrichment:** The single-variant detail endpoint enriches the response with a `prices` array. The variant list endpoint does NOT include prices.

HTTP schema changes:

In `packages/http-schemas/src/admin/product-variant/payloads.ts`:

```typescript
// Create payload — no id, no currencyCode (server injects currency)
const CreateVariantPrice = z.object({
  amount: stringToBigNumber,
})

// Add to AdminCreateProductVariant:
prices: z.array(CreateVariantPrice).optional()

// Update payload — optional id distinguishes creates from updates
const UpdateVariantPrice = z.object({
  id: z.string().optional(),  // present = update, absent = create
  amount: stringToBigNumber,
})

// Add to AdminUpdateProductVariant:
prices: z.array(UpdateVariantPrice).optional()
```

In `packages/http-schemas/src/admin/product-variant/entities.ts`:

```typescript
const AdminVariantPrice = z.object({
  id: z.string(),
  currencyCode: z.string(),
  amount: bigNumberToString,
  createdAt: dateToIso,
  updatedAt: dateToIso,
})

// Add to AdminProductVariant entity:
prices: z.array(AdminVariantPrice).optional()
```

Import `bigNumberToString`, `stringToBigNumber`, and `dateToIso` from `../../common.js`. Response type aliases must continue using `z.input` (not `z.infer`) so BigNumber and Date values pass through the transforms.

In route handlers, resolve services from `req.scope`:

```typescript
const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
const pricingService = req.scope.resolve<IPricingModuleService>(Modules.PRICING)
const linkService = req.scope.resolve<LinkService>(ContainerRegistrationKeys.LINK)
const linkRepository = linkService.repo('productVariantPriceSet')
```

**Blocked by:** 02 — Variant-to-price linking and price calculation

**Status:** ready-for-agent

- [ ] Create payload schema: `CreateVariantPrice` with `amount: stringToBigNumber`, added as optional `prices` array to `AdminCreateProductVariant`
- [ ] Update payload schema: `UpdateVariantPrice` with `id: z.string().optional()` and `amount: stringToBigNumber`, added as optional `prices` array to `AdminUpdateProductVariant`
- [ ] Response entity schema: `AdminVariantPrice` with `id`, `currencyCode`, `amount: bigNumberToString`, `createdAt: dateToIso`, `updatedAt: dateToIso` (no `deletedAt`), added as optional `prices` to `AdminProductVariant`
- [ ] Variant create route handler orchestrates: strip prices, create variant, create PriceSet+Prices (inject `currencyCode: 'usd'`), create link, return enriched variant
- [ ] Compensation on create failure: if PriceSet was created but link creation fails, soft-delete the PriceSet to prevent orphans
- [ ] Variant update route handler orchestrates: strip prices, update variant fields, resolve existing prices via link, diff (create new / update changed / delete missing), handle no-PriceSet-yet case
- [ ] Variant delete route handler cascades: query link, soft-delete link + prices + price set, then soft-delete variant
- [ ] Variant retrieve (detail only) enriches response: query link by variant ID, query prices by price set ID, attach `prices` array
- [ ] Variant list does NOT include price enrichment
- [ ] HTTP schema changes regenerated (Orval clients updated)
