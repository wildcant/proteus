# Cash on Delivery (COD)

## Summary

With cash on delivery, the shopper pays when the order arrives rather than upfront. Proteus needs no
provider of its own for it: the manual payment provider (`pp_system_default`) is how a shop records
money received outside a gateway, cash on delivery included. Medusa's community reaches the same
answer ("manual provider" as the standard COD approach). Why an Order is paid this way is
[ADR-0039](adr/0039-draft-orders-and-manual-payments.md); how the module does it is the
[payment module README](../apps/backend/src/modules/payment/README.md).

## Offering it at checkout

A Region offers the manual provider at checkout only when the admin links the two. Link it to the
Regions that take cash on delivery and no others; a card-only store links it nowhere and offers
nothing new. The storefront lists the providers a Cart's Region links
(`apps/backend/src/api/store/carts/[id]/payment-providers/route.ts`) and shows each by its label.

Completing a Cart with the manual provider authorizes the Order's payment collection for its total
and captures nothing. The Order reads `authorized`, with the whole total outstanding.

## Recording the money

Capture is the admin recording money the shop received, not a gateway call. The admin records a
payment of any amount up to the Outstanding Amount, prefilled with it, and each recorded payment
captures that part of the collection:

- **All on delivery.** One payment for the whole total once the courier reports it collected. The
  Order goes from `authorized` to `captured`.
- **A deposit, then the rest.** A store that sells through a chat converts a Draft Order while
  recording the deposit (prefilled from the store's deposit percentage), so the Order reads
  `partially_captured`; the rest is recorded on delivery and the Order reads `captured`.

Each recorded payment writes an Order Transaction, so the Order's Paid Total and Outstanding Amount
follow what was received. Canceling an Order with money received asks how much of it to refund.

## Later

Capturing automatically when a delivery service confirms collection, through its webhooks, is not
built. Until then the admin records it.

## References

- [Medusa discussion #3843](https://github.com/medusajs/medusa/discussions/3843) — community
  discussion confirming the manual provider as the standard COD approach
- [medusa-payment-cash-on-delivery](https://github.com/xGearForce/medusa-payment-cash-on-delivery/blob/master/src/core/cod-base.ts)
  — a Medusa v1 plugin with a dedicated COD provider, which Proteus does not need

## Key Files

| File | Purpose |
|------|---------|
| `apps/backend/src/modules/payment/providers/system.ts` | The manual provider |
| `apps/backend/src/modules/payment/README.md` | Partial captures, Order Transactions, locking |
| `apps/backend/src/api/store/carts/[id]/payment-providers/route.ts` | The providers a Cart's Region offers |
| `packages/store-config/` | The store's deposit percentage |
