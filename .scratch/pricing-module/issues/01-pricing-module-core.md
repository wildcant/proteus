# 01 — Pricing module core

**What to build:** A working pricing module where you can create price sets with prices and retrieve them. This includes the BigNumber infrastructure that all monetary values in the system will use going forward.

The pricing module follows the established module pattern: Drizzle models, repositories extending BaseRepository, a service implementing a typed interface, Module() factory registration, and a database.config for isolated migrations.

BigNumber flows through the full stack: `numeric` in Postgres, `BigNumber` (bignumber.js) in the backend via a custom Drizzle column type (`bignum`), and strings on the wire via Zod transforms (`bigNumberToString` / `stringToBigNumber`) in http-schemas — analogous to the existing `dateToIso` pattern.

The `bignum` column helper uses `customType` from `drizzle-orm/pg-core`:

```typescript
import BigNumber from 'bignumber.js'
import { customType } from 'drizzle-orm/pg-core'

export const bignum = customType<{ data: BigNumber; driverData: string }>({
  dataType() { return 'numeric' },
  toDriver(value: BigNumber): string { return value.toFixed() },
  fromDriver(value: string): BigNumber { return new BigNumber(value) },
})
```

The Zod transforms in `packages/http-schemas/src/common.ts`:

```typescript
import BigNumber from 'bignumber.js'
import { z } from 'zod'

// Analogous to dateToIso: backend passes BigNumber, output is string
export const bigNumberToString = z
  .custom<BigNumber>((val) => val != null && typeof val.toFixed === 'function')
  .transform((bn) => bn.toFixed())
  .pipe(z.string())

// Client sends string, backend receives BigNumber
export const stringToBigNumber = z
  .string()
  .refine((s) => !new BigNumber(s).isNaN(), 'Invalid numeric value')
  .transform((s) => new BigNumber(s))
```

Entity type aliases must use `z.input` (not `z.infer`) so the backend can pass `BigNumber` instances that get transformed to strings on the wire — matching the existing `Date`/`dateToIso` convention.

PriceSet is an empty boundary entity (just an `id` + timestamps) that decouples the pricing module from its consumers. Price holds `currencyCode`, `amount` (bignum), and `priceSetId`. The `currencyCode` column exists for multi-currency readiness but is hardcoded to `'usd'` at the API layer for now.

The Price table model should include TODO comments for future fields:

```
// TODO(pricing): add minQuantity, maxQuantity (bignum, nullable) for quantity tiers
// TODO(pricing): add rulesCount (integer, default 0) when PriceRule is added
// TODO(pricing): add priceListId (text, nullable FK) when PriceList is added
```

Create the following type files:

- `apps/backend/src/core/types/pricing/common.ts` — contains `PriceSetDTO`, `PriceDTO`, `CalculatedPriceSet`, `FilterablePriceProps`, `PricingContext`
- `apps/backend/src/core/types/pricing/mutations.ts` — contains `CreatePriceDTO`, `CreatePriceSetDTO`, `UpdatePriceDTO`
- `apps/backend/src/core/types/pricing/service.ts` — contains `IPricingModuleService` (full interface including `calculatePrices` signature; implementation deferred to ticket 02)
- `apps/backend/src/core/types/pricing/index.ts` — re-exports all three files

Add `export * from './pricing/index.js'` to `apps/backend/src/core/types/index.ts`.

`FilterablePriceProps` uses `interface extends BaseFilterable<FilterablePriceProps>` to match the established pattern in existing modules (despite the general preference for `type`).

`createPriceSets` must use `this.withTransaction(context, async (ctx) => { ... })` to create the PriceSet and its inline prices atomically.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `bignumber.js` installed as a dependency of both the backend and http-schemas packages
- [ ] Custom Drizzle column type `bignum` added to the column helpers (maps Postgres `numeric` to/from `BigNumber` using `toFixed()` / `new BigNumber()`)
- [ ] `bigNumberToString` Zod transform added to http-schemas common module (backend passes BigNumber, output is string)
- [ ] `stringToBigNumber` Zod transform added to http-schemas common module (client sends string, backend receives BigNumber)
- [ ] PriceSet table defined with `pset_` ID prefix, timestamps, and soft-delete
- [ ] Price table defined with `price_` ID prefix, `currencyCode` (text), `amount` (bignum), `priceSetId` (text), timestamps, partial indexes on `priceSetId` and `currencyCode`
- [ ] Drizzle relations: Price belongs to PriceSet, PriceSet has many Prices
- [ ] PriceSetRepository extends BaseRepository (no custom methods for MVP)
- [ ] PriceRepository extends BaseRepository with `findByPriceSetIds(priceSetIds[], currencyCode, context?)` custom method
- [ ] PricingModuleService implements: `createPriceSets`, `deletePriceSets` (cascades to prices), `addPrices`, `updatePrices`, `removePrices`, `listPrices`
- [ ] `PRICING` added to Modules enum, module registered via `Module()` factory and `bootstrapModule()` in the container
- [ ] Database config with `migrations_pricing` table, `casing: 'snake_case'`
- [ ] All new tables and relations registered in the central schema file
- [ ] Core types defined: `PriceSetDTO`, `PriceDTO`, `FilterablePriceProps` (interface extends BaseFilterable), `CreatePriceDTO`, `CreatePriceSetDTO`, `UpdatePriceDTO`, `PricingContext`
- [ ] BigNumber precision limitations documented in a code comment (16+ sig digit edge case, epsilon coercion)
- [ ] `createPriceSets` uses `withTransaction` for atomic PriceSet + Price creation
- [ ] Price table model includes TODO comments for future fields (minQuantity, maxQuantity, rulesCount, priceListId)
- [ ] Integration tests at the PricingModuleService boundary: create price set with inline prices, list prices with filters, delete cascades to prices, BigNumber amounts round-trip without precision loss
- [ ] Test fixtures added: `generateCreatePriceSetDTO`, `generateCreatePriceDTO` — registered in `apps/backend/tests/setup/test-extend.ts` under `dto.generate`
