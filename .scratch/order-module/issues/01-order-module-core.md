# 01 — Order module core

**What to build:** The order module with 5 domain tables (order, order_address, order_line_item, order_shipping_method, order_transaction), the module service implementing `IOrderModuleService`, types/DTOs, test factories, and module service tests. After this ticket, the order module exists as an isolated, testable unit -- you can create orders, manage addresses, add line items/shipping methods/transactions, and exercise all three lifecycle methods (complete, cancel, archive) with their guards and status transitions. No API routes, no workflows, no link tables yet.

**Blocked by:** None -- can start immediately.

**Status:** ready-for-agent

## Models & schema

- [ ] 5 Drizzle model files under `modules/order/models/` with correct ID prefixes, enums (`pgEnum` for status and fulfillmentStatus), indexes with `WHERE deleted_at IS NULL`, and `...timestamps` from `core/db/columns.ts`
- [ ] Money columns (`unitPrice`, `compareAtUnitPrice`, `amount`) use `bignum()` custom type from `core/db/bignum.ts` (maps to Postgres `NUMERIC`, JS `BigNumber`)
- [ ] `displayId` uses Drizzle's `serial()` from `drizzle-orm/pg-core` (no prior art in codebase -- first usage)
- [ ] `variantOptionValues` uses `text()` (matching cart). `data` on shipping method uses `jsonb()` for structured provider data
- [ ] `order_address` has no `metadata` column (cart address has one -- order intentionally omits it)
- [ ] Barrel export in `models/index.ts`

## Types

- [ ] Type definitions under `core/types/order/` -- `common.ts` (OrderDTO, FilterableOrderProps, etc.), `mutations.ts` (CreateOrderDTO, UpdateOrderDTO, etc.), `service.ts` (IOrderModuleService interface), `index.ts`
- [ ] `updateOrders` signature is `(ids: string[], data: UpdateOrderDTO)` (matches codebase convention of ids-based, not selector-based)
- [ ] Barrel export added to `core/types/index.ts`: `export * from './order/index.js'`

## Service

- [ ] `OrderModuleService` implementing full CRUD for all 5 entities plus `completeOrder`, `cancelOrder`, `archiveOrder` lifecycle methods with transition guards (see spec section 6)
- [ ] Computed totals helper using `BigNumber` arithmetic (`.multipliedBy()`, `.plus()`) -- not JS `number` math
- [ ] Cascade delete: deleting an order removes its line items, shipping methods, and transactions

## Module registration

- [ ] `modules/order/index.ts` following cart pattern: `export default Module(Modules.ORDER, { service, repositories })`
- [ ] `database.config.ts` following cart/payment pattern with `schema: './src/modules/order/models/*.ts'`, `out: './src/modules/order/migrations'`, `migrations.table: 'migrations_order'`
- [ ] `container.ts` updated: `import orderModule from './modules/order/index.js'` and `await bootstrapModule(container, orderModule)` added alongside existing modules
- [ ] `Modules.ORDER` already exists in `modules-definition.ts` (line 6) -- verify, no change needed

## Migrations

- [ ] Generate initial migration: `npx drizzle-kit generate --name create_order_tables --config ./src/modules/order/database.config.ts`

## Test factories

- [ ] `tests/factories/order-dto.ts` with synchronous generators: `generateOrderDTO`, `generateOrderLineItemDTO`, `generateOrderShippingMethodDTO`, `generateOrderTransactionDTO` (matching existing factory pattern -- accepts `Partial<DTO>` overrides, returns defaults with prefixed IDs)
- [ ] Wire into `tests/setup/test-extend.ts` under `dto.generate.order.*`

## Tests

- [ ] Module service tests covering: order CRUD, address snapshot creation, line item/shipping method bulk creation, transaction creation, all valid lifecycle transitions, all invalid transitions rejected (with correct error types), cascade delete, computed totals correctness with BigNumber values
