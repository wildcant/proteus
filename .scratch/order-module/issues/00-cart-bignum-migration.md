# 00 — Cart bignum migration

**What to build:** Migrate cart money columns from `integer()` to `bignum()` (Postgres `NUMERIC`, JS `BigNumber`). After this ticket, cart line items and shipping methods store prices as `BigNumber` values, matching the pricing module and the upcoming order module. All layers -- models, DTOs, HTTP schemas, workflows, tests -- are updated to handle `BigNumber` instead of `number` for price fields.

**Blocked by:** None -- can start immediately (prefactoring).

**Status:** ready-for-agent

## Model changes (3 columns across 2 files)

- [ ] `modules/cart/models/line-item.ts`: change `unitPrice: integer().notNull()` to `unitPrice: bignum().notNull()` and `compareAtUnitPrice: integer()` to `compareAtUnitPrice: bignum()`. Import `bignum` from `core/db/bignum.js`
- [ ] `modules/cart/models/shipping-method.ts`: change `amount: integer().notNull()` to `amount: bignum().notNull()`. Import `bignum` from `core/db/bignum.js`

## Type changes

- [ ] `core/types/cart/common.ts`: `CartLineItemDTO.unitPrice` from `number` to `BigNumber`, `CartLineItemDTO.compareAtUnitPrice` from `number | null` to `BigNumber | null`, `CartShippingMethodDTO.amount` from `number` to `BigNumber`
- [ ] `core/types/cart/mutations.ts`: `CreateLineItemDTO.unitPrice` from `number` to `BigNumber`, `CreateLineItemDTO.compareAtUnitPrice` from `number | null | undefined` to `BigNumber | null | undefined`, `UpdateLineItemDTO.unitPrice` from `number | undefined` to `BigNumber | undefined`, `CreateShippingMethodDTO.amount` from `number` to `BigNumber`
- [ ] `core/types/link/common.ts`: `LineItemWithProductDTO.unitPrice` from `number` to `BigNumber`

## HTTP schema changes

- [ ] `packages/http-schemas/src/store/cart/entities.ts`: `StoreCartLineItem.unitPrice` and `compareAtUnitPrice` -- change `z.number()` to use `bigNumberToString` pattern from `packages/http-schemas/src/common.ts` for output serialization. Same for `StoreCartShippingMethod.amount`
- [ ] `packages/http-schemas/src/store/cart/payloads.ts`: `CreateCart`, `AddLineItem`, `UpdateLineItem` -- decide input format. Current: `z.number().int().min(0)`. Options: keep accepting `number` and transform to `BigNumber` in the route handler, or accept string and parse with `stringToBigNumber`. Match the approach the pricing module uses for its input schemas

## Workflow arithmetic

- [ ] `workflows/payment/create-payment-collection-for-cart.ts` lines 47-48: replace JS `+` and `*` operators with `BigNumber` methods (`.plus()`, `.multipliedBy()`). The computed total is passed to `paymentService.createPaymentCollection({ amount })` -- since payment module still uses `integer()`, convert back with `.toNumber()` at the payment boundary

## Tests

- [ ] `workflows/cart/__tests__/confirm-inventory-workflow.test.ts` line 38: change `unitPrice: 1000` to `unitPrice: new BigNumber(1000)`
- [ ] Any other test fixtures that construct `CartLineItemDTO` or `CartShippingMethodDTO` with numeric price literals

## Migration

- [ ] Remove existing cart migration: `rm -rf ./src/modules/cart/migrations/*`
- [ ] Regenerate: `npx drizzle-kit generate --name create_cart_tables --config ./src/modules/cart/database.config.ts`
- [ ] Verify generated SQL uses `numeric` instead of `integer` for the 3 changed columns
