# 02 — Cart-to-order checkout

**What to build:** The three link tables (order_cart, order_payment_collection, order_fulfillment), their full wiring into the link service, and the modification to `completeCartWorkflow` that transforms a completed cart into an order. After this ticket, `POST /store/carts/:id/complete` creates a real order -- snapshotting addresses, line items, and shipping methods from the cart, linking the order to the cart and payment collection, recording a capture transaction, and reserving inventory. The order_cart link provides idempotency: retrying cart completion returns the existing order.

**Blocked by:** 00 (Cart bignum migration), 01 (Order module core)

**Status:** ready-for-agent

## Link table definitions

- [ ] 3 link table definitions under `link-modules/definitions/` -- `order-cart.ts`, `order-payment-collection.ts`, `order-fulfillment.ts` -- with correct ID prefixes, unique indexes, and `...timestamps`
- [ ] `link-modules/definitions/index.ts` updated to export the 3 new tables (`orderCartTable`, `orderPaymentCollectionTable`, `orderFulfillmentTable`)

## Link repositories

- [ ] 3 repository classes under `link-modules/repositories/` following existing pattern (extend `BaseRepository(table)`)

## Link service wiring (5 files)

- [ ] `core/types/link/common.ts` -- Add DTO types (`OrderCartDTO`, `OrderPaymentCollectionDTO`, `OrderFulfillmentDTO`) and repository interfaces (`IOrderCartRepository`, `IOrderPaymentCollectionRepository`, `IOrderFulfillmentRepository`)
- [ ] `core/types/link/service.ts` -- Update `ILinkRepositoryMap` to include the 3 new repos. Update `LinkColumnRegistry` to map `orderId`, and extend `cartId`/`paymentCollectionId`/`fulfillmentId` entries to include new repo keys. Update `WritableLinkDTOMap`
- [ ] `link-modules/services/link-service.ts` -- Update `LinkRepositoryMap` type alias and `COLUMN_REGISTRY` const. Add new repos to constructor and `repo()` method
- [ ] `link-modules/index.ts` (`registerLinkService`) -- Instantiate 3 new repositories, pass to `LinkService` constructor alongside existing 4
- [ ] `modules-definition.ts` -- Add `Links.ORDER_CART`, `Links.ORDER_PAYMENT_COLLECTION`, `Links.ORDER_FULFILLMENT`

## Link migrations

- [ ] Remove existing link migration: `rm -rf ./src/link-modules/migrations/*`
- [ ] Regenerate: `npx drizzle-kit generate --name create_link_tables --config ./src/link-modules/database.config.ts`
- [ ] Verify generated SQL includes all 6 tables (3 existing + 3 new)

## Inventory module prerequisites

- [ ] Add `createReservationItems(data: CreateReservationItemDTO[])` to `IInventoryModuleService` and `InventoryModuleService` (model and repository already exist, types `CreateReservationItemDTO` and `ReservationItemDTO` already exist in `core/types/inventory/mutations.ts`)
- [ ] Add `deleteReservationItems(ids: string[])` to `IInventoryModuleService` and `InventoryModuleService`
- [ ] Add `listReservationItems(filters?)` to `IInventoryModuleService` and `InventoryModuleService`

## completeCartWorkflow modification

- [ ] `check-idempotency` step: query `orderCart` link for existing order; if found, return existing order without creating a duplicate
- [ ] `create-order` step: snapshot cart data into order. Money columns (`unitPrice`, `compareAtUnitPrice`, `amount`) are `BigNumber` on both sides after ticket 00 -- direct copy. Drop `metadata` fields from addresses, line items, and shipping methods. Parse shipping method `data` from `text` to `jsonb` if needed (cart stores as `text()`, order stores as `jsonb()`)
- [ ] `link-order` step: create `orderCart` and `orderPaymentCollection` link records
- [ ] `reserve-inventory` step: for each line item with a `variantId`, call `inventoryService.createReservationItems()`
- [ ] `record-transaction` step: create `orderTransaction` with amount, reference `'capture'`, referenceId from capture
- [ ] Compensation: if steps after order creation fail, delete the order and its links

## Tests

- [ ] Workflow tests covering: happy path end-to-end, idempotency on retry, metadata dropped during snapshotting, data text→jsonb handling, compensation on failure
