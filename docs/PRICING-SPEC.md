# Pricing Module Spec

## Design Decisions (from grilling session)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **PriceSet** | Keep | Boundary entity enabling consumer-agnostic pricing. Any module links to PriceSet; pricing module never changes. |
| **PriceRule** | Skip for MVP | No multi-region, no customer groups, no context-based pricing yet. Add when needed. |
| **PriceList** | Skip for MVP | No sale/override pricing. Add with PriceRule later. |
| **PricePreference** | Skip for MVP | No tax-inclusivity preferences. Add with Tax module. |
| **Storage** | `numeric` in Postgres, `BigNumber` (bignumber.js) in backend | Avoids IEEE 754 precision issues. Custom Drizzle column type handles conversion. |
| **Wire format** | Strings for all monetary amounts | Server owns arithmetic, client owns display. Avoids JSON number precision loss. |
| **Currency** | `currencyCode` column on Price, hardcoded to `"usd"` in API layer | Tables are multi-currency ready; API constraint is easy to lift later. |
| **Tax** | Deferred | `TODO(tax)` comments at integration points. |
| **Store response** | Single `calculatedPrice` object per variant | `originalAmount` only for MVP (no `calculatedAmount` until PriceRule/PriceList exists). |
| **Admin response** | Raw `prices` array on variant | Admin sees all prices; store sees resolved price. |
| **Price creation** | Inline with variant create/update | Workflow strips prices, creates PriceSet+Price, creates link. |
| **Shipping option prices** | Same PriceSet mechanism | Deferred — implement when shipping option creation is built. |

---

## Scope

### In scope (this spec)

1. BigNumber infrastructure (Drizzle column, http-schema transform)
2. Pricing module (PriceSet + Price models, repository, service)
3. `productVariantPriceSet` link module
4. Admin variant endpoints accept `prices` inline
5. Store product listing returns `calculatedPrice` per variant
6. Pricing context middleware (hardcoded USD)

### Out of scope (deferred)

- PriceRule, PriceList, PriceListRule, PricePreference (context-based pricing)
- `shippingOptionPriceSet` link (implement with shipping option creation)
- Tax calculation and `_withTax` / `_withoutTax` fields
- Cart pricing integration (`getVariantPriceSetsStep`, line item `unitPrice`)
- `calculatedAmount` field (identical to `originalAmount` without rules/lists)

---

## 1. BigNumber Infrastructure

### 1.1 Install dependency

```
npm install --workspace=backend bignumber.js
npm install --workspace=http-schemas bignumber.js
```

### 1.2 Custom Drizzle column type

**File:** `apps/backend/src/core/db/columns.ts`

```typescript
import BigNumber from 'bignumber.js'
import { customType } from 'drizzle-orm/pg-core'

export const bignum = customType<{
  data: BigNumber
  driverData: string
}>({
  dataType() {
    return 'numeric'
  },
  toDriver(value: BigNumber): string {
    return value.toFixed()
  },
  fromDriver(value: string): BigNumber {
    return new BigNumber(value)
  },
})
```

Add alongside the existing `timestamps` export.

### 1.3 HTTP schema transform

**File:** `packages/http-schemas/src/common.ts`

```typescript
import BigNumber from 'bignumber.js'
import { z } from 'zod'

// Analogous to dateToIso: backend passes BigNumber, output is string
export const bigNumberToString = z
  .custom<BigNumber>((val) => val != null && typeof val.toFixed === 'function')
  .transform((bn) => bn.toFixed())
  .pipe(z.string())
```

**Usage pattern** (in entity schemas):
```typescript
const Price = z.object({
  amount: bigNumberToString,
})

// z.input<typeof Price>  => { amount: BigNumber }  (backend passes BigNumber)
// z.output<typeof Price> => { amount: string }      (client receives "29.99")
```

**Input (payloads) — client sends string, backend receives BigNumber:**
```typescript
import BigNumber from 'bignumber.js'

export const stringToBigNumber = z
  .string()
  .refine((s) => !new BigNumber(s).isNaN(), 'Invalid numeric value')
  .transform((s) => new BigNumber(s))
```

**Usage in payloads:**
```typescript
const CreatePrice = z.object({
  amount: stringToBigNumber,
})

// z.input<typeof CreatePrice>  => { amount: string }    (client sends "29.99")
// z.output<typeof CreatePrice> => { amount: BigNumber }  (backend receives BigNumber)
```

### 1.4 BigNumber precision limitations (document in code)

```
bignumber.js toJSON() returns a string by default.
However, if a custom BigNumber wrapper overrides toJSON() to return a number,
values with 16+ significant digits lose precision via IEEE 754.

For typical commerce prices (< 15 significant digits), this is safe.
Edge cases:
  - Values >= 10^15 with decimal places lose precision as JS numbers
  - Values near epsilon (0.0001 default) may coerce to 0

Mitigation: all wire serialization goes through Zod transforms (bigNumberToString),
never through raw JSON.stringify of BigNumber instances.
```

---

## 2. Pricing Module

### 2.1 Models

**File:** `apps/backend/src/modules/pricing/models/price-set.ts`

```typescript
export const priceSetTable = pgTable('price_set', {
  id: text().primaryKey().default(sql`CONCAT('pset_', REPLACE(gen_random_uuid()::text, '-', ''))`),
  ...timestamps,
})
```

PriceSet is intentionally empty — it's a boundary entity, not a domain entity.

**File:** `apps/backend/src/modules/pricing/models/price.ts`

```typescript
export const priceTable = pgTable(
  'price',
  {
    id: text().primaryKey().default(sql`CONCAT('price_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    currencyCode: text().notNull(),  // hardcoded to 'usd' at API layer for now
    amount: bignum().notNull(),
    // TODO(pricing): add minQuantity, maxQuantity (bignum, nullable) for quantity tiers
    // TODO(pricing): add rulesCount (integer, default 0) when PriceRule is added
    // TODO(pricing): add priceListId (text, nullable FK) when PriceList is added
    priceSetId: text().notNull(),
    ...timestamps,
  },
  (table) => [
    index('idx_price_price_set_id').on(table.priceSetId).where(sql`deleted_at IS NULL`),
    index('idx_price_currency_code').on(table.currencyCode).where(sql`deleted_at IS NULL`),
  ],
)

export const priceRelations = relations(priceTable, ({ one }) => ({
  priceSet: one(priceSetTable, {
    fields: [priceTable.priceSetId],
    references: [priceSetTable.id],
  }),
}))

export const priceSetRelations = relations(priceSetTable, ({ many }) => ({
  prices: many(priceTable),
}))
```

### 2.2 Types

**File:** `apps/backend/src/core/types/pricing/common.ts`

```typescript
import type BigNumber from 'bignumber.js'

export type PriceSetDTO = {
  id: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type PriceDTO = {
  id: string
  currencyCode: string
  amount: BigNumber
  priceSetId: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type CalculatedPriceSetDTO = {
  id: string            // price_set_id
  currencyCode: string
  originalAmount: BigNumber
  // TODO(pricing): add calculatedAmount when PriceRule/PriceList is implemented
  // TODO(tax): add originalAmountWithTax, originalAmountWithoutTax
}

export interface FilterablePriceProps extends BaseFilterable<FilterablePriceProps> {
  id?: string | string[]
  priceSetId?: string | string[]
  currencyCode?: string | string[]
}
```

**File:** `apps/backend/src/core/types/pricing/mutations.ts`

```typescript
import type BigNumber from 'bignumber.js'

export type CreatePriceDTO = {
  currencyCode: string
  amount: BigNumber
}

export type CreatePriceSetDTO = {
  prices?: CreatePriceDTO[]
}

export type UpdatePriceDTO = {
  currencyCode?: string
  amount?: BigNumber
}
```

**File:** `apps/backend/src/core/types/pricing/service.ts`

```typescript
export type IPricingModuleService = {
  // PriceSet CRUD
  createPriceSets(data: CreatePriceSetDTO[], context?: Context): Promise<PriceSetDTO[]>
  deletePriceSets(ids: string[], context?: Context): Promise<void>

  // Price CRUD (scoped to a price set)
  addPrices(priceSetId: string, prices: CreatePriceDTO[], context?: Context): Promise<PriceDTO[]>
  updatePrices(priceId: string, data: UpdatePriceDTO, context?: Context): Promise<PriceDTO>
  removePrices(priceIds: string[], context?: Context): Promise<void>
  listPrices(filters?: FilterablePriceProps, config?: FindConfig<PriceDTO>, context?: Context): Promise<PriceDTO[]>

  // Price calculation
  calculatePrices(
    priceSetIds: string[],
    context: PricingContext,
  ): Promise<Map<string, CalculatedPriceSetDTO>>
}
```

### 2.3 Repository

**File:** `apps/backend/src/modules/pricing/repositories/price-set.ts`

Standard `BaseRepository(priceSetTable)`. No custom methods needed for MVP.

**File:** `apps/backend/src/modules/pricing/repositories/price.ts`

```typescript
export class PriceRepository extends BaseRepository(priceTable) {
  async findByPriceSetIds(priceSetIds: string[], currencyCode: string, context?: Context) {
    if (priceSetIds.length === 0) return []
    const client = this.getClient(context)
    return client
      .select()
      .from(this.table)
      .where(
        and(
          inArray(this.table.priceSetId, priceSetIds),
          eq(this.table.currencyCode, currencyCode),
          isNull(this.table.deletedAt),
        ),
      )
  }
}
```

### 2.4 Service

**File:** `apps/backend/src/modules/pricing/services/pricing-module-service.ts`

Key method — `calculatePrices()` for MVP:

```typescript
async calculatePrices(
  priceSetIds: string[],
  context: PricingContext,
): Promise<Map<string, CalculatedPriceSetDTO>> {
  const prices = await this.priceRepository.findByPriceSetIds(priceSetIds, context.currencyCode)
  const result = new Map<string, CalculatedPriceSetDTO>()

  for (const price of prices) {
    // TODO(pricing): when PriceRule exists, apply rule matching and specificity ordering
    // TODO(pricing): when PriceList exists, apply SALE vs OVERRIDE logic
    // For now: first matching price wins (one price per set per currency)
    if (!result.has(price.priceSetId)) {
      result.set(price.priceSetId, {
        id: price.priceSetId,
        currencyCode: price.currencyCode,
        originalAmount: price.amount,
      })
    }
  }

  return result
}
```

### 2.5 Module definition

**File:** `apps/backend/src/modules/pricing/index.ts`

```typescript
export default Module(Modules.PRICING, {
  service: PricingModuleService,
  repositories: {
    priceSetRepository: PriceSetRepository,
    priceRepository: PriceRepository,
  },
})
```

### 2.6 Database config

**File:** `apps/backend/src/modules/pricing/database.config.ts`

```typescript
export default defineConfig({
  schema: './src/modules/pricing/models/*.ts',
  out: './src/modules/pricing/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  migrations: { table: 'migrations_pricing' },
  dbCredentials: { url: env.DATABASE_URL },
})
```

---

## 3. Link Module: productVariantPriceSet

### 3.1 Table definition

**File:** `apps/backend/src/link-modules/definitions/product-variant-price-set.ts`

```typescript
export const productVariantPriceSetTable = pgTable(
  'product_variant_price_set',
  {
    id: text().primaryKey().default(sql`CONCAT('pvps_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    variantId: text().notNull(),
    priceSetId: text().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idx_pvps_variant_price_set')
      .on(table.variantId, table.priceSetId)
      .where(sql`deleted_at IS NULL`),
    index('idx_pvps_variant_id').on(table.variantId).where(sql`deleted_at IS NULL`),
    index('idx_pvps_price_set_id').on(table.priceSetId).where(sql`deleted_at IS NULL`),
  ],
)

export const productVariantPriceSetRelations = relations(productVariantPriceSetTable, ({ one }) => ({
  variant: one(productVariantTable, {
    fields: [productVariantPriceSetTable.variantId],
    references: [productVariantTable.id],
  }),
  priceSet: one(priceSetTable, {
    fields: [productVariantPriceSetTable.priceSetId],
    references: [priceSetTable.id],
  }),
}))
```

### 3.2 modules-definitions.ts

Add re-export:
```typescript
export { priceSetTable } from '../modules/pricing/models/price-set.js'
```

### 3.3 Repository

**File:** `apps/backend/src/link-modules/repositories/product-variant-price-set.ts`

```typescript
export class ProductVariantPriceSetRepository extends BaseRepository(productVariantPriceSetTable) {
  async findByVariantIds(variantIds: string[], context?: Context) {
    if (variantIds.length === 0) return []
    const client = this.getClient(context)
    return client
      .select()
      .from(this.table)
      .where(and(inArray(this.table.variantId, variantIds), isNull(this.table.deletedAt)))
  }
}
```

### 3.4 Registration

Add `PRODUCT_VARIANT_PRICE_SET: 'productVariantPriceSet'` to `Links` enum.

Register in `LinkService` and link module bootstrap.

---

## 4. Modules Enum

**File:** `apps/backend/src/core/utils/modules-definition.ts`

Add:
```typescript
export const Modules = {
  // ... existing
  PRICING: 'pricing',
} as const
```

---

## 5. Container Registration

**File:** `apps/backend/src/container.ts`

Add:
```typescript
import pricingModule from './modules/pricing/index.js'
// ...
await bootstrapModule(container, pricingModule)
```

---

## 6. Admin API Changes

### 6.1 Variant create accepts prices

**Payload change** (`packages/http-schemas/src/admin/product-variant/payloads.ts`):

```typescript
const CreateVariantPrice = z.object({
  // currencyCode is NOT exposed to clients — server always sets it from middleware/context
  amount: stringToBigNumber,
})

// Add to existing AdminCreateProductVariant:
prices: z.array(CreateVariantPrice).optional()
```

The route handler injects `currencyCode: 'usd'` before passing to the service. When multi-currency
is added, the admin UI will send currency codes, but the schema validation will enforce allowed values
server-side (not a free-form client input).

### 6.2 Variant response includes prices

**Entity change** (`packages/http-schemas/src/admin/product-variant/entities.ts`):

```typescript
const AdminVariantPrice = z.object({
  id: z.string(),
  currencyCode: z.string(),
  amount: bigNumberToString,
  createdAt: dateToIso,
  updatedAt: dateToIso,
})

// Add to existing AdminProductVariant entity:
prices: z.array(AdminVariantPrice).optional()
```

### 6.3 Variant create workflow

When `POST /admin/products/:id/variants` receives `prices`:

1. Strip `prices` from variant data
2. Create variant via product module (existing)
3. Create PriceSet + Price(s) via pricing module (inject `currencyCode: 'usd'` server-side)
4. Create `productVariantPriceSet` link
5. Return variant with prices attached

Compensation: if step 3 or 4 fails, delete the created PriceSet.

### 6.4 Variant update workflow for prices

When `PATCH /admin/products/:id/variants/:variantId` receives `prices`:

1. Strip `prices` from variant data
2. Update variant fields via product module (existing)
3. Resolve existing prices: query link → priceSetId → list prices
4. Diff incoming prices against existing:
   - New prices (no `id`): create via `addPrices(priceSetId, ...)`
   - Changed prices (matching `id`): update via `updatePrices(priceId, ...)`
   - Missing prices (existed but not in payload): delete via `removePrices([priceId])`
5. If variant has no PriceSet yet, create one + link (same as create flow)
6. Return variant with updated prices

### 6.5 Variant deletion cascade

When `DELETE /admin/products/:id/variants/:variantId`:

1. Query `productVariantPriceSet` link for the variant
2. If link exists: soft-delete the link, soft-delete all prices in the price set, soft-delete the price set
3. Soft-delete the variant via product module (existing)

Without this, orphaned PriceSets and Prices remain in the database.

### 6.6 Variant retrieve includes prices

When returning a single variant (admin `GET /admin/products/:id/variants/:variantId`):

1. Get variant from product service
2. Query `productVariantPriceSet` link by variant ID
3. Query prices by price set ID
4. Attach `prices` array to variant response

Price enrichment is only on the detail endpoint, not on the variant list.

---

## 7. Store API Changes

### 7.1 Pricing context middleware

**File:** `apps/backend/src/api/store/products/middlewares.ts`

```typescript
export function setPricingContext(): MiddlewareFunction {
  return (req) => {
    // TODO(pricing): resolve currency from region_id query param or cart
    // TODO(pricing): resolve customer groups for context-based pricing
    req.pricingContext = {
      currencyCode: 'usd',
    }
    return req
  }
}
```

Apply to store product routes via route definitions.

### 7.2 Store product response with calculatedPrice

**Entity change** (`packages/http-schemas/src/store/product/entities.ts`):

```typescript
const StoreCalculatedPrice = z.object({
  id: z.string(),                   // price_set_id
  currencyCode: z.string(),
  originalAmount: bigNumberToString,
  // TODO(pricing): add calculatedAmount when PriceRule/PriceList is implemented
  // TODO(tax): add originalAmountWithTax, originalAmountWithoutTax
})

// Add to existing StoreProductVariant entity:
calculatedPrice: StoreCalculatedPrice.nullable()
```

### 7.3 Store product detail enrichment

Price enrichment applies to the **product detail endpoint only** (`GET /store/products/:id`),
not the product list endpoint. The list endpoint does not return variants.

After fetching product + variants from the product service:

1. Collect all variant IDs from the product
2. Query `productVariantPriceSet` links → get `variantId → priceSetId` map
3. Call `pricingService.calculatePrices(priceSetIds, req.pricingContext)`
4. For each variant, attach `calculatedPrice` from the map (or `null` if no price set linked)
5. Return enriched product through Zod schema (transforms BigNumber → string)

---

## 8. PricingContext Type

**File:** `apps/backend/src/core/types/pricing/common.ts`

```typescript
export type PricingContext = {
  currencyCode: string
  // TODO(pricing): add regionId, customerGroups for rule matching
}
```

---

## 9. File Inventory

### New files

```
apps/backend/src/modules/pricing/
  models/price-set.ts
  models/price.ts
  repositories/price-set.ts
  repositories/price.ts
  services/pricing-module-service.ts
  __tests__/pricing.test.ts
  database.config.ts
  index.ts
  migrations/                        (generated)

apps/backend/src/core/types/pricing/
  common.ts
  mutations.ts
  service.ts
  index.ts

apps/backend/src/link-modules/
  definitions/product-variant-price-set.ts
  repositories/product-variant-price-set.ts
```

### Modified files

```
apps/backend/src/core/db/columns.ts                              (add bignum column)
apps/backend/src/core/utils/modules-definition.ts                (add PRICING to Modules)
apps/backend/src/container.ts                                     (bootstrap pricing module)
apps/backend/src/schema.ts                                        (register pricing + link tables and relations)
apps/backend/src/link-modules/modules-definitions.ts             (re-export priceSetTable)
apps/backend/src/link-modules/definitions/index.ts               (re-export productVariantPriceSetTable)
apps/backend/src/link-modules/database.config.ts                 (add new link table to schema array)
apps/backend/src/link-modules/services/link-service.ts           (add productVariantPriceSet)
apps/backend/src/server/ports.ts                                  (add pricingContext to HttpRequest type)

packages/http-schemas/package.json                                (add bignumber.js dependency)
packages/http-schemas/src/common.ts                               (add bigNumberToString, stringToBigNumber)
packages/http-schemas/src/admin/product-variant/entities.ts      (add prices to variant)
packages/http-schemas/src/admin/product-variant/payloads.ts      (add prices to create payload)
packages/http-schemas/src/store/product/entities.ts              (add calculatedPrice to variant)

apps/backend/src/api/admin/products/[id]/variants/route.ts       (orchestrate price creation)
apps/backend/src/api/admin/products/[id]/variants/[variantId]/route.ts  (enrich retrieve with prices, orchestrate price update)
apps/backend/src/api/store/products/[id]/route.ts                (enrich product detail with calculatedPrice)
```

---

## 10. Admin UI Changes

### 10.1 Variant Detail Page (new)

**Route:** `/products/$id/variants/$variantId`

Two-column layout (like Medusa's variant detail):

**Main column:**
- General section: variant title, SKU, barcode, options
- (Future: Media section, Inventory section)

**Sidebar:**
- Prices section: shows "USD $XX.XX" with "..." action menu → "Edit prices"

**Variant table changes** (`use-variant-table.tsx`):
- Add `rowHref: (row) => \`variants/${row.id}\`` to make rows clickable
- Add `rowActions` with Edit / Delete options

### 10.2 Price Edit Modal (new)

**Route:** `/products/$id/variants/$variantId/prices` (child route, opens modal)

Opens a `RouteFocusModal` with a DataGrid for editing prices.

For MVP (USD-only): single "Price USD" column. The DataGrid component is worth building
now because it's reused in at least two places:
1. Variant price edit modal (this route)
2. Create product form — Variants step (price columns alongside SKU, inventory settings)

**DataGrid scope (TODO — build separately first):**
- Spreadsheet-style editable grid component
- Cell types: text (editable), checkbox, currency (editable with currency symbol prefix)
- Column types generated from available currencies (USD-only for now)
- Keyboard navigation (arrow keys, tab, enter to edit)
- Pending: research Medusa's DataGrid implementation or evaluate a library

**Form behavior:**
- Pre-populate from existing variant prices
- On save: diff current vs initial → batch create/update/delete prices
- Calls pricing service via `PATCH /admin/products/:id/variants/:variantId` (with `prices` in payload)
- Unsaved changes guard via `RouteModalForm`

### 10.3 Create Product — Variants Step (enhancement)

The existing create product form's variant step should include price columns in the
DataGrid alongside SKU, managed inventory, allow backorder, etc.

Deferred to after the DataGrid component is built.

### 10.4 API Hooks (new)

**File:** `apps/admin/src/features/products/api/product-variant-prices.ts`

Hooks that wrap the variant update mutation for price-specific operations:
- `useUpdateVariantPrices(productId, variantId)` — calls variant update with `prices` payload
- Cache invalidation: variant detail, variant list, product detail

### 10.5 New admin files

```
apps/admin/src/routes/_authed/_shell/products/$id/variants/$variantId/
  route.tsx                    (variant detail page)
  prices/route.tsx             (price edit modal)

apps/admin/src/features/products/
  components/variant-prices-section.tsx    (sidebar prices display)
  hooks/use-variant-prices-form.ts         (price edit form logic)
```

### 10.6 Modified admin files

```
apps/admin/src/features/products/hooks/use-variant-table.tsx    (add rowHref, rowActions)
apps/admin/src/features/products/api/product-variants.ts        (add price-aware queries)
```

---

## 11. Deferred Items Tracker

| Item | Depends on | Where TODO lives |
|------|-----------|------------------|
| PriceRule model + matching | Multi-region / customer groups | `pricing/models/`, `pricing/services/` |
| PriceList + PriceListRule | Sale/override pricing | `pricing/models/`, `pricing/services/` |
| PricePreference | Tax module | `pricing/models/` |
| `calculatedAmount` field | PriceRule / PriceList | `CalculatedPriceSetDTO` type, store entity schema |
| Tax fields (`_withTax`, `_withoutTax`) | Tax module | `CalculatedPriceSetDTO` type, store entity schema |
| `shippingOptionPriceSet` link | Shipping option creation | `link-modules/definitions/` |
| Cart pricing integration | Cart + Tax | `workflows/`, cart line item `unitPrice` |
| Quantity tiers (`minQuantity`, `maxQuantity`) | PriceRule or standalone | `price` table, `calculatePrices()` |
| `calculatePrices()` SQL engine | PriceRule + PriceList | `pricing/repositories/` |
| Middleware: resolve region/customer context | Region module, Auth | `setPricingContext()` |
| DataGrid component | None (build first) | `apps/admin/src/components/data-grid/` |
| Variant detail page | DataGrid, pricing backend | `apps/admin/src/routes/.../variants/$variantId/` |
| Price edit modal | DataGrid, variant detail page | `apps/admin/src/routes/.../variants/$variantId/prices/` |
| Create product variants step with prices | DataGrid | Create product form variants tab |

---

## 12. Medusa Source Reference

Key files in `/Users/willo/learn/medusa/medusa-source/` for implementation reference:

| File | What it contains |
|------|-----------------|
| `packages/modules/pricing/src/models/price-set.ts` | PriceSet entity with cascade delete on prices |
| `packages/modules/pricing/src/models/price.ts` | Price entity: dual `amount`/`raw_amount`, `rules_count`, quantity tiers |
| `packages/modules/pricing/src/repositories/pricing.ts` | `calculatePrices` SQL engine (rule matching, price list filtering) |
| `packages/modules/pricing/src/services/pricing-module.ts` | Service: `calculatePrices()`, `normalizePrices()`, `createPriceSets_()` |
| `packages/core/types/src/pricing/common/price-set.ts` | Full type defs: `CalculatedPriceSetDTO`, mutation DTOs |
| `packages/core/types/src/pricing/common/pricing-context.ts` | `MedusaPricingContext` (region_id, currency_code, customer fields) |
| `packages/core/utils/src/totals/big-number.ts` | Medusa's BigNumber wrapper (dual numeric + raw JSONB storage) |
| `packages/admin/dashboard/src/routes/product-variants/product-variant-detail/` | Variant detail page UI |
| `packages/admin/dashboard/src/routes/products/product-prices/pricing-edit.tsx` | DataGrid-based price editing modal |
