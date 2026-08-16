# Pricing Module

## Problem Statement

Products and variants have no prices. A storefront cannot display product prices, and the admin cannot manage pricing for variants. Without a pricing module, there is no path to cart totals, checkout, or any commerce transaction.

## Solution

Add a standalone pricing module that provides a generic, consumer-agnostic pricing engine. Any entity (product variant, shipping option, future priceable entities) can link to a PriceSet and get pricing resolved without the pricing module knowing about the consumer. The store product detail API returns a resolved price per variant, and the admin can create and edit prices inline when managing variants.

## User Stories

1. As a storefront visitor, I want to see a price on each product variant, so that I know what I'd pay before adding to cart.
2. As a storefront visitor, I want prices displayed as formatted strings, so that there are no floating-point display bugs.
3. As an admin, I want to set a USD price when creating a product variant, so that it is immediately purchasable.
4. As an admin, I want to edit a variant's price from the variant detail page, so that I can adjust pricing without recreating the variant.
5. As an admin, I want to see the current price on the variant detail sidebar, so that I have pricing context when managing a variant.
6. As an admin, I want prices to be cleaned up when I delete a variant, so that there are no orphaned pricing records.
7. As a developer, I want a BigNumber type flowing through the backend, so that monetary arithmetic avoids IEEE 754 precision issues.
8. As a developer, I want monetary amounts serialized as strings on the wire, so that JSON parsing never corrupts price values.
9. As a developer, I want a custom Drizzle column type for numeric-to-BigNumber mapping, so that the conversion is automatic and consistent.
10. As a developer, I want Zod transforms for BigNumber (analogous to the existing dateToIso pattern), so that the API layer handles serialization declaratively.
11. As a developer, I want the pricing module to be consumer-agnostic (via PriceSet indirection), so that adding pricing to new entities (e.g., shipping options) requires only a new link table, not changes to the pricing module.
12. As a developer, I want `calculatePrices(priceSetIds, context)` as the single entry point for price resolution, so that all consumers use the same codepath.
13. As a developer, I want the currency code set server-side (not by the client), so that pricing context is controlled and cannot be spoofed.
14. As a developer, I want the pricing module to follow the established module pattern (models, repositories, service, Module() factory, database.config), so that the codebase stays consistent.
15. As a developer, I want the link table to follow the established link module pattern (ADR-0004), so that cross-module relationships remain discoverable and uniform.
16. As a developer, I want integration tests at the service boundary (matching the product module test pattern), so that pricing logic is verified against a real database.

## Implementation Decisions

### BigNumber infrastructure

- Use `bignumber.js` library for all monetary arithmetic in the backend. Install as a dependency of both the backend and http-schemas packages.
- Define a custom Drizzle column type (`bignum`) that maps Postgres `numeric` to/from `BigNumber`. Add alongside the existing `timestamps` helper in the column helpers file.
- Define two Zod transforms in the http-schemas common module:
  - `bigNumberToString`: backend passes `BigNumber`, Zod transforms to string for the wire. Used in entity/response schemas. Analogous to the existing `dateToIso` pipeline.
  - `stringToBigNumber`: client sends string, Zod transforms to `BigNumber` for the backend. Used in payload/input schemas.
- Entity type aliases use `z.input` (not `z.infer`) so backend code can pass `BigNumber` instances directly, matching the Date/dateToIso convention.
- All wire serialization goes through Zod transforms — never through raw `JSON.stringify` of BigNumber instances. Document the precision limitations (16+ significant digit values lose precision via `toJSON()`) in a code comment.

### Pricing module (2 tables)

- **PriceSet**: empty boundary entity with only an `id` and timestamps. Intentionally contains no domain fields — it exists to decouple the pricing module from its consumers. ID prefix: `pset_`.
- **Price**: contains `currencyCode` (text, not null), `amount` (bignum, not null), `priceSetId` (text, not null), and timestamps. ID prefix: `price_`. Indexed on `priceSetId` and `currencyCode` (partial indexes excluding soft-deleted rows). Drizzle relations: Price belongs to PriceSet, PriceSet has many Prices.
- Add `PRICING` to the Modules enum. Register via `Module()` factory and `bootstrapModule()` in the container.
- Database config: own migration table (`migrations_pricing`), own migrations directory, schema glob pointing to its models.
- Register all new tables and relations in the central schema file so Drizzle's typed client resolves them.

### Service interface

- `createPriceSets(data[], context?)` — creates PriceSet(s) with optional inline prices atomically within a transaction.
- `deletePriceSets(ids[], context?)` — soft-deletes PriceSet(s) and their prices.
- `addPrices(priceSetId, prices[], context?)` — adds prices to an existing PriceSet.
- `updatePrices(priceId, data, context?)` — updates a single price.
- `removePrices(priceIds[], context?)` — soft-deletes prices.
- `listPrices(filters?, config?, context?)` — lists prices with standard filter/pagination support.
- `calculatePrices(priceSetIds[], context)` — resolves the best price per PriceSet for the given context. Returns a `Map<priceSetId, CalculatedPriceSet>`. For MVP (no rules, no price lists), this is a simple query: find the price matching the PriceSet and currency code.

### CalculatedPriceSet shape

- Fields for MVP: `id` (price_set_id), `currencyCode`, `originalAmount` (BigNumber).
- No `calculatedAmount` for MVP — it would always equal `originalAmount` without PriceRule/PriceList. Adding it later as a new field is non-breaking.
- TODO comments for future fields: `calculatedAmount`, `originalAmountWithTax`, `originalAmountWithoutTax`, `isCalculatedPriceTaxInclusive`.

### PricingContext type

- Fields for MVP: `currencyCode` (string). Hardcoded to `'usd'` in middleware.
- TODO comments for future fields: `regionId`, `customerGroups` (for rule-based pricing).

### Link module: productVariantPriceSet

- Writable link table with `variantId`, `priceSetId`, timestamps. ID prefix: `pvps_`. Unique index on (variantId, priceSetId) excluding soft-deleted.
- Drizzle relations to both `productVariantTable` and `priceSetTable` (imported via the link modules re-export hub, not directly from the pricing module).
- Repository extends `BaseRepository` with one custom method: `findByVariantIds(variantIds[])`.
- Add to `Links` enum, register in `LinkService`, add to link module database config and definitions index.

### Currency handling

- The `currencyCode` column exists on the Price table (multi-currency ready at the schema level).
- The API layer hardcodes USD: the pricing context middleware sets `currencyCode: 'usd'`, and the variant create/update route handler injects `currencyCode: 'usd'` before passing to the service.
- Currency code is never accepted from the client in payloads. The create-price payload only contains `amount`. This prevents clients from setting arbitrary currencies and avoids case-sensitivity issues (no normalization needed because the server always provides a known lowercase value).

### Admin API changes

- **Variant create** (`POST /admin/products/:id/variants`): payload accepts optional `prices` array (each with `amount` as string). Route handler strips prices, creates variant, creates PriceSet+Price (injecting `currencyCode: 'usd'`), creates link. Compensation: clean up PriceSet if link creation fails.
- **Variant update** (`PATCH /admin/products/:id/variants/:variantId`): payload accepts optional `prices` array. Route handler diffs incoming prices against existing: creates new, updates changed, deletes missing. If the variant has no PriceSet yet, creates one with a link.
- **Variant delete** (`DELETE /admin/products/:id/variants/:variantId`): cascades to soft-delete the link, all prices in the price set, and the price set itself. Without this, orphaned records remain.
- **Variant retrieve** (`GET /admin/products/:id/variants/:variantId`): enriches the response with a `prices` array by querying the link and then the pricing module. This enrichment only applies to the single-variant detail endpoint, not the variant list.
- **Variant entity schema**: adds `prices` (array of `{ id, currencyCode, amount: string, createdAt, updatedAt }`) to the admin variant response.

### Store API changes

- **Pricing context middleware**: sets `req.pricingContext = { currencyCode: 'usd' }` on store product routes. The `HttpRequest` type must be extended with an optional `pricingContext` property.
- **Product detail** (`GET /store/products/:id`): enriches each variant with a `calculatedPrice` object (`{ id, currencyCode, originalAmount: string }` or `null`). Enrichment flow: collect variant IDs → query links → call `calculatePrices()` → attach to variants.
- **Product list** (`GET /store/products`): no pricing enrichment. The list endpoint does not return variants.
- **Store variant entity schema**: adds `calculatedPrice` (nullable object with `id`, `currencyCode`, `originalAmount` as string) to the store variant response.

### Admin UI changes (deferred — build DataGrid first)

- **Variant detail page** (new route `/products/$id/variants/$variantId`): two-column layout. Main column: general section (title, SKU, barcode, options). Sidebar: prices section showing "USD $XX.XX" with action menu to edit.
- **Price edit modal** (new child route `/products/$id/variants/$variantId/prices`): `RouteFocusModal` with DataGrid. For MVP: single "Price USD" column.
- **DataGrid component** (new shared component): spreadsheet-style editable grid. Reused in at least two places — the price edit modal and the create product form's variants step. Cell types: text, checkbox, currency (with symbol prefix). Keyboard navigation.
- **Variant table**: add `rowHref` to make variant rows link to the detail page, add `rowActions` with Edit/Delete.
- **Create product variants step**: add price columns to the DataGrid alongside SKU, inventory settings. Deferred until DataGrid is built.

## Testing Decisions

### Testing seam

The single testing seam is the `PricingModuleService` boundary. Tests construct the service with real repositories injected against a real Postgres database, matching the established pattern in the product module tests.

This is the highest useful seam: it tests the full internal stack (service → repository → DB) through the public service interface. The `BaseRepository` CRUD methods are already battle-tested by existing module tests. Link repository methods (`findByVariantIds`) are simple enough to be covered indirectly by the enrichment flow or tested standalone if needed.

### What to test

- **PriceSet lifecycle**: create with inline prices, delete cascades to prices.
- **Price CRUD**: add prices to a set, update amount, remove prices, list with filters.
- **calculatePrices**: single price set, multiple price sets, missing price set returns no entry in the map, correct currency matching.
- **BigNumber precision**: amounts round-trip through create → retrieve without precision loss.

### What makes a good test

Tests should verify external behavior through the service interface, not implementation details. Each test should set up state via service methods, perform an action, and assert the observable result. No mocking of repositories — all tests run against a real database.

### Prior art

The product module tests at `apps/backend/src/modules/product/__tests__/product-module-service.test.ts` are the direct template. They demonstrate: Vitest custom fixtures (`getDb`, `logger`, `dto.generate`), manual service construction with injected repos, and assertion patterns for CRUD + filters + soft-delete.

### Test fixtures

Add `generateCreatePriceSetDTO` and `generateCreatePriceDTO` to the test data builders to provide faker-based defaults for pricing data.

## Out of Scope

- **PriceRule, PriceList, PriceListRule, PricePreference** — context-based and sale/override pricing. Deferred until multi-region or customer groups are needed.
- **`calculatedAmount` field** — identical to `originalAmount` without rules/lists. Added as a new field when PriceRule/PriceList arrives (non-breaking).
- **Tax fields** (`originalAmountWithTax`, `originalAmountWithoutTax`, `isCalculatedPriceTaxInclusive`) — deferred to the Tax module. TODO(tax) comments at every integration point.
- **`shippingOptionPriceSet` link** — same PriceSet mechanism, but deferred until shipping option creation is implemented.
- **Cart pricing integration** — resolving `unitPrice` on line items, `getVariantPriceSetsStep` in cart workflow. Deferred until Tax module exists.
- **`calculatePrices()` SQL engine** — the full Medusa-style SQL query with rule matching, price list filtering, and specificity ordering. Deferred until PriceRule/PriceList.
- **Quantity tiers** (`minQuantity`, `maxQuantity` on Price) — deferred until PriceRule or standalone decision is made.
- **Middleware: dynamic pricing context** — resolving currency from region, customer groups from auth. Deferred until Region module.
- **Store product list pricing** — the list endpoint does not return variants, so no pricing enrichment.

## Further Notes

- The full technical spec with table schemas, code snippets, and file inventory is at `docs/PRICING-SPEC.md`.
- Medusa source files for reference during implementation are listed in section 12 of the technical spec.
- The DataGrid component is a prerequisite for all admin UI work in this spec. It should be designed and built as a separate piece of work before the variant detail page and price edit modal.
- ADR-0004 (Link Modules for Cross-Module Joins) governs the `productVariantPriceSet` link pattern.
- ADR-0001 (Per-Module Container Isolation) governs the pricing module's two-container bootstrap.
- ADR-0006 (Soft Delete by Default) governs the cascade deletion behavior.
