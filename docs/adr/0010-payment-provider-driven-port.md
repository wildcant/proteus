# 10. Payment Provider as a Driven Port

**Status:** Accepted

## Context

The payment module needs to talk to external payment gateways (Stripe, in-house mark-as-paid, future providers). This is the first module where the outbound dependency isn't just a database — it's a third-party API with wildly different protocols per vendor.

We already use ports and adapters for the ORM layer (Drizzle adapter behind a repository interface). Payments need the same pattern at a higher level: a single interface the module service programs against, with concrete adapters per gateway.

Options considered:

- **Direct Stripe SDK calls in the service**: Simplest to start, but the module service becomes untestable without Stripe, and adding a second provider means `if/else` branching everywhere.
- **Strategy pattern (plain interface)**: Define `IPaymentProvider`, inject the right implementation. Clean, but doesn't guide adapter authors on what to implement or provide shared boilerplate.
- **Abstract base class + interface**: `IPaymentProvider` defines the contract (driven port), `AbstractPaymentProvider` provides the base class adapters extend. Adapters are resolved from the DI container by a well-known key.

## Decision

### The driven port: `IPaymentProvider`

A TypeScript interface in `core/types/payment/provider.ts`. It defines the full payment lifecycle:

```
IPaymentProvider
  ├── initiatePayment(input) → { id, data, status }
  ├── authorizePayment(input) → { status, data }
  ├── capturePayment(input) → { data }
  ├── refundPayment(input) → { data }
  ├── cancelPayment(input) → { data }
  ├── deletePayment(input) → { data }
  ├── retrievePayment(input) → { data }
  ├── getPaymentStatus(input) → { status }
  ├── getWebhookActionAndData(payload) → { action, data }
  ├── listPaymentMethods?(input) → PaymentMethodDTO[]
  ├── savePaymentMethod?(input) → PaymentMethodDTO
  └── deletePaymentMethod?(input) → void
```

Every method follows an opaque-data-in / opaque-data-out pattern. The module service never looks inside `data` — it stores whatever the provider returns and passes it back on the next call. This means the provider owns its own state shape.

Saved payment method operations are optional (`?`) — not every provider supports them.

### The adapter base: `AbstractPaymentProvider`

A class in `core/utils/` that implements `IPaymentProvider` with abstract methods. Each concrete adapter extends it and declares a static `identifier` (e.g. `"stripe"`, `"system"`).

### Two-service split

The module has two internal services:

- **`PaymentModuleService`** — orchestrates the payment lifecycle (collections, sessions, captures, refunds). It never calls a provider directly.
- **`PaymentProviderService`** — a thin facade that resolves the correct `IPaymentProvider` from the container by key (`pp_{identifier}_{id}`) and delegates. This is the only place provider resolution happens.

This keeps the orchestration logic provider-agnostic. `PaymentModuleService` calls `paymentProviderService.capturePayment(providerId, input)` and doesn't know or care whether it's Stripe or a no-op system provider behind that ID.

### Provider resolution

Providers are registered in the module's local DI container under `pp_{identifier}_{id}` (e.g., `pp_stripe_default`, `pp_system_default`). A module loader (see ADR 0011) handles this registration at boot time. The `payment_provider` DB table tracks which providers are registered and enabled, so the API can list available providers.

### SystemPaymentProvider

Always registered as `pp_system_default`. Every method returns success with empty data. Used for admin "mark as paid" flows where no real gateway interaction is needed. Excluded from store-facing provider listings.

### The client mirror: `StorePaymentAdapter`

The storefront runs the same shape one process out. A gateway that needs a browser SDK — Stripe
mounts an iframe and confirms the intent client-side — cannot be reached from the backend port
alone, so the store defines its own contract and one adapter per provider behind it.

- **The contract** lives at `apps/store/src/features/checkout/types/payment.ts`
  (`StorePaymentAdapter`, `CreateSession`, `Confirm`, `ConfirmOutcome`). The checkout programs
  against this and never against a gateway.
- **The adapters** live at `apps/store/src/features/checkout/utils/payment/adapters/{provider}/`,
  resolved by `utils/payment/registry.ts` — the client-side twin of `PaymentProviderService`.

`stripe-stays-in-its-adapter` in `apps/store/deps-analyzer/.dependency-cruiser.cjs` enforces it:
nothing outside the adapter directory may import from `@stripe/*`. A component or route that finds
itself wanting `useStripe()` needs something added to the contract instead, which is the point.

The directory is nested under `utils/` rather than sitting at the feature root because a store
feature holds only the folders Bulletproof React names — `api`, `assets`, `components`, `hooks`,
`stores`, `types`, `utils`. The adapter subtree was a `checkout/payment/` folder until 2026-09-05;
it moved so the vocabulary could be enforced mechanically rather than by convention, and
`STRIPE_ADAPTER_PATH` moved with it. Nesting *inside* a sanctioned folder is unconstrained, so the
adapter keeps its own internal shape.

## Consequences

- Adding a new payment provider means writing one class that extends `AbstractPaymentProvider` — no changes to the module service or orchestration logic
- The module service is fully testable with a fake provider (or the system provider)
- Provider state is opaque to the module — no Stripe-specific logic leaks into the domain layer
- The `PaymentProviderService` facade adds a small layer of indirection, but it centralizes provider resolution and keeps the module service clean
- Webhook handling routes through the same interface (`getWebhookActionAndData`), so provider-specific signature verification stays in the adapter
- The optional payment method operations mean providers can opt in to features without forcing all adapters to implement stubs
- The storefront mirrors the port with `StorePaymentAdapter`; a new client-side gateway means one adapter directory and one registry entry, with a dependency-cruiser rule keeping the SDK inside it
