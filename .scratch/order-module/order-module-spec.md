# Order Module MVP Spec

Derived from grilling session against Medusa's order module deep dive at `thoughts/shared/research/order-module-deep-dive.md` and Medusa source at `/Users/willo/learn/medusa/medusa-source/`.

---

## 1. Scope Summary

| Decision | Choice |
|---|---|
| Entities | Order, OrderAddress, OrderLineItem, OrderShippingMethod, OrderTransaction |
| Link tables | order_cart, order_payment_collection, order_fulfillment |
| Amounts | `numeric` (bigNumber) via `bignum()` custom type from `core/db/bignum.ts`. Cart migrated to match (ticket 00) |
| Column types | `variantOptionValues` uses `text()` (matches cart). `data` uses `jsonb()` for structured provider data |
| Status model | Two independent enums: `status` (business) + `fulfillmentStatus` (physical) |
| Totals | Computed on-the-fly, no summary table |
| Fulfillment | Order-level only, no partial fulfillment, no per-item counters |
| Cancellation | Only when `pending` + `notFulfilled` |
| Cross-module refs | Plain text columns, no FK constraints (ADR-0001) |
| Metadata | None (not a Proteus pattern). Cart `metadata` fields silently dropped during snapshotting |
| Cart migration | Ticket 00 migrates cart `unitPrice`, `compareAtUnitPrice`, `amount` from `integer()` to `bignum()` |
| Tax / promotions | Out of scope, no related columns |
| RMA (returns, claims, exchanges) | Out of scope |
| Order changes / versioning | Out of scope |
| Draft orders | Out of scope |
| Refunds | Out of scope |

---

## 2. Problem Statement

Proteus can process carts through checkout (validate shipping, authorize payment, capture payment) but has no order module to persist the result. The `completeCartWorkflow` has a TODO at the point where order creation should happen. Without orders, there is no admin order list, no order detail page, no fulfillment tracking, and no record of completed purchases beyond a cart marked `completed`.

## 3. Solution

Add a minimal order module with 5 domain tables plus 3 link tables. The module tracks two independent state machines: business lifecycle (`pending -> completed -> archived`, `pending -> canceled`) and physical lifecycle (`notFulfilled -> fulfilled -> shipped -> delivered`). Totals are computed on-the-fly from line items, shipping methods, and transactions. No versioning, no order changes, no summary table.

---

## 4. Data Models

All tables in `apps/backend/src/modules/order/models/`. ID prefixes follow existing convention.

### order
```
id                  text PK   default: ord_<uuid>
displayId           serial    NOT NULL (auto-increment, human-readable)
status              enum      NOT NULL default: 'pending'
                              values: pending | completed | canceled | archived
fulfillmentStatus   enum      NOT NULL default: 'notFulfilled'
                              values: notFulfilled | fulfilled | shipped | delivered
email               text      NULL (snapshotted from cart)
customerId          text      NULL (plain text, no FK)
currencyCode        text      NOT NULL
shippingAddressId   text      NULL FK -> order_address.id
billingAddressId    text      NULL FK -> order_address.id
canceledAt          timestamptz NULL
createdAt           timestamptz NOT NULL default: now()
updatedAt           timestamptz NOT NULL default: now()
deletedAt           timestamptz NULL
```

> **Note:** `displayId` uses Drizzle's `serial()` from `drizzle-orm/pg-core`. This has no prior art in the Proteus codebase. Postgres `SERIAL` is a pseudo-type for an auto-incrementing `INTEGER` backed by a sequence.

Indexes:
- `idx_order_display_id` on `displayId` where `deleted_at IS NULL`
- `idx_order_customer_id` on `customerId` where `deleted_at IS NULL AND customer_id IS NOT NULL`
- `idx_order_currency_code` on `currencyCode` where `deleted_at IS NULL`
- `idx_order_status` on `status` where `deleted_at IS NULL`

### order_address
```
id              text PK   default: ordaddr_<uuid>
customerId      text      NULL
company         text      NULL
firstName       text      NULL
lastName        text      NULL
address1        text      NULL (DB column: address_1)
address2        text      NULL (DB column: address_2)
city            text      NULL
countryCode     text      NULL
province        text      NULL
postalCode      text      NULL
phone           text      NULL
createdAt       timestamptz NOT NULL default: now()
updatedAt       timestamptz NOT NULL default: now()
deletedAt       timestamptz NULL
```

Same shape as `cartAddress` minus `metadata`. Copied from cart at checkout (snapshot, not reference). No indexes (matches cart address pattern).

### order_line_item
```
id                    text PK   default: ordli_<uuid>
orderId               text      NOT NULL FK -> order.id (cascade delete)
title                 text      NOT NULL
subtitle              text      NULL
thumbnail             text      NULL
quantity              integer   NOT NULL
unitPrice             bignum    NOT NULL (numeric via bignum() custom type)
compareAtUnitPrice    bignum    NULL (strikethrough pricing)
variantId             text      NULL (plain text, no FK)
productId             text      NULL (plain text, no FK)
productTitle          text      NULL
productDescription    text      NULL
productSubtitle       text      NULL
productType           text      NULL
productHandle         text      NULL
variantSku            text      NULL
variantBarcode        text      NULL
variantTitle          text      NULL
variantOptionValues   text      NULL
requiresShipping      boolean   NOT NULL default: true
createdAt             timestamptz NOT NULL default: now()
updatedAt             timestamptz NOT NULL default: now()
deletedAt             timestamptz NULL
```

Indexes:
- `idx_order_line_item_order_id` on `orderId` where `deleted_at IS NULL`
- `idx_order_line_item_variant_id` on `variantId` where `deleted_at IS NULL AND variant_id IS NOT NULL`
- `idx_order_line_item_product_id` on `productId` where `deleted_at IS NULL AND product_id IS NOT NULL`

### order_shipping_method
```
id                text PK   default: ordsm_<uuid>
orderId           text      NOT NULL FK -> order.id (cascade delete)
name              text      NOT NULL
description       text      NULL
amount            bignum    NOT NULL (numeric via bignum() custom type)
shippingOptionId  text      NULL (plain text, no FK)
data              jsonb     NULL (provider-specific data, structured JSON)
createdAt         timestamptz NOT NULL default: now()
updatedAt         timestamptz NOT NULL default: now()
deletedAt         timestamptz NULL
```

Indexes:
- `idx_order_shipping_method_order_id` on `orderId` where `deleted_at IS NULL`
- `idx_order_shipping_method_option_id` on `shippingOptionId` where `deleted_at IS NULL AND shipping_option_id IS NOT NULL`

### order_transaction
```
id              text PK   default: ordtrx_<uuid>
orderId         text      NOT NULL FK -> order.id (cascade delete)
amount          bignum    NOT NULL (numeric via bignum() custom type, positive = capture)
currencyCode    text      NOT NULL
reference       text      NULL (e.g. "capture")
referenceId     text      NULL (e.g. the capture.id from payment module)
createdAt       timestamptz NOT NULL default: now()
updatedAt       timestamptz NOT NULL default: now()
deletedAt       timestamptz NULL
```

Indexes:
- `idx_order_transaction_order_id` on `orderId` where `deleted_at IS NULL`
- `idx_order_transaction_reference` on `reference, referenceId` where `deleted_at IS NULL`

For MVP, only capture transactions are recorded. When refunds are added later, they will be negative amounts.

### Snapshotting notes

When creating an order from a cart, the following conversions apply:

- **Money columns (unitPrice, compareAtUnitPrice, amount):** After ticket 00, both cart and order use `bignum()` (JS `BigNumber`). Direct copy, no conversion needed.
- **variantOptionValues:** Both cart and order use `text()`. Direct copy, no conversion needed.
- **data (shipping method):** Cart uses `text()`, order uses `jsonb()`. Parse with `JSON.parse()` during snapshotting if cart stores JSON as a string, or pass through if the value is already an object. Consider migrating cart `data` to `jsonb()` in a future ticket to eliminate this mismatch.

---

## 5. Link Tables

All in `apps/backend/src/link-modules/definitions/`.

### order_cart
```
id        text PK   default: ordcart_<uuid>
orderId   text      NOT NULL
cartId    text      NOT NULL
...timestamps
```
Unique index on `(orderId, cartId)` where `deleted_at IS NULL`.

Used for idempotency: if a cart already has a linked order, `completeCartWorkflow` returns the existing order instead of creating a duplicate.

### order_payment_collection
```
id                    text PK   default: ordpaycol_<uuid>
orderId               text      NOT NULL
paymentCollectionId   text      NOT NULL
...timestamps
```
Unique index on `(orderId, paymentCollectionId)` where `deleted_at IS NULL`.

### order_fulfillment
```
id              text PK   default: ordful_<uuid>
orderId         text      NOT NULL
fulfillmentId   text      NOT NULL
...timestamps
```
Unique index on `(orderId, fulfillmentId)` where `deleted_at IS NULL`.

### Links registration

Add to `modules-definition.ts`:
```typescript
export const Links = {
  // ... existing
  ORDER_CART: 'orderCart',
  ORDER_PAYMENT_COLLECTION: 'orderPaymentCollection',
  ORDER_FULFILLMENT: 'orderFulfillment',
} as const
```

---

## 6. Status Transitions

### Order status (business lifecycle)

```
pending ──> completed    (admin marks complete, typically after delivery)
pending ──> canceled     (admin cancels; only when fulfillmentStatus is notFulfilled)
completed ──> archived   (admin archives for cleanup)
```

Guards:
- Cancel: `status === 'pending'` AND `fulfillmentStatus === 'notFulfilled'`
- Complete: `status === 'pending'`
- Archive: `status === 'completed'`

### Fulfillment status (physical lifecycle)

```
notFulfilled ──> fulfilled   (fulfillment created for all items)
fulfilled ──> shipped        (shipment created with tracking)
shipped ──> delivered        (admin confirms delivery)
```

Guards:
- Fulfill: `fulfillmentStatus === 'notFulfilled'`
- Ship: `fulfillmentStatus === 'fulfilled'`
- Deliver: `fulfillmentStatus === 'shipped'`

---

## 7. Computed Totals

No summary table. Computed on-the-fly when needed:

```
itemsTotal    = SUM(orderLineItem.unitPrice * orderLineItem.quantity)
shippingTotal = SUM(orderShippingMethod.amount)
orderTotal    = itemsTotal + shippingTotal
paidTotal     = SUM(orderTransaction.amount)
```

All arithmetic uses `BigNumber` methods (`.multipliedBy()`, `.plus()`) to avoid floating-point errors.

---

## 8. Service Interface

```typescript
type IOrderModuleService = {
  // Orders
  retrieveOrder(id: string, config?: FindConfig<OrderDTO>): Promise<OrderDTO>
  listOrders(filters?: FilterableOrderProps, config?: FindConfig<OrderDTO>): Promise<OrderDTO[]>
  listAndCountOrders(filters?: FilterableOrderProps, config?: FindConfig<OrderDTO>): Promise<[OrderDTO[], number]>
  createOrder(data: CreateOrderDTO): Promise<OrderDTO>
  createOrders(data: CreateOrderDTO[]): Promise<OrderDTO[]>
  updateOrder(id: string, data: UpdateOrderDTO): Promise<OrderDTO>
  updateOrders(ids: string[], data: UpdateOrderDTO): Promise<OrderDTO[]>
  deleteOrders(ids: string[]): Promise<void>
  softDeleteOrders(ids: string[]): Promise<void>
  restoreOrders(ids: string[]): Promise<void>

  // Addresses
  createOrderAddress(data: CreateOrderAddressDTO): Promise<OrderAddressDTO>
  createOrderAddresses(data: CreateOrderAddressDTO[]): Promise<OrderAddressDTO[]>
  updateOrderAddress(id: string, data: UpdateOrderAddressDTO): Promise<OrderAddressDTO>
  deleteOrderAddresses(ids: string[]): Promise<void>

  // Line items (created at checkout, immutable after)
  createOrderLineItems(orderId: string, items: CreateOrderLineItemDTO[]): Promise<OrderLineItemDTO[]>
  listOrderLineItems(filters?: FilterableOrderLineItemProps, config?: FindConfig<OrderLineItemDTO>): Promise<OrderLineItemDTO[]>

  // Shipping methods (created at checkout, immutable after)
  createOrderShippingMethods(orderId: string, methods: CreateOrderShippingMethodDTO[]): Promise<OrderShippingMethodDTO[]>
  listOrderShippingMethods(filters?: FilterableOrderShippingMethodProps, config?: FindConfig<OrderShippingMethodDTO>): Promise<OrderShippingMethodDTO[]>

  // Transactions
  addOrderTransaction(data: CreateOrderTransactionDTO): Promise<OrderTransactionDTO>
  addOrderTransactions(data: CreateOrderTransactionDTO[]): Promise<OrderTransactionDTO[]>
  listOrderTransactions(filters?: FilterableOrderTransactionProps, config?: FindConfig<OrderTransactionDTO>): Promise<OrderTransactionDTO[]>

  // Lifecycle
  completeOrder(id: string): Promise<OrderDTO>
  cancelOrder(id: string): Promise<OrderDTO>
  archiveOrder(id: string): Promise<OrderDTO>
}
```

---

## 9. Workflows

### 1. `completeCartWorkflow` (modify existing)

**Trigger:** `POST /store/carts/:id/complete`

Steps:
1. `validate-shipping` -- validate shipping method exists and option is still enabled (already implemented)
2. `authorize-and-complete` -- authorize payment session, capture payment (already implemented)
3. `check-idempotency` -- query `orderCart` link for existing order; if found, return existing order ID and skip creation
4. `create-order` -- transform cart data into `CreateOrderDTO`:
   - Copy `email`, `customerId`, `currencyCode` from cart
   - Snapshot addresses: copy `cartAddress` rows into `orderAddress` (drop `metadata`)
   - Snapshot line items: copy `cartLineItem` rows into `orderLineItem` (drop `metadata`)
   - Snapshot shipping methods: copy `cartShippingMethod` rows into `orderShippingMethod` (drop `metadata`, parse `data` from text to jsonb if needed)
   - Money columns (`unitPrice`, `compareAtUnitPrice`, `amount`) are already `BigNumber` on both sides after ticket 00 -- direct copy
   - Set `status: 'pending'`, `fulfillmentStatus: 'notFulfilled'`
5. `link-order` -- create link records:
   - `orderCart`: order <-> cart
   - `orderPaymentCollection`: order <-> payment collection (from `cartPaymentCollection` link)
6. `reserve-inventory` -- for each line item with a `variantId`, create reservation items via inventory module
7. `record-transaction` -- create `orderTransaction` from the payment capture (amount, currencyCode, reference: `'capture'`, referenceId: capture ID)
8. `mark-cart-completed` -- set cart status to `completed`, set `completedAt` (already implemented)

**Compensation:** If any step after order creation fails, delete the order and its links.

> **Prerequisite:** The inventory module's `IInventoryModuleService` currently has no reservation creation methods. The model (`reservation-item`) and repository exist, but the service methods (`createReservationItems`, `deleteReservationItems`) must be added as part of this ticket. Types `CreateReservationItemDTO` and `ReservationItemDTO` already exist in `core/types/inventory/mutations.ts`.

### 2. `createOrderFulfillmentWorkflow`

**Trigger:** `POST /admin/orders/:id/fulfillments`

Input: `{ orderId, items: [{ id, quantity }], locationId }`

Steps:
1. `validate` -- order exists, `status === 'pending'`, `fulfillmentStatus === 'notFulfilled'`
2. `create-fulfillment` -- create fulfillment via `fulfillmentService.createFulfillment()` with items and location
3. `link-fulfillment` -- create `orderFulfillment` link
4. `update-status` -- set `fulfillmentStatus = 'fulfilled'`
5. `adjust-inventory` -- deduct reserved inventory from stock levels (update `stockedQuantity` on inventory levels, delete reservation items)

> **Prerequisite:** The inventory module needs methods to adjust inventory levels and delete reservations. Add `adjustInventoryLevel` (decrement `stockedQuantity`) and `deleteReservationItems` to `IInventoryModuleService`.

### 3. `createOrderShipmentWorkflow`

**Trigger:** `POST /admin/orders/:id/fulfillments/:fId/shipments`

Input: `{ orderId, fulfillmentId, trackingNumber?, trackingUrl?, labelUrl? }`

Steps:
1. `validate` -- order exists, fulfillment is linked, `fulfillmentStatus === 'fulfilled'`
2. `mark-shipped` -- call `fulfillmentService.updateFulfillment(fulfillmentId, { shippedAt: new Date() })` plus any tracking data. The fulfillment module has no dedicated `createShipment` method -- use `updateFulfillment` with date fields per `UpdateFulfillmentDTO`
3. `update-status` -- set `fulfillmentStatus = 'shipped'`

### 4. `markOrderDeliveredWorkflow`

**Trigger:** `POST /admin/orders/:id/fulfillments/:fId/mark-as-delivered`

Input: `{ orderId, fulfillmentId }`

Steps:
1. `validate` -- order exists, fulfillment is linked, `fulfillmentStatus === 'shipped'`
2. `mark-delivered` -- call `fulfillmentService.updateFulfillment(fulfillmentId, { deliveredAt: new Date() })`. The fulfillment module has no dedicated `markAsDelivered` method -- use `updateFulfillment` with date fields
3. `update-status` -- set `fulfillmentStatus = 'delivered'`

### 5. `cancelOrderWorkflow`

**Trigger:** `POST /admin/orders/:id/cancel`

Input: `{ orderId }`

Steps:
1. `validate` -- order exists, `status === 'pending'`, `fulfillmentStatus === 'notFulfilled'`
2. `release-inventory` -- delete all reservation items for this order's line items via `inventoryService.deleteReservationItems()`
3. `cancel` -- set `status = 'canceled'`, `canceledAt = now()`

---

## 10. API Endpoints

### Admin (8 endpoints)

| Method | Path | Action |
|---|---|---|
| GET | `/admin/orders` | List orders (paginated, filterable) |
| GET | `/admin/orders/:id` | Retrieve order with line items, shipping, transactions, computed totals |
| POST | `/admin/orders/:id/complete` | `completeOrder` lifecycle method |
| POST | `/admin/orders/:id/cancel` | `cancelOrderWorkflow` |
| POST | `/admin/orders/:id/archive` | `archiveOrder` lifecycle method |
| POST | `/admin/orders/:id/fulfillments` | `createOrderFulfillmentWorkflow` |
| POST | `/admin/orders/:id/fulfillments/:fId/shipments` | `createOrderShipmentWorkflow` |
| POST | `/admin/orders/:id/fulfillments/:fId/mark-as-delivered` | `markOrderDeliveredWorkflow` |

### Store (2 endpoints)

| Method | Path | Action |
|---|---|---|
| GET | `/store/orders` | List customer's orders (filtered by `customerId` from auth) |
| GET | `/store/orders/:id` | Retrieve single order |

---

## 11. Module Structure

```
apps/backend/src/modules/order/
  models/
    order.ts
    address.ts
    line-item.ts
    shipping-method.ts
    transaction.ts
    index.ts
  repositories/
    order.ts
    address.ts
    line-item.ts
    shipping-method.ts
    transaction.ts
    index.ts
  services/
    order-module-service.ts
    index.ts
  __tests__/
    order-module-service.test.ts
  index.ts
  database.config.ts

apps/backend/src/core/types/order/
  common.ts      -- OrderDTO, FilterableOrderProps, etc.
  mutations.ts   -- CreateOrderDTO, UpdateOrderDTO, etc.
  service.ts     -- IOrderModuleService
  index.ts

apps/backend/src/link-modules/definitions/
  order-cart.ts
  order-payment-collection.ts
  order-fulfillment.ts

apps/backend/src/link-modules/repositories/
  order-cart.ts
  order-payment-collection.ts
  order-fulfillment.ts

apps/backend/src/workflows/order/
  create-order-fulfillment.ts
  create-order-shipment.ts
  mark-order-delivered.ts
  cancel-order.ts

apps/backend/src/api/admin/orders/
  route.ts
  [id]/route.ts
  [id]/complete/route.ts
  [id]/cancel/route.ts
  [id]/archive/route.ts
  [id]/fulfillments/route.ts
  [id]/fulfillments/[fulfillmentId]/shipments/route.ts
  [id]/fulfillments/[fulfillmentId]/mark-as-delivered/route.ts

apps/backend/src/api/store/orders/
  route.ts
  [id]/route.ts

packages/http-schemas/src/admin/order/
  entities.ts
  payloads.ts
  responses.ts
  queries.ts
  index.ts

packages/http-schemas/src/store/order/
  entities.ts
  responses.ts
  queries.ts
  index.ts

apps/backend/tests/factories/
  order-dto.ts
```

---

## 12. Testing

### Test seam

Primary seam: `IOrderModuleService` instantiated with real repositories against a test Postgres database. Same pattern as `payment-module-service.test.ts`, `product-module-service.test.ts`, and `customer-module-service.test.ts`.

Workflow tests mock module services via Awilix container, same pattern as `confirm-inventory-workflow.test.ts`.

### Test factories

Add `tests/factories/order-dto.ts` with synchronous generator functions (no DB access) matching the existing factory pattern:
- `generateOrderDTO(overrides?: Partial<OrderDTO>)` -- returns a default order DTO with prefixed ID, pending status, notFulfilled, etc.
- `generateOrderLineItemDTO(overrides?)` -- returns a default line item DTO
- `generateOrderShippingMethodDTO(overrides?)` -- returns a default shipping method DTO
- `generateOrderTransactionDTO(overrides?)` -- returns a default transaction DTO

Wire into `tests/setup/test-extend.ts` under `dto.generate.order.*`.

### What makes a good test

Tests exercise the module through its public service interface. They assert external behavior (return values, state changes, error types) not implementation details (which repository method was called, SQL generated). A test should read as a user story: "create an order, then cancel it, then verify status is canceled and the cancel guard prevents re-cancellation."

### Key scenarios

**Module service tests:**
- Order CRUD (create, retrieve, list, update, soft-delete, restore)
- Address snapshot creation and retrieval
- Line item and shipping method creation (bulk, with order association)
- Transaction creation and listing
- `completeOrder` -- happy path + guard (only pending orders)
- `cancelOrder` -- happy path + guard (only pending + notFulfilled) + sets `canceledAt`
- `archiveOrder` -- happy path + guard (only completed orders)
- Fulfillment status transitions -- each valid transition + each invalid transition rejected
- Cascade delete (deleting an order removes line items, shipping methods, transactions)
- Computed totals helper (items + shipping + transactions sum correctly)

**Workflow tests:**
- `createOrderFulfillmentWorkflow` -- validates order state, creates fulfillment, links it, updates status
- `cancelOrderWorkflow` -- validates guards, releases inventory, sets status
- `completeCartWorkflow` (modified) -- idempotency check, order creation, link creation, inventory reservation, transaction recording

### Prior art

- Module tests: `apps/backend/src/modules/payment/__tests__/payment-module-service.test.ts`
- Workflow tests: `apps/backend/src/workflows/cart/__tests__/confirm-inventory-workflow.test.ts`

---

## 13. Out of Scope

- Tax lines / tax computation (no tax line tables, no `isTaxInclusive` columns)
- Promotions / adjustments (no adjustment tables, no `isDiscountable` column, no promotion links)
- Credit lines / store credit / loyalty
- Returns, claims, exchanges (RMA)
- Order edits / order changes / versioning
- Draft orders
- Partial fulfillment (entire order fulfilled as a unit)
- Refunds (no negative transactions, no refund workflows)
- Region / sales channel
- Order transfer
- Order export
- Translation / locale
- Metadata fields
- Notification triggers
- Gift card columns

---

## 14. Extension Points

When features beyond MVP are needed:

- **Versioning / order changes:** Add `OrderChange` + `OrderChangeAction` tables. Replace `fulfillmentStatus` enum with per-item quantity counters.
- **Partial fulfillment:** Add `fulfilledQuantity`, `shippedQuantity`, `deliveredQuantity` to `order_line_item`. Remove order-level `fulfillmentStatus`.
- **Refunds:** Add negative `orderTransaction` records and a refund workflow.
- **Tax:** Add `order_line_item_tax_line` and `order_shipping_method_tax_line` tables mirroring the cart equivalents.
- **Promotions:** Add `order_line_item_adjustment` and `order_shipping_method_adjustment` tables plus an `orderPromotion` link.

Full Medusa order module deep dive available at `thoughts/shared/research/order-module-deep-dive.md`.

---

## 15. Wiring & Registration Checklist

These files must be updated to integrate the order module and link tables into the running system. Missing any of these will cause runtime failures.

### Order module wiring

1. **`apps/backend/src/container.ts`** -- Add `import orderModule from './modules/order/index.js'` and call `await bootstrapModule(container, orderModule)` alongside the other 10 module bootstrap calls.

2. **`apps/backend/src/core/types/index.ts`** -- Add `export * from './order/index.js'` to the barrel export (currently exports auth, cart, customer, fulfillment, inventory, lifecycle, link, logger, notification, payment, pricing, product, scheduler, user).

3. **`apps/backend/src/modules/order/index.ts`** -- Create module definition following cart pattern:
   ```typescript
   export default Module(Modules.ORDER, {
     service: OrderModuleService,
     repositories: { orderRepository, addressRepository, lineItemRepository, shippingMethodRepository, transactionRepository },
   })
   ```

4. **`apps/backend/src/core/utils/modules-definition.ts`** -- `Modules.ORDER` already exists (line 6). Only need to add `Links.ORDER_CART`, `Links.ORDER_PAYMENT_COLLECTION`, `Links.ORDER_FULFILLMENT`.

### Link module wiring

5. **`apps/backend/src/link-modules/definitions/index.ts`** -- Add exports for the 3 new link tables (`orderCartTable`, `orderPaymentCollectionTable`, `orderFulfillmentTable`). These are picked up by the link-modules `database.config.ts` schema glob.

6. **`apps/backend/src/link-modules/index.ts`** (`registerLinkService`) -- Instantiate the 3 new link repositories with `new OrderCartRepository({ getDb })`, etc. Pass them to the `LinkService` constructor alongside the existing 4.

7. **`apps/backend/src/link-modules/services/link-service.ts`** -- Update `LinkRepositoryMap` type to include the 3 new repos. Update `COLUMN_REGISTRY` to map the new columns (`orderId`, `cartId` addition, `paymentCollectionId` addition, `fulfillmentId`) to their respective repo keys.

8. **`apps/backend/src/core/types/link/common.ts`** -- Add DTO types and repository interfaces: `OrderCartDTO`, `OrderPaymentCollectionDTO`, `OrderFulfillmentDTO`, `IOrderCartRepository`, `IOrderPaymentCollectionRepository`, `IOrderFulfillmentRepository`.

9. **`apps/backend/src/core/types/link/service.ts`** -- Update `ILinkRepositoryMap`, `LinkColumnRegistry`, `WritableLinkDTOMap` to include the 3 new link repos.

### HTTP schema wiring

10. **`packages/http-schemas/src/admin/index.ts`** -- Add `export * from './order/index.js'`.

11. **`packages/http-schemas/src/store/index.ts`** -- Add `export * from './order/index.js'`.

---

## 16. Migration Generation

Proteus uses Drizzle Kit for migrations. Each module has its own `database.config.ts` and `migrations/` directory.

### Cart module (migrate columns -- ticket 00)

Migrate 3 money columns from `integer()` to `bignum()`. Remove the existing migration and regenerate:

```bash
rm -rf ./src/modules/cart/migrations/*
npx drizzle-kit generate --name create_cart_tables --config ./src/modules/cart/database.config.ts
```

### Order module (new)

Create `apps/backend/src/modules/order/database.config.ts` following the cart/payment pattern:
```typescript
import { defineConfig } from 'drizzle-kit'
import { env } from '../../env.js'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/modules/order/models/*.ts',
  out: './src/modules/order/migrations',
  casing: 'snake_case',
  migrations: { table: 'migrations_order' },
  dbCredentials: { url: env.DATABASE_URL },
})
```

Generate the initial migration:
```bash
npx drizzle-kit generate --name create_order_tables --config ./src/modules/order/database.config.ts
```

### Link modules (existing -- regenerate)

The link-modules migration config at `apps/backend/src/link-modules/database.config.ts` uses `schema: './src/link-modules/definitions/*.ts'` which auto-discovers new table files. Since this is a development environment, remove the existing migration and regenerate a single clean migration that includes all link tables (old + new):

```bash
rm -rf ./src/link-modules/migrations/*
npx drizzle-kit generate --name create_link_tables --config ./src/link-modules/database.config.ts
```

After generating, verify the SQL includes all 6 tables: `cart_payment_collection`, `product_variant_inventory_item`, `product_variant_price_set`, `order_cart`, `order_payment_collection`, `order_fulfillment`.

---

## 17. Inventory Module Prerequisites

The order module's workflows depend on inventory reservation methods that do not yet exist on `IInventoryModuleService`. The model (`reservation-item`), repository, and DTO types (`CreateReservationItemDTO`, `ReservationItemDTO`) already exist -- only the service methods need to be wired.

Methods to add to `IInventoryModuleService` and `InventoryModuleService`:

| Method | Purpose | Used by |
|---|---|---|
| `createReservationItems(data: CreateReservationItemDTO[])` | Reserve inventory for order line items | `completeCartWorkflow` step 6 |
| `deleteReservationItems(ids: string[])` | Release reservations on cancellation | `cancelOrderWorkflow` step 2 |
| `listReservationItems(filters?)` | Query reservations by line item or order | `cancelOrderWorkflow` (to find reservations to delete) |
| `adjustInventoryLevel(itemId, locationId, adjustment)` | Decrement `stockedQuantity` when fulfillment ships | `createOrderFulfillmentWorkflow` step 5 |
