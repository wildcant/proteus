# Cash on Delivery (COD) Payment Provider

## Summary

COD is a payment method where customers pay upon item delivery rather than upfront. This document captures findings for implementing a COD provider in our payment system.

## Current State

- The only customer-facing payment option requires removing the `pp_system_*` filter in `apps/backend/src/api/store/payment-providers/route.ts`
- The system provider (`pp_system_default`) auto-authorizes and no-ops on capture — functionally identical to what COD needs
- For local testing, the system provider works fine as a stand-in

## Architecture

Payment providers are code-driven, not config-driven. Each provider needs:

1. A class extending `AbstractPaymentProvider` (`apps/backend/src/core/utils/abstract-payment-provider.ts`)
2. A static `identifier` property (e.g., `'cod'`)
3. Registration in `apps/backend/src/modules/payment/provider-declarations.ts`

The loader (`apps/backend/src/modules/payment/loaders/providers.ts`) auto-registers providers in both the DI container and database at startup. The store API filters out `pp_system_*` providers, so a `pp_cod_default` provider would appear in the storefront automatically.

## Implementation Plan

### Backend

Create `apps/backend/src/providers/payment-cod/` with a provider class that:

- **`initiatePayment`** — returns a session ID (no external gateway)
- **`authorizePayment`** — immediately returns `authorized`
- **`capturePayment`** — no-op (payment collected physically on delivery)
- **`cancelPayment`** / **`refundPayment`** / **`deletePayment`** — no-ops

This is nearly identical to the system provider (`apps/backend/src/modules/payment/providers/system.ts`). The only difference is the identifier (`'cod'` vs `'system'`).

### Frontend

The payment form (`apps/store/src/features/checkout/components/payment-form.tsx`) currently shows raw provider IDs. Add a display name mapping:

```typescript
const providerDisplay: Record<string, { label: string }> = {
  pp_cod_default: { label: 'Cash on Delivery' },
  pp_stripe_default: { label: 'Credit Card' },
}
```

### Admin Capture Flow

In a real COD flow, capture should happen when the delivery driver confirms payment collection — not via a manual admin button. Options:

1. **MVP**: Admin manually captures after delivery service reports collection (current system provider behavior)
2. **Future**: Integrate with delivery service webhooks to auto-capture on confirmed delivery

## References

- [medusa-payment-cash-on-delivery](https://github.com/xGearForce/medusa-payment-cash-on-delivery/blob/master/src/core/cod-base.ts) — Medusa v1 plugin (uses old `AbstractPaymentProcessor` API, not directly compatible)
- [Medusa discussion #3843](https://github.com/medusajs/medusa/discussions/3843) — Community discussion confirming "manual provider" as the standard COD approach

## Key Files

| File | Purpose |
|------|---------|
| `apps/backend/src/core/utils/abstract-payment-provider.ts` | Base class to extend |
| `apps/backend/src/modules/payment/providers/system.ts` | Reference implementation (copy and change identifier) |
| `apps/backend/src/modules/payment/provider-declarations.ts` | Register new provider here |
| `apps/backend/src/modules/payment/loaders/providers.ts` | Auto-loads and seeds providers |
| `apps/backend/src/api/store/payment-providers/route.ts` | Store API (filters `pp_system_*`) |
| `apps/store/src/features/checkout/components/payment-form.tsx` | Frontend provider display |
