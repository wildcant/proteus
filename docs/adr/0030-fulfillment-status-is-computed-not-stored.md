# 30. Fulfillment Status Is Computed, Not Stored

The `fulfillment_status` column on the order table and its backing enum have been dropped. Fulfillment status is now derived at read time from the fulfillment record's timestamps (`packedAt`, `shippedAt`, `deliveredAt`, `canceledAt`) by a pure function in `workflows/order/utils/`. This matches Medusa's approach, where `getLastFulfillmentStatus` computes the value from timestamps rather than storing it.

## Considered Options

**Stored column updated by each workflow step.** This was the previous design. Every fulfillment lifecycle workflow (`create-order-fulfillment`, `create-order-shipment`, `mark-order-delivered`, `cancel-order`) wrote the status column, and each needed a compensation step to roll it back on failure. The admin and store frontends also re-derived the status client-side for action eligibility, duplicating the state machine.

**Computed at read time from timestamps.** The timestamps are the ground truth — `packedAt` is set at fulfillment creation, `shippedAt` at shipment, `deliveredAt` at delivery. A pure function maps them to a status label. Route handlers call it when assembling responses.

## Why computed wins

- **Single source of truth.** The timestamps already existed and were already authoritative; the column was a cache that could drift.
- **No compensation steps.** Workflows that wrote the column needed a compensating `updateFulfillmentStatus` to undo on rollback. With no column to write, that complexity disappears.
- **Module isolation.** `computeFulfillmentStatus` takes a `FulfillmentDTO[]` and returns a status string — a pure function in the workflow utils layer, not a method on either module's service. The order module never imports the fulfillment module.
- **Action eligibility moves server-side.** `computeAllowedActions` now returns `canFulfill`, `canShip`, and `canMarkAsDelivered` flags alongside the existing `canComplete`, `canCancel`, `canArchive`. The admin reads flags instead of reimplementing the state machine.

## Consequences

- **No direct filter on fulfillment status in list queries.** The column is gone, so `WHERE fulfillment_status = 'shipped'` is no longer possible. Filtering by computed properties requires a different approach (subquery or materialized view). This is deferred.
- **Route handlers do the assembly.** Each endpoint that returns fulfillment status fetches the fulfillment via the link service, calls the compute function, and spreads the result into the response. This is the standard cross-module read pattern.
