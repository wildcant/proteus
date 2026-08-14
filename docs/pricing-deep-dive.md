# Pricing Feature Deep Dive

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Pricing Module Internals](#2-pricing-module-internals)
3. [Module Links](#3-module-links)
4. [API Layer](#4-api-layer)
5. [Workflows & Steps](#5-workflows--steps)
6. [Admin Dashboard UI](#6-admin-dashboard-ui)
7. [End-to-End Data Flows](#7-end-to-end-data-flows)

---

## 1. Architecture Overview

The pricing system spans five layers:

```
Admin Dashboard (React)
    |
API Routes (Express handlers + middleware)
    |
Workflows & Steps (core-flows)
    |
Pricing Module Service (IPricingModuleService)
    |
MikroORM Entities + Raw SQL Repository
```

**Core concepts:**

| Concept | Purpose |
|---------|---------|
| **PriceSet** | Empty container linked to a product variant or shipping option via a link module |
| **Price** | An actual monetary value in a specific currency, belonging to a PriceSet |
| **PriceRule** | Scopes a Price to a context (e.g. `region_id=US`, `customer.groups.id=vip`) |
| **PriceList** | Groups promotional/override prices with date windows and rules |
| **PriceListRule** | Scopes an entire PriceList to a context |
| **PricePreference** | Controls tax-inclusivity per region or currency |

There are **no direct foreign keys** to regions, currencies, or customer groups. The connection is entirely through the generic `attribute`/`value` rule system on `PriceRule` and `PriceListRule`.

---

## 2. Pricing Module Internals

### 2.1 Entity Models

All at `packages/modules/pricing/src/models/`.

#### PriceSet (`price-set.ts`)
- `id` (prefix `pset`)
- `prices` -> hasMany Price (cascade delete)
- No data fields of its own -- just an anchor entity

#### Price (`price.ts`)
- `id` (prefix `price`)
- `currency_code` (text, required)
- `amount` (bigNumber -- stored as numeric + raw JSONB for precision)
- `title` (nullable text)
- `min_quantity`, `max_quantity` (nullable bigNumber)
- `rules_count` (integer, default 0) -- denormalized count of PriceRule records
- Belongs to `PriceSet`, nullable belongs to `PriceList`
- Has many `PriceRule` (cascade delete)
- Indexes on `price_set_id`, `price_list_id`, `currency_code`

#### PriceRule (`price-rule.ts`)
- `id` (prefix `prule`)
- `attribute` (text) -- the rule key, e.g. `"region_id"`, `"customer.groups.id"`
- `value` (text) -- the target value
- `operator` (enum: `eq`, `gt`, `gte`, `lt`, `lte`; default `eq`)
- `priority` (integer, default 0)
- Belongs to `Price`
- **Unique index** on `(price_id, attribute, operator)`
- Additional indexes on `(attribute)`, `(attribute, value)`, `(operator, value)`, `(attribute, value, price_id)`

#### PriceList (`price-list.ts`)
- `id` (prefix `plist`)
- `title`, `description` (searchable text)
- `status` (enum: `active` | `draft`, default `draft`)
- `type` (enum: `sale` | `override`, default `sale`)
- `starts_at`, `ends_at` (nullable datetime)
- `rules_count` (nullable integer, default 0)
- `metadata` (nullable JSON)
- Has many `Price` and `PriceListRule` (cascade delete both)
- Partial index on `(id, status, starts_at, ends_at)` where `status = 'active'`

#### PriceListRule (`price-list-rule.ts`)
- `id` (prefix `prule`)
- `attribute` (text) -- e.g. `"customer.groups.id"`
- `value` (nullable JSON) -- a JSONB array of accepted values, e.g. `["grp_1", "grp_2"]`
- Belongs to `PriceList`
- GIN index on `value` for `@>` containment queries

#### PricePreference (`price-preference.ts`)
- `id` (prefix `prpref`)
- `attribute` (text) -- `"region_id"` or `"currency_code"` in practice
- `value` (nullable text)
- `is_tax_inclusive` (boolean, default false)
- Unique index on `(attribute, value)`

### 2.2 Joiner Config (`joiner-config.ts`)

Exposes `PriceSet`, `PriceList`, `Price`, and `PricePreference` as linkable entities for cross-module queries. `PriceRule` and `PriceListRule` are internal-only.

### 2.3 Repository -- The Price Calculation Engine

`packages/modules/pricing/src/repositories/pricing.ts`

`PricingRepository.calculatePrices()` is the most complex piece in the module. It executes a single Knex SQL query:

**Inputs:**
- `pricingFilters.id` -- array of price_set_ids
- `pricingContext.context` -- key-value map with required `currency_code`, optional `quantity`, `region_id`, and arbitrary rule attributes

**Query construction:**

1. **Extract special keys**: `quantity` and `currency_code` pulled from context
2. **Flatten context**: `flattenObjectToKeyValuePairs(context)` converts nested objects to dot-notation (e.g. `customer.groups.id`)
3. **Attribute cache optimization**: If >10 context attributes, queries DB for all distinct `attribute` values used in `price_rule` and `price_list_rule`, strips any context keys not present in DB
4. **Base query**:
   ```sql
   SELECT price.*, pl.type, pl.rules_count
   FROM price
   WHERE price_set_id IN (...) AND currency_code = ? AND deleted_at IS NULL
   -- plus quantity range filtering
   ```
5. **Complex context path** (when rule attributes exist):
   - Derived table pre-filters active price lists whose `rules_count` matches exactly how many `price_list_rule` records satisfy context via JSONB `@>` containment
   - LATERAL join counts matching `price_rule` rows per price using attribute/operator/value combinations
   - Filter: either (no price list AND rules match) or (has matching price list AND rules match)
6. **Simple path** (no rule attributes): LEFT JOIN on active price lists, restrict to `rules_count = 0`
7. **Ordering**:
   ```sql
   ORDER BY price_list_id IS NOT NULL DESC,        -- price list prices first
            rules_count + COALESCE(pl.rules_count, 0) DESC,  -- higher specificity wins
            amount ASC                              -- lowest amount breaks ties
   ```

### 2.4 Main Service

`packages/modules/pricing/src/services/pricing-module.ts`

Extends `MedusaService` with typed DTOs for all six entities, auto-generating standard CRUD methods. Key custom methods:

#### `calculatePrices()` (lines 390-568)
1. Calls `pricingRepository_.calculatePrices()` for candidate prices
2. Groups by `price_set_id`
3. For each group:
   - Separates price-list prices from default prices
   - **OVERRIDE** type: `calculatedPrice = priceListPrice`, `originalPrice = priceListPrice`
   - **SALE** type: `calculatedPrice` = whichever of priceListPrice vs defaultPrice is lower
4. Fetches `PriceRule` and `PricePreference` records for the selected prices
5. Resolves tax-inclusivity via `isTaxInclusive()`:
   - Checks `region_id` preference first, then `currency_code` preference
6. Returns `CalculatedPriceSet` objects with `calculated_amount`, `original_amount`, tax-inclusivity flags

#### `normalizePrices()` (lines 911-993)
Converts external `rules` dict format (`{ region_id: "reg_1" }`) into internal `price_rules` array format. Validates operators, normalizes currency codes, deduplicates via `hashPrice()`.

#### Write methods
All write methods (`createPriceSets`, `updatePriceSets`, `addPrices`, `createPriceLists`, etc.) call `pricingRepository_.clearAvailableAttributes()` in a `finally` block to invalidate the attribute cache.

#### `normalizePriceSetConfig()`
Adds `populateWhere: { prices: { price_list_id: null } }` to exclude price-list-owned prices when listing price sets directly.

---

## 3. Module Links

`packages/modules/link-modules/src/definitions/`

There are exactly **two** link modules involving pricing:

### 3.1 ProductVariantPriceSet (`product-variant-price-set.ts`)

- **Table**: `product_variant_price_set` (prefix `pvps`)
- **Sides**: `Modules.PRODUCT` / `ProductVariant` (FK `variant_id`) <-> `Modules.PRICING` / `PriceSet` (FK `price_set_id`)
- **Cascade**: `deleteCascade: true` on the pricing side -- deleting a variant cascades to delete the price set

**Extends on ProductVariant:**
- `price_set` -- resolves via `price_set_link.price_set`
- `prices` -- resolves via `price_set_link.price_set.prices`
- `calculated_price` -- resolves via `price_set_link.price_set.calculated_price` (forwards query context arguments)

**Extends on PriceSet:**
- `variant` -- resolves via `variant_link.variant`

### 3.2 ShippingOptionPriceSet (`shipping-option-price-set.ts`)

- **Table**: `shipping_option_price_set` (prefix `sops`)
- **Sides**: `Modules.FULFILLMENT` / `ShippingOption` (FK `shipping_option_id`) <-> `Modules.PRICING` / `PriceSet` (FK `price_set_id`)
- **Cascade**: `deleteCascade: true` on the pricing side

**Extends on ShippingOption:**
- `prices` -- resolves via `price_set_link.price_set.prices`
- `calculated_price` -- resolves via `price_set_link.price_set.calculated_price`

### 3.3 No Region/Currency/Customer Links

There are zero module links between Pricing and Region, Currency, or Customer. Context-based matching is handled entirely via the generic `PriceRule.attribute`/`value` system at query time.

---

## 4. API Layer

### 4.1 Admin Price List Endpoints

All routes at `packages/medusa/src/api/admin/price-lists/`.

| Method | Path | Workflow | Description |
|--------|------|----------|-------------|
| GET | `/admin/price-lists` | remoteQuery | List price lists with filters (q, status, dates, rules_count) |
| POST | `/admin/price-lists` | `createPriceListsWorkflow` | Create a price list with prices and rules |
| GET | `/admin/price-lists/:id` | remoteQuery | Retrieve single price list |
| POST | `/admin/price-lists/:id` | `updatePriceListsWorkflow` | Update price list metadata/rules |
| DELETE | `/admin/price-lists/:id` | `deletePriceListsWorkflow` | Delete a price list |
| GET | `/admin/price-lists/:id/prices` | `query.graph` | List prices in a price list |
| POST | `/admin/price-lists/:id/prices/batch` | `batchPriceListPricesWorkflow` | Batch create/update/delete prices |
| POST | `/admin/price-lists/:id/products` | `batchPriceListPricesWorkflow` | Remove products from a price list (removes their prices) |

**Key validators:**
- `AdminCreatePriceListPrice`: `currency_code`, `amount`, `variant_id` (required), optional `min_quantity`, `max_quantity`, `rules`
- `AdminCreatePriceList`: `title`, `description`, optional `starts_at`, `ends_at`, `status`, `type`, `rules: Record<string, string[]>`, `prices[]`, `metadata`

**Response transformation:** `transformPriceList()` in `helpers.ts` converts internal `price_list_rules` array to external `rules` dict, and normalizes prices via `buildPriceSetPricesForCore()`.

**RBAC policies:**
- `price_list:read` on all GET
- `price_list:create`, `price_list:update`, `price_list:delete` on respective mutations
- `price:ALL` on batch prices endpoint

### 4.2 Admin Price Preference Endpoints

Routes at `packages/medusa/src/api/admin/price-preferences/`.

| Method | Path | Workflow | Description |
|--------|------|----------|-------------|
| GET | `/admin/price-preferences` | refetchEntities | List price preferences (limit: 300) |
| POST | `/admin/price-preferences` | `createPricePreferencesWorkflow` | Create a price preference |
| GET | `/admin/price-preferences/:id` | refetchEntity | Retrieve single price preference |
| POST | `/admin/price-preferences/:id` | `updatePricePreferencesWorkflow` | Update a price preference |
| DELETE | `/admin/price-preferences/:id` | `deletePricePreferencesWorkflow` | Delete a price preference |

### 4.3 Admin Products -- Pricing Integration

`packages/medusa/src/api/admin/products/`

- `GET /admin/products` supports `price_list_id` filter -- the `maybeApplyPriceListsFilter` middleware rewrites it to a variant-ID filter by querying prices in the specified price lists
- `POST /admin/products` and `POST /admin/products/:id` accept `variants[].prices[]` with `currency_code`, `amount`, optional `min_quantity`, `max_quantity`, `rules`

### 4.4 Store Pricing Pipeline

Storefront pricing flows entirely through a **3-stage middleware pipeline** applied before route handlers:

#### Stage 1: `normalizeDataForContext()` (`utils/middlewares/products/normalize-data-for-context.ts`)
- Expands `variants.calculated_price` field to `variants.calculated_price.*`
- Resolves `region_id` from: query param -> cart's region -> store's default region
- Throws `INVALID_DATA` if no region found

#### Stage 2: `setPricingContext()` (`utils/middlewares/products/set-pricing-context.ts`)
- Fetches region to get `currency_code`
- Builds `MedusaPricingContext: { region_id, currency_code }`
- If authenticated customer: fetches customer groups and adds `{ customer: { groups: [{id}, ...] } }`
- Sets `req.pricingContext`

#### Stage 3: `setTaxContext()` (`utils/middlewares/products/set-tax-context.ts`)
- Checks region's `automatic_taxes` flag
- If true: builds `TaxCalculationContext: { address: { country_code, province_code } }`
- Sets `req.taxContext`

#### Store Products (`store/products/`)

- `GET /store/products` and `GET /store/products/:id`
- Context params: `region_id`, `country_code`, `province`, `cart_id`
- Route handler passes `context["variants"]["calculated_price"] = QueryContext(req.pricingContext)` to `query.graph`
- After fetch: `wrapProductsWithTaxPrices()` calls `taxService.getTaxLines()` and decorates each `variant.calculated_price` with `calculated_amount_with_tax`, `calculated_amount_without_tax`, `original_amount_with_tax`, `original_amount_without_tax`

#### Store Product Variants (`store/product-variants/`)

- `GET /store/product-variants` and `GET /store/product-variants/:id`
- Same middleware pipeline but with `priceFieldPaths: ["calculated_price"]` (no `variants.` prefix since we're already at the variant level)
- Route handler passes `context["calculated_price"] = QueryContext(req.pricingContext)`
- Tax wrapping via `wrapVariantsWithTaxPrices()`

---

## 5. Workflows & Steps

All at `packages/core/core-flows/src/`.

### 5.1 Pricing Steps (`pricing/steps/`)

| Step | Input | Action | Compensation |
|------|-------|--------|-------------|
| `createPriceSetsStep` | `CreatePriceSetDTO[]` | `pricingModule.createPriceSets()` | `deletePriceSets()` |
| `updatePriceSetsStep` | `{ selector, update }` or `{ price_sets }` | `upsertPriceSets()` or `updatePriceSets()` | `upsertPriceSets(snapshot)` |
| `createPricePreferencesStep` | preferences array | `createPricePreferences()` | `deletePricePreferences()` |
| `updatePricePreferencesStep` | `{ selector, update }` | `listPricePreferences()` then `updatePricePreferences()` | `upsertPricePreferences(snapshot)` |
| `updatePricePreferencesAsArrayStep` | array of `{ attribute, value, is_tax_inclusive }` | Upsert pattern with lookup by attribute+value | Restore + delete new |
| `deletePricePreferencesStep` | `string[]` | `softDeletePricePreferences()` | `restorePricePreferences()` |

### 5.2 Price List Steps (`price-list/steps/`)

| Step | Input | Action | Compensation |
|------|-------|--------|-------------|
| `validatePriceListsStep` | `{ id }[]` | List by IDs, throw NOT_FOUND for missing | None (read-only) |
| `validateVariantPriceLinksStep` | `{ prices: { variant_id }[] }[]` | Query `product_variant_price_set` link, throw if missing | None (read-only) |
| `createPriceListsStep` | `{ data, variant_price_map }` | Maps `variant_id` -> `price_set_id`, then `createPriceLists()` | `deletePriceLists()` |
| `updatePriceListsStep` | `UpdatePriceListWorkflowInputDTO[]` | `updatePriceLists()` | Restore from snapshot |
| `createPriceListPricesStep` | `{ data, variant_price_map }` | Maps `variant_id` -> `price_set_id`, then `addPriceListPrices()` | `removePrices()` |
| `updatePriceListPricesStep` | `{ data, variant_price_map }` | Maps `variant_id` -> `price_set_id`, then `updatePriceListPrices()` | Restore from snapshot |
| `removePriceListPricesStep` | `string[]` | `softDeletePrices()` | `restorePrices()` |
| `deletePriceListsStep` | `string[]` | `softDeletePriceLists()` | `restorePriceLists()` |

### 5.3 Price List Workflows (`price-list/workflows/`)

**`createPriceListsWorkflow`**: validateVariantPriceLinks -> createPriceLists

**`updatePriceListsWorkflow`**: validatePriceLists -> updatePriceLists

**`deletePriceListsWorkflow`**: deletePriceLists -> removeRemoteLinkStep

**`batchPriceListPricesWorkflow`**: Runs three sub-workflows **in parallel** via `parallelize`:
- `createPriceListPricesWorkflow` (validate + validate links + create)
- `updatePriceListPricesWorkflow` (validate + validate links + update)
- `removePriceListPricesWorkflow` (remove prices)

### 5.4 Product Pricing Steps & Workflows (`product/`)

**`createVariantPricingLinkStep`**: Creates `{ PRODUCT.variant_id, PRICING.price_set_id }` remote links. Compensates by dismissing the links.

**`getVariantPricingLinkStep`**: Reads existing variant -> price set links. Throws NOT_FOUND if any are missing.

**`upsertVariantPricesWorkflow`** (called by `updateProductsWorkflow`):
1. Compute removed variant IDs -> `removeRemoteLinkStep`
2. Split remaining into existing vs new variants
3. Existing: fetch their price set links -> `updatePriceSetsStep`
4. New: `createPriceSetsStep` -> `createVariantPricingLinkStep`

**`createProductVariantsWorkflow`** pricing subsequence:
1. Strip prices from variant data before creating variants
2. `createPriceSetsStep` with the stripped prices
3. `createVariantPricingLinkStep` pairing variants to price sets **by index alignment**

### 5.5 Cart Pricing (`cart/`)

**`getVariantPriceSetsStep`**: The main cart pricing step.
- Groups items by identical pricing context (sorted/serialized) to minimize `calculatePrices()` calls
- For each context group: `pricingModule.calculatePrices({ id: priceSetIds }, { context })`
- Returns `Record<string, CalculatedPriceSet>`

**`getLineItemPricingQuantitiesStep`**: Resolves the quantity each item should be priced at, accounting for line-item merging (if item being added already exists in cart, uses accumulated quantity for tiered pricing).

**`getVariantsAndItemsWithPrices`** sub-workflow (used by addToCart, refreshCartItems, createOrder, addOrderLineItems):
1. Build per-item pricing context from cart fields (`currency_code`, `region_id`, `customer.groups.id`, shipping address, etc.)
2. `getVariantPriceSetsStep` with bulk per-item contexts
3. `prepareVariantsAndItemsWithPricesStep` attaches `calculated_price` to variants and sets `unit_price`, `compare_at_unit_price` (for sale detection) on line items

**`addToCartWorkflow`** pricing flow:
1. Fire `setPricingContext` hook (allows customization)
2. `getLineItemPricingQuantitiesStep` to resolve merged quantities
3. `getVariantsAndItemsWithPrices` with pricing quantities
4. Restore original quantities on line items
5. `validateLineItemPricesStep`

**Context fields used** (`cartFieldsForPricingContext`): `currency_code`, `region_id`, `sales_channel_id`, `customer.id`, `customer.groups.id`, `email`, `locale`, shipping address fields, `item_total`, `total`.

---

## 6. Admin Dashboard UI

All at `packages/admin/dashboard/src/`.

### 6.1 Price List Pages

#### List Page (`routes/price-lists/price-list-list/`)
- `PriceListListTable` with columns: title, status (StatusCell), price_overrides (PriceCountCell), actions
- `PriceCountCell` makes a separate `usePriceListPrices(id, { limit: 1 })` call per row to show count
- Filters, sorting, pagination (page size 20)

#### Detail Page (`routes/price-lists/price-list-detail/`)
- Two-column layout via `LayoutComposer`
- **Main**: `PriceListGeneralSection` (title, status badge, type, description, override count) + `PriceListProductSection` (product table with edit/remove actions)
- **Side**: `PriceListConfigurationSection` (date range display, customer group display)
- Route preloader prefetches price list data

#### Create Page (`routes/price-lists/price-list-create/`)
- `RouteFocusModal` with 3-tab `ProgressTabs` wizard: **Detail -> Product -> Price**
- Single `react-hook-form` instance with `PricingCreateSchema`
- Tab 1: type (sale/override), title, status, description, dates, customer groups (via StackedFocusModal)
- Tab 2: product selection
- Tab 3: `DataGrid` with price columns per currency and region, plus quantity price modal for tiered pricing
- Submit: `exctractPricesFromProducts()` flattens form -> `useCreatePriceList().mutateAsync()`

#### Edit Drawers
- **General info** (`price-list-edit/`): `RouteDrawer` for status, type, title, description
- **Configuration** (`price-list-configuration/`): `RouteDrawer` for dates and customer groups

#### Prices Edit (`price-list-prices-edit/`)
- DataGrid pre-populated from existing prices via `initRecord(priceList, products)`
- Submit: `sortPrices()` diffs current vs initial -> `useBatchPriceListPrices().mutateAsync({ create, update, delete })`

#### Prices Add (`price-list-prices-add/`)
- 2-tab wizard: Product -> Price
- Only creates new prices (no update/delete)

### 6.2 Product Variant Pricing

#### Variant Price Edit (`routes/products/product-prices/`)
- `PricingEdit` component with `VariantPricingForm` (shared DataGrid)
- Default values built from `variant.prices` -- region prices keyed by `region_id`, currency prices by `currency_code`
- Submit: `useUpdateProductVariantsBatch(product.id).mutateAsync()`

#### Variant Detail Price Display (`routes/product-variants/product-variant-detail/`)
- `VariantPricesSection`: read-only, shows prices 3 at a time with "Show more"
- Filters out rule-based prices, sorts by currency_code

#### Create Variant Pricing Tab (`routes/products/product-create-variant/`)
- Pricing tab in create-variant modal
- Same `createDataGridPriceColumns` infrastructure

### 6.3 Shared Infrastructure

#### DataGrid Price Columns (`components/data-grid/helpers/create-data-grid-price-columns.tsx`)
- Factory generating one column per currency code + one per region
- Currency column IDs: `currency_prices.${currency}`, region: `region_prices.${regionId}`
- Each header includes `IncludesTaxTooltip` driven by price preferences
- In price lists: renders `DataGridQuantityPriceCell` (adds tiered price trigger)

#### Quantity Price Modal System (`routes/price-lists/common/components/`)
- `QuantityPriceProvider`: React Context with open/close callbacks
- `QuantityPriceModal`: StackedFocusModal parsing field paths to extract product/variant/currency/region
- `QuantityPriceForm`: Tiered price form with `min_quantity`/`max_quantity` per tier

### 6.4 API Hooks

**`hooks/api/price-lists.tsx`:**

| Hook | Purpose | Invalidates |
|------|---------|-------------|
| `usePriceList(id)` | Retrieve | -- |
| `usePriceLists(query)` | List | -- |
| `useCreatePriceList()` | Create | lists, customerGroups |
| `useUpdatePriceList(id)` | Update | lists, detail, customerGroups |
| `useDeletePriceList(id)` | Delete | lists |
| `usePriceListPrices(id)` | List prices | -- |
| `useBatchPriceListPrices(id)` | Batch create/update/delete | detail, products, prices |
| `usePriceListLinkProducts(id)` | Remove products | detail, lists, products |

**`hooks/api/price-preferences.tsx`:**

| Hook | Purpose |
|------|---------|
| `usePricePreferences(query)` | List |
| `useUpsertPricePreference(id?)` | Create or update (based on id presence) |
| `useDeletePricePreference(id)` | Delete |

---

## 7. End-to-End Data Flows

### 7.1 Creating a Product with Prices

```
Admin UI: Product Create Form (prices per variant)
    |
POST /admin/products
    |
createProductsWorkflow
    |-> createProductVariantsWorkflow
        |-> createProductVariantsStep (product module, prices stripped)
        |-> createPriceSetsStep (pricing module, creates PriceSet + Price + PriceRule)
        |-> createVariantPricingLinkStep (link module, creates product_variant_price_set)
```

Prices are **always stripped** from the product module call. The product module never sees prices -- they're handled as a separate concern via the pricing module and linked afterwards.

### 7.2 Storefront Price Resolution

```
GET /store/products?region_id=reg_US

Middleware Pipeline:
    1. normalizeDataForContext() -- resolves region, adds calculated_price.* to fields
    2. setPricingContext() -- builds { region_id, currency_code, customer.groups.id }
    3. setTaxContext() -- builds { country_code, province_code }

Route Handler:
    query.graph({
        entity: "product",
        context: { variants: { calculated_price: QueryContext(pricingContext) } }
    })

Under the hood (via link extends):
    variant.calculated_price -> price_set_link.price_set.calculated_price
        -> PricingModule.calculatePrices({ id: [priceSetId] }, { context: pricingContext })
            -> PricingRepository SQL query
            -> Service-level SALE vs OVERRIDE logic
            -> Tax-inclusivity resolution via PricePreference

Post-fetch:
    wrapProductsWithTaxPrices() -> taxService.getTaxLines()
        -> Decorates with calculated_amount_with_tax, calculated_amount_without_tax, etc.
```

### 7.3 Cart Add-to-Cart Pricing

```
POST /store/carts/:id/line-items { variant_id, quantity }
    |
addToCartWorkflow
    |-> setPricingContext hook (customizable)
    |-> getLineItemPricingQuantitiesStep (resolves merged quantity for tiered pricing)
    |-> getVariantsAndItemsWithPrices sub-workflow:
        |   -> Build per-item context from cart fields
        |   -> getVariantPriceSetsStep:
        |       -> Group items by identical context
        |       -> For each group: pricingModule.calculatePrices()
        |   -> prepareVariantsAndItemsWithPricesStep:
        |       -> Attach calculated_price to variants
        |       -> Set unit_price and compare_at_unit_price on line items
    |-> validateLineItemPricesStep
    |-> Create/update line items
    |-> refreshCartItemsWorkflow (recalculate totals, promotions, tax, payment)
```

### 7.4 Price List Price Resolution Order

When `calculatePrices()` is called, the SQL query returns candidates ordered by:

1. **Price list prices first** (`price_list_id IS NOT NULL DESC`)
2. **Higher specificity wins** (`rules_count + pl.rules_count DESC`)
3. **Lowest amount breaks ties** (`amount ASC`)

The service then applies business logic:
- **OVERRIDE** list: calculated = original = price list price
- **SALE** list: calculated = min(price list price, default price); original = default price

### 7.5 Price List Create Flow

```
Admin UI: 3-tab wizard (Detail -> Products -> Prices)
    |
POST /admin/price-lists
    { title, description, type, status, starts_at, ends_at,
      rules: { "customer.groups.id": ["grp_1"] },
      prices: [{ variant_id, currency_code, amount, rules }] }
    |
createPriceListsWorkflow
    |-> validateVariantPriceLinksStep
    |       Query product_variant_price_set links
    |       Returns { variant_id: price_set_id } map
    |       Throws if any variant has no linked price set
    |-> createPriceListsStep
            Replace variant_id with price_set_id in each price
            Convert rules dict to price_list_rules array
            pricingModule.createPriceLists()
```

---

## Key File Reference

### Module
- `packages/modules/pricing/src/services/pricing-module.ts` -- main service
- `packages/modules/pricing/src/repositories/pricing.ts` -- SQL price calculation
- `packages/modules/pricing/src/models/` -- all 6 entity models
- `packages/modules/pricing/src/joiner-config.ts` -- linkable entity config

### Links
- `packages/modules/link-modules/src/definitions/product-variant-price-set.ts`
- `packages/modules/link-modules/src/definitions/shipping-option-price-set.ts`

### API Routes
- `packages/medusa/src/api/admin/price-lists/` -- admin price list CRUD
- `packages/medusa/src/api/admin/price-preferences/` -- admin price preferences
- `packages/medusa/src/api/store/products/` -- storefront product pricing
- `packages/medusa/src/api/store/product-variants/` -- storefront variant pricing
- `packages/medusa/src/api/utils/middlewares/products/` -- pricing middleware pipeline

### Workflows
- `packages/core/core-flows/src/pricing/` -- price set and preference workflows
- `packages/core/core-flows/src/price-list/` -- price list workflows
- `packages/core/core-flows/src/product/steps/create-variant-pricing-link.ts`
- `packages/core/core-flows/src/product/workflows/upsert-variant-prices.ts`
- `packages/core/core-flows/src/cart/steps/get-variant-price-sets.ts`
- `packages/core/core-flows/src/cart/workflows/get-variants-and-items-with-prices.ts`

### Admin UI
- `packages/admin/dashboard/src/routes/price-lists/` -- all price list pages
- `packages/admin/dashboard/src/routes/products/product-prices/` -- variant price editing
- `packages/admin/dashboard/src/routes/products/common/variant-pricing-form.tsx`
- `packages/admin/dashboard/src/components/data-grid/helpers/create-data-grid-price-columns.tsx`
- `packages/admin/dashboard/src/hooks/api/price-lists.tsx`
- `packages/admin/dashboard/src/hooks/api/price-preferences.tsx`

### Types
- `packages/core/types/src/pricing/service.ts` -- IPricingModuleService interface
- `packages/core/types/src/pricing/common/` -- DTOs (PriceSetDTO, CalculatedPriceSet, etc.)
- `packages/core/types/src/http/price-list/admin/` -- admin HTTP types
- `packages/core/types/src/http/price-preference/` -- price preference HTTP types
