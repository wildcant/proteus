# 03 — Admin order API (read + lifecycle)

**What to build:** All 8 admin API endpoints for orders: list, retrieve, complete, cancel, archive, create fulfillment, create shipment, and mark delivered. After this ticket, admins can browse orders, view order details with line items/shipping/transactions/computed totals, and drive orders through their full business lifecycle (complete, cancel, archive) via the API. The three fulfillment endpoints exist as route stubs that will be wired to workflows in ticket 05.

**Blocked by:** 01 (Order module core)

**Status:** ready-for-agent

## API routes

- [ ] `GET /admin/orders` -- paginated, filterable list of orders
- [ ] `GET /admin/orders/:id` -- retrieve order with line items, shipping methods, transactions, and computed totals (itemsTotal, shippingTotal, orderTotal, paidTotal)
- [ ] `POST /admin/orders/:id/complete` -- calls `orderService.completeOrder()` lifecycle method
- [ ] `POST /admin/orders/:id/cancel` -- calls `cancelOrderWorkflow`
- [ ] `POST /admin/orders/:id/archive` -- calls `orderService.archiveOrder()` lifecycle method
- [ ] `POST /admin/orders/:id/fulfillments` -- route stub that will invoke `createOrderFulfillmentWorkflow` (wired in ticket 05)
- [ ] `POST /admin/orders/:id/fulfillments/:fId/shipments` -- route stub for `createOrderShipmentWorkflow` (wired in ticket 05)
- [ ] `POST /admin/orders/:id/fulfillments/:fId/mark-as-delivered` -- route stub for `markOrderDeliveredWorkflow` (wired in ticket 05)

## Cancel workflow

- [ ] `cancelOrderWorkflow` implemented in `workflows/order/cancel-order.ts`: validates guards (status === pending AND fulfillmentStatus === notFulfilled), deletes reservation items via `inventoryService.deleteReservationItems()`, sets status to canceled with `canceledAt` timestamp

## HTTP schemas

- [ ] `packages/http-schemas/src/admin/order/` -- entities (Zod schemas with `.openapi()`), payloads, responses, queries, index.ts
- [ ] `packages/http-schemas/src/admin/index.ts` -- add `export * from './order/index.js'`

## Route pattern

- [ ] Follow existing admin route patterns: named exports (`GET`, `POST`), `Input`/`Output` schema declarations, `HttpRequest<typeof Input>` / `HttpResult<typeof Output>` types, services resolved from `req.scope`
