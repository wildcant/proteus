# 05 — Order fulfillment flow (fulfill, ship, deliver)

**What to build:** The three fulfillment workflows (`createOrderFulfillmentWorkflow`, `createOrderShipmentWorkflow`, `markOrderDeliveredWorkflow`) and wiring them into the admin fulfillment route stubs from ticket 03. After this ticket, admins can drive an order through its full physical lifecycle: create a fulfillment (notFulfilled -> fulfilled), register a shipment with tracking info (fulfilled -> shipped), and confirm delivery (shipped -> delivered). Each transition validates the current fulfillment status, interacts with the fulfillment module, manages the order_fulfillment link, and adjusts inventory.

**Blocked by:** 02 (Cart-to-order checkout -- for link tables and order_fulfillment link), 03 (Admin order API -- for the route stubs to wire into)

**Status:** ready-for-agent

## Inventory module prerequisites

- [ ] Add `adjustInventoryLevel(inventoryItemId, locationId, adjustment)` to `IInventoryModuleService` and `InventoryModuleService` -- decrements `stockedQuantity` on the inventory level (used when fulfillment is created to deduct reserved stock from physical stock)

## Fulfillment workflows

- [ ] `createOrderFulfillmentWorkflow` in `workflows/order/create-order-fulfillment.ts`:
  - Validates order state (status === pending, fulfillmentStatus === notFulfilled)
  - Creates fulfillment via `fulfillmentService.createFulfillment()` with items and location
  - Creates `orderFulfillment` link record
  - Sets `fulfillmentStatus = 'fulfilled'`
  - Adjusts inventory: calls `inventoryService.adjustInventoryLevel()` to decrement `stockedQuantity`, then `inventoryService.deleteReservationItems()` to remove reservations

- [ ] `createOrderShipmentWorkflow` in `workflows/order/create-order-shipment.ts`:
  - Validates order state (fulfillmentStatus === fulfilled) and that fulfillment is linked to order
  - Marks shipped via `fulfillmentService.updateFulfillment(fulfillmentId, { shippedAt: new Date() })` -- the fulfillment module has no dedicated `createShipment` method, use `updateFulfillment` with `UpdateFulfillmentDTO` date fields. Pass tracking data (trackingNumber, trackingUrl, labelUrl) if provided
  - Sets `fulfillmentStatus = 'shipped'`

- [ ] `markOrderDeliveredWorkflow` in `workflows/order/mark-order-delivered.ts`:
  - Validates order state (fulfillmentStatus === shipped) and that fulfillment is linked to order
  - Marks delivered via `fulfillmentService.updateFulfillment(fulfillmentId, { deliveredAt: new Date() })` -- same pattern as shipment, no dedicated `markAsDelivered` method
  - Sets `fulfillmentStatus = 'delivered'`

## Route wiring

- [ ] Wire `createOrderFulfillmentWorkflow` into `POST /admin/orders/:id/fulfillments` route stub from ticket 03
- [ ] Wire `createOrderShipmentWorkflow` into `POST /admin/orders/:id/fulfillments/:fId/shipments` route stub from ticket 03
- [ ] Wire `markOrderDeliveredWorkflow` into `POST /admin/orders/:id/fulfillments/:fId/mark-as-delivered` route stub from ticket 03

## Tests

- [ ] Workflow tests for each: happy path, invalid status transition rejected, compensation on failure
