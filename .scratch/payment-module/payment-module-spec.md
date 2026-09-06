# Payment Module MVP Spec

Derived from grilling session against [PAYMENT-MODULE-DEEP-DIVE.md](./PAYMENT-MODULE-DEEP-DIVE.md) and Medusa source at `/Users/willo/learn/medusa/medusa-source/`.

---

## 1. Scope Summary

| Decision | Choice |
|---|---|
| Entities | PaymentCollection, PaymentSession, Payment, Capture, Refund, RefundReason, PaymentProvider, AccountHolder |
| Currency | Keep `currencyCode` on schema + provider interface, hardcode `"usd"` in service layer |
| Amounts | Integer cents (Stripe-style). `5000` = $50.00 USD |
| Service architecture | Two services: `PaymentModuleService` (orchestration) + `PaymentProviderService` (provider facade) |
| Provider abstraction | `AbstractPaymentProvider` base class, `IPaymentProvider` interface |
| Adapters | `SystemPaymentProvider` (always registered) + `StripeProviderService` (via ModuleProvider) |
| Provider location | Colocated: `apps/backend/src/providers/payment-stripe/` |
| Module infra | Add `loaders` to `Module()`, add `options` to `bootstrapModule()`, add `ModuleProvider` utility |
| Opaque data | Keep `data: Record<string, unknown>` threading pattern exactly like Medusa |
| Webhooks | Include route + inline processing (no event/subscriber system yet, leave TODO) |
| Link modules | Cart <-> PaymentCollection link |
| Order module | Out of scope |

---

## 2. Data Models

All tables in `apps/backend/src/modules/payment/models/`. ID prefixes follow Medusa convention.

### payment_collection
```
id              text PK   default: pay_col_<uuid>
currencyCode   text      NOT NULL (hardcoded "usd")
amount          integer   NOT NULL (cents)
authorizedAmount integer NULL
capturedAmount   integer NULL
refundedAmount   integer NULL
completedAt    timestamp NULL
status          text      NOT NULL default: 'not_paid'
metadata        jsonb     NULL
createdAt      timestamp NOT NULL default: now()
updatedAt      timestamp NOT NULL default: now()
deletedAt      timestamp NULL
```

### payment_session
```
id                      text PK   default: payses_<uuid>
paymentCollectionId   text      NOT NULL FK -> payment_collection.id
providerId             text      NOT NULL
currencyCode           text      NOT NULL
amount                  integer   NOT NULL (cents)
status                  text      NOT NULL default: 'pending'
data                    jsonb     NOT NULL default: {}
context                 jsonb     NULL
authorizedAt           timestamp NULL
metadata                jsonb     NULL
createdAt              timestamp NOT NULL default: now()
updatedAt              timestamp NOT NULL default: now()
deletedAt              timestamp NULL

INDEX idx_payment_session_collection_id ON (paymentCollectionId)
```

### payment
```
id                      text PK   default: pay_<uuid>
paymentCollectionId   text      NOT NULL FK -> payment_collection.id
paymentSessionId      text      NOT NULL FK -> payment_session.id
amount                  integer   NOT NULL (cents)
currencyCode           text      NOT NULL
providerId             text      NOT NULL
data                    jsonb     NULL
metadata                jsonb     NULL
capturedAt             timestamp NULL   -- status flag: fully captured
canceledAt             timestamp NULL   -- status flag: canceled
createdAt              timestamp NOT NULL default: now()
updatedAt              timestamp NOT NULL default: now()
deletedAt              timestamp NULL

INDEX idx_payment_provider_id ON (providerId)
INDEX idx_payment_collection_id ON (paymentCollectionId)
INDEX idx_payment_session_id ON (paymentSessionId)
```

No status enum on Payment. `capturedAt` and `canceledAt` timestamps serve as status flags.

### capture
```
id          text PK   default: capt_<uuid>
paymentId  text      NOT NULL FK -> payment.id
amount      integer   NOT NULL (cents)
createdBy  text      NULL
metadata    jsonb     NULL
createdAt  timestamp NOT NULL default: now()

INDEX idx_capture_payment_id ON (paymentId)
```

### refund
```
id                text PK   default: ref_<uuid>
paymentId        text      NOT NULL FK -> payment.id
refundReasonId  text      NULL FK -> refund_reason.id
amount            integer   NOT NULL (cents)
note              text      NULL
createdBy        text      NULL
metadata          jsonb     NULL
createdAt        timestamp NOT NULL default: now()

INDEX idx_refund_payment_id ON (paymentId)
```

### refund_reason
```
id          text PK   default: refr_<uuid>
label       text      NOT NULL
code        text      NOT NULL
description text      NULL
metadata    jsonb     NULL
createdAt  timestamp NOT NULL default: now()
updatedAt  timestamp NOT NULL default: now()
deletedAt  timestamp NULL
```

### payment_provider
```
id          text PK   (e.g. "pp_stripe_default", "pp_system_default")
isEnabled  boolean   NOT NULL default: true
```

No auto-generated ID. The ID is the provider key set during registration.

### account_holder
```
id          text PK   default: acchld_<uuid>
providerId text      NOT NULL
externalId text      NOT NULL   -- e.g. Stripe Customer ID
email       text      NULL
data        jsonb     NOT NULL default: {}
metadata    jsonb     NULL
createdAt  timestamp NOT NULL default: now()
updatedAt  timestamp NOT NULL default: now()
deletedAt  timestamp NULL

UNIQUE INDEX idx_account_holder_provider_external ON (providerId, externalId)
```

### Link table: cart_payment_collection
```
id                      text PK   default: cartpaycol_<uuid>
cartId                 text      NOT NULL
paymentCollectionId   text      NOT NULL
createdAt              timestamp NOT NULL default: now()
deletedAt              timestamp NULL

UNIQUE INDEX idx_cart_payment_collection ON (cartId, paymentCollectionId) WHERE deletedAt IS NULL
```

Lives in `apps/backend/src/link-modules/definitions/`.

---

## 3. Status Enums

Defined in `apps/backend/src/core/types/payment/common.ts`:

```typescript
type PaymentCollectionStatus =
  | 'not_paid'
  | 'awaiting'
  | 'authorized'
  | 'partially_authorized'
  | 'completed'

type PaymentSessionStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'requires_more'
  | 'error'
  | 'canceled'
  | 'pending_authorization'
```

`PaymentCollectionStatus` is **derived** -- recomputed by `maybeUpdatePaymentCollection_()` after every mutation. Never manually set.

---

## 4. Type Interfaces

All in `apps/backend/src/core/types/payment/`.

### common.ts -- DTOs and filterable types
- `PaymentCollectionDTO`, `FilterablePaymentCollectionProps`
- `PaymentSessionDTO`, `FilterablePaymentSessionProps`
- `PaymentDTO`, `FilterablePaymentProps`
- `CaptureDTO`, `FilterableCaptureProps`
- `RefundDTO`, `FilterableRefundProps`
- `RefundReasonDTO`, `FilterableRefundReasonProps`
- `PaymentProviderDTO`, `FilterablePaymentProviderProps`
- `AccountHolderDTO`
- `PaymentMethodDTO` (`id`, `data`, `providerId` -- provider-managed, no DB table)

### mutations.ts -- Create/Update DTOs
- `CreatePaymentCollectionDTO` (`amount`, `currencyCode` optional defaulting to "usd")
- `UpdatePaymentCollectionDTO`
- `CreatePaymentSessionDTO` (`providerId`, `amount`, `currencyCode`, `data`, `context?`)
- `UpdatePaymentSessionDTO`
- `CreatePaymentDTO`
- `CreateCaptureDTO` (`paymentId`, `amount?`, `capturedBy?`)
- `CreateRefundDTO` (`paymentId`, `amount?`, `refundReasonId?`, `note?`, `createdBy?`)
- `CreatePaymentProviderDTO` (`id`, `isEnabled?`)
- `CreateAccountHolderDTO`
- `CreateRefundReasonDTO`
- `UpdateRefundReasonDTO`
- `CreatePaymentMethodDTO` (`providerId`, `data`, `context`)
- `DeletePaymentMethodDTO` (`id`, `providerId`, `data?`, `context?`)
- `FilterablePaymentMethodProps` (`providerId`, `context`)
- `ProviderWebhookPayload` (`provider`, `payload: { data, rawData, headers }`)

### provider.ts -- Payment provider interface (driven/outbound port)

```typescript
interface IPaymentProvider {
  getIdentifier(): string

  // Core payment lifecycle
  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput>
  authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput>
  capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput>
  cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput>
  deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput>
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput>
  retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput>
  updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput>
  getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput>

  // Webhooks
  getWebhookActionAndData(data: ProviderWebhookPayload['payload']): Promise<WebhookActionResult>

  // Account holders (optional -- provider may not support)
  createAccountHolder?(input: CreateAccountHolderInput): Promise<CreateAccountHolderOutput>
  deleteAccountHolder?(input: DeleteAccountHolderInput): Promise<DeleteAccountHolderOutput>

  // Saved payment methods (optional -- provider may not support)
  listPaymentMethods?(input: ListPaymentMethodsInput): Promise<ListPaymentMethodsOutput>
  savePaymentMethod?(input: SavePaymentMethodInput): Promise<SavePaymentMethodOutput>
  deletePaymentMethod?(input: DeletePaymentMethodInput): Promise<DeletePaymentMethodOutput>
}
```

Each method receives `{ data?, context? }` (opaque provider state + idempotency/customer context).
Each method returns `{ data?, status? }` (updated provider state).

Key input/output types:
- `InitiatePaymentInput`: `{ amount, currencyCode, data?, context? }` -> `{ id, data?, status? }`
- `AuthorizePaymentInput`: `{ data?, context? }` -> `{ status, data? }`
- `CapturePaymentInput`: `{ data?, context? }` -> `{ data? }`
- `RefundPaymentInput`: `{ amount, data?, context? }` -> `{ data? }`
- `WebhookActionResult`: `{ action: PaymentActions, data?: { sessionId, amount } }`

`PaymentActions`: `'authorized' | 'captured' | 'failed' | 'pending' | 'requires_more' | 'canceled' | 'not_supported' | 'pending_authorization'`

### service.ts -- Module service interface (driving/inbound port)

```typescript
interface IPaymentModuleService {
  // PaymentCollection CRUD
  createPaymentCollections(data: CreatePaymentCollectionDTO[], context?: Context): Promise<PaymentCollectionDTO[]>
  retrievePaymentCollection(id: string, config?: FindConfig<PaymentCollectionDTO>, context?: Context): Promise<PaymentCollectionDTO>
  updatePaymentCollections(ids: string[], data: UpdatePaymentCollectionDTO, context?: Context): Promise<PaymentCollectionDTO[]>
  deletePaymentCollections(ids: string[], context?: Context): Promise<void>

  // PaymentSession lifecycle
  createPaymentSession(paymentCollectionId: string, input: CreatePaymentSessionDTO, context?: Context): Promise<PaymentSessionDTO>
  deletePaymentSession(id: string, context?: Context): Promise<void>
  authorizePaymentSession(id: string, context?: Context): Promise<AuthorizePaymentSessionResult>

  // Payment lifecycle
  capturePayment(data: CreateCaptureDTO, context?: Context): Promise<PaymentDTO>
  refundPayment(data: CreateRefundDTO, context?: Context): Promise<PaymentDTO>
  cancelPayment(paymentId: string, context?: Context): Promise<PaymentDTO>

  // Providers
  listPaymentProviders(filters?: FilterablePaymentProviderProps, config?: FindConfig<PaymentProviderDTO>, context?: Context): Promise<PaymentProviderDTO[]>

  // Webhooks
  getWebhookActionAndData(data: ProviderWebhookPayload): Promise<WebhookActionResult>

  // AccountHolder
  createAccountHolder(input: CreateAccountHolderDTO, context?: Context): Promise<AccountHolderDTO>
  deleteAccountHolder(id: string, context?: Context): Promise<void>

  // PaymentMethods (provider-managed, no DB table -- delegates to provider)
  listPaymentMethods(filters: FilterablePaymentMethodProps, config?: FindConfig<PaymentMethodDTO>, context?: Context): Promise<PaymentMethodDTO[]>
  createPaymentMethods(data: CreatePaymentMethodDTO[], context?: Context): Promise<PaymentMethodDTO[]>
  deletePaymentMethods(data: DeletePaymentMethodDTO[], context?: Context): Promise<void>
}
```

---

## 5. Services

### PaymentProviderService (`apps/backend/src/modules/payment/services/payment-provider-service.ts`)

Provider facade. Resolves provider instances from the container by `pp_${id}` key and delegates all calls.

```
Dependencies:
  - [key: `pp_${string}`]: IPaymentProvider   (injected dynamically by loader)
  - paymentProviderRepository: PaymentProviderRepository
  - logger: Logger

Methods:
  retrieveProvider(providerId: string): IPaymentProvider
  createSession(providerId, input) -> provider.initiatePayment()
  deleteSession(providerId, input) -> provider.deletePayment()
  authorizePayment(providerId, input) -> provider.authorizePayment()
  capturePayment(providerId, input) -> provider.capturePayment()
  cancelPayment(providerId, input) -> provider.cancelPayment()
  refundPayment(providerId, input) -> provider.refundPayment()
  createAccountHolder(providerId, input) -> provider.createAccountHolder?()
  deleteAccountHolder(providerId, input) -> provider.deleteAccountHolder?()
  listPaymentMethods(providerId, input) -> provider.listPaymentMethods?()
  savePaymentMethod(providerId, input) -> provider.savePaymentMethod?()
  deletePaymentMethod(providerId, input) -> provider.deletePaymentMethod?()
  getWebhookActionAndData(providerId, payload) -> provider.getWebhookActionAndData()

  // PaymentProvider table CRUD (list, upsert)
  list(filters?, config?, context?): Promise<PaymentProviderDTO[]>
  upsert(data: CreatePaymentProviderDTO[]): Promise<void>
```

### PaymentModuleService (`apps/backend/src/modules/payment/services/payment-module-service.ts`)

Main orchestration service. Implements `IPaymentModuleService`.

```
Dependencies:
  - paymentCollectionRepository
  - paymentSessionRepository
  - paymentRepository
  - captureRepository
  - refundRepository
  - refundReasonRepository
  - accountHolderRepository
  - paymentProviderService: PaymentProviderService
  - withTransaction
  - logger

Key orchestration patterns:

  createPaymentSession(collectionId, input):
    1. Create PaymentSession row (status: PENDING)
    2. Call provider.initiatePayment() with { amount, currencyCode, data: { ...input.data, sessionId }, context }
    3. Update session with provider-returned data + status
    4. On failure: delete session, delete provider session

  authorizePaymentSession(id):
    1. Retrieve session (idempotency: if session.payment exists + authorizedAt set, return existing payment)
    2. Call provider.authorizePayment() with session.data
    3. If PENDING_AUTHORIZATION: update session status, return null
    4. If AUTHORIZED or CAPTURED: update session, create Payment record
    5. If CAPTURED: also call capturePayment() to create Capture
    6. Call maybeUpdatePaymentCollection_()
    7. On failure: cancel payment at provider

  capturePayment(data):
    1. Retrieve payment with captures
    2. Validate: not canceled, calculate remaining capturable amount
    3. Create Capture row
    4. Call provider.capturePayment() with payment.data
    5. If fully captured: set payment.capturedAt
    6. Call maybeUpdatePaymentCollection_()

  refundPayment(data):
    1. Retrieve payment with captures + refunds
    2. Validate: refund amount <= (captured - already_refunded)
    3. Create Refund row
    4. Call provider.refundPayment() with { data: payment.data, amount }
    5. Update payment.data with provider response
    6. Call maybeUpdatePaymentCollection_()

  maybeUpdatePaymentCollection_(collectionId):
    1. Re-fetch collection with sessions, payments, captures, refunds
    2. authorizedAmount = sum(session.amount) where session.status === AUTHORIZED
    3. capturedAmount = sum(all capture amounts)
    4. refundedAmount = sum(all refund amounts)
    5. Derive status:
       - no sessions? -> NOT_PAID
       - sessions exist? -> AWAITING
       - authorizedAmount > 0? -> PARTIALLY_AUTHORIZED or AUTHORIZED (if >= collection.amount)
       - capturedAmount >= collection.amount? -> COMPLETED
    6. Update collection with { status, authorizedAmount, capturedAmount, refundedAmount, completedAt? }
```

---

## 6. Infrastructure Changes

### 6a. Module definition -- add loaders

Current:
```typescript
Module(key, { service, repositories })
```

New:
```typescript
Module(key, { service, repositories, loaders? })

type ModuleDefinition = {
  key: string
  service: Constructor
  repositories: Record<string, Constructor>
  loaders?: LoaderFunction[]
}

type LoaderFunction<TOptions = Record<string, unknown>> = (options: {
  container: AwilixContainer    // the module's local container
  options?: TOptions            // module options from bootstrapModule
}) => Promise<void>
```

### 6b. bootstrapModule -- accept options, run loaders

Current signature:
```typescript
bootstrapModule(sharedContainer, moduleDefinition)
```

New signature:
```typescript
bootstrapModule<TOptions = Record<string, unknown>>(sharedContainer, moduleDefinition, options?: TOptions)
```

After registering repositories and service, call each loader:
```typescript
if (moduleDefinition.loaders) {
  for (const loader of moduleDefinition.loaders) {
    await loader({ container: localContainer, options })
  }
}
```

Note: loaders run with the **local** container (has db, repos, etc.) so they can register providers + upsert into DB.

### 6c. ModuleProvider utility

New file: `apps/backend/src/core/utils/module-provider.ts`

```typescript
type ModuleProviderExports = {
  module?: string
  services: Constructor[]
}

function ModuleProvider(moduleName: string, { services }: ModuleProviderExports): ModuleProviderExports {
  return { module: moduleName, services }
}
```

### 6d. moduleProviderLoader utility

New file: `apps/backend/src/core/utils/module-provider-loader.ts`

Iterates provider configs, resolves each ModuleProviderExports, calls `registerServiceFn(klass, container, { id, options })` for each service.

### 6e. Payment module registration in container.ts

```typescript
import paymentModule from './modules/payment/index.js'
import stripeProvider from './providers/payment-stripe/index.js'

bootstrapModule(container, paymentModule, {
  providers: [{
    resolve: stripeProvider,
    id: 'default',
    options: {
      apiKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    },
  }],
})
```

### 6f. Payment loader (`apps/backend/src/modules/payment/loaders/providers.ts`)

```
1. Register SystemPaymentProvider as pp_system_default (hardcoded)
2. Call moduleProviderLoader({ container, providers: options.providers, registerServiceFn })
   - registerServiceFn: registers each provider class as pp_${identifier}_${id}
3. Upsert all provider keys into payment_provider table via PaymentProviderService
```

---

## 7. Stripe Adapter

Location: `apps/backend/src/providers/payment-stripe/`

### index.ts
```typescript
export default ModuleProvider(Modules.PAYMENT, {
  services: [StripeProviderService],
})
```

### stripe-provider.ts

Extends `AbstractPaymentProvider<StripeOptions>`.

```
static identifier = "stripe"

Constructor:
  - Receives container (cradle) + config: { apiKey, webhookSecret }
  - Initializes Stripe SDK client

initiatePayment({ amount, currencyCode, data, context }):
  - Create Stripe PaymentIntent with:
    - amount (already in cents)
    - currency: currencyCode
    - metadata: { sessionId: data.sessionId }
    - captureMethod: "manual"
  - Return { id: intent.id, data: { id: intent.id, clientSecret: intent.clientSecret } }

authorizePayment({ data }):
  - Retrieve PaymentIntent from Stripe
  - Map Stripe status -> PaymentSessionStatus
  - Return { status, data }

capturePayment({ data }):
  - stripe.paymentIntents.capture(data.id)
  - Return { data: { id: data.id } }

cancelPayment({ data }):
  - stripe.paymentIntents.cancel(data.id)
  - Return { data: { id: data.id } }

refundPayment({ amount, data }):
  - stripe.refunds.create({ payment_intent: data.id, amount })
  - Return { data: { id: data.id } }

deletePayment({ data }):
  - stripe.paymentIntents.cancel(data.id)  (same as cancel)
  - Return { data }

retrievePayment({ data }):
  - stripe.paymentIntents.retrieve(data.id)
  - Return { data: intent }

getPaymentStatus({ data }):
  - Retrieve intent, map status
  - Return { status }

getWebhookActionAndData(payload):
  - Verify signature: stripe.webhooks.constructEvent(payload.rawData, payload.headers['stripe-signature'], webhookSecret)
  - Map event type:
    - payment_intent.succeeded -> { action: 'captured', data: { sessionId, amount } }
    - payment_intent.amount_capturable_updated -> { action: 'authorized', data: { sessionId, amount } }
    - payment_intent.payment_failed -> { action: 'failed', data: { sessionId, amount } }
  - Extract sessionId from event.data.object.metadata.sessionId
  - Return { action, data }

listPaymentMethods({ context }):
  - Get accountHolderId from context.accountHolder.data.id
  - stripe.paymentMethods.list({ customer: accountHolderId })
  - Return array of { id: pm.id, data: pm }

savePaymentMethod({ context, data }):
  - Get accountHolderId from context.accountHolder.data.id
  - stripe.setupIntents.create({ customer: accountHolderId, ...data })
  - Return { id: setupIntent.id, data: setupIntent }

deletePaymentMethod({ data }):
  - stripe.paymentMethods.detach(data.id)
  - Return {}

Stripe status -> PaymentSessionStatus mapping:
  requires_payment_method (with error) -> 'error'
  requires_payment_method (no error)  -> 'pending'
  requires_action                     -> 'requires_more'
  processing (async method)           -> 'pending_authorization'
  requires_capture                    -> 'authorized'
  succeeded                          -> 'captured'
  canceled                           -> 'canceled'
```

### SystemPaymentProvider (`apps/backend/src/modules/payment/providers/system.ts`)

Always registered as `pp_system_default`. Every method returns `{ data: {} }`. `authorizePayment` always returns `{ status: 'authorized', data: {} }`. Used for mark-as-paid flows.

---

## 8. API Routes

### Store routes

| Method | Path | Handler |
|---|---|---|
| `POST` | `/store/payment-collections` | Create payment collection for a cart. Body: `{ cartId }`. Creates collection with cart's amount, links via cart_payment_collection. |
| `POST` | `/store/payment-collections/:id/payment-sessions` | Create payment session. Body: `{ providerId, data? }`. Calls `paymentModule.createPaymentSession()`. |
| `GET` | `/store/payment-providers` | List enabled payment providers (excludes system provider). |

### Admin routes

| Method | Path | Handler |
|---|---|---|
| `GET` | `/admin/payments/:id` | Retrieve payment with captures + refunds. |
| `POST` | `/admin/payments/:id/capture` | Capture payment. Body: `{ amount? }`. Calls `paymentModule.capturePayment()`. |
| `POST` | `/admin/payments/:id/refund` | Refund payment. Body: `{ amount?, refundReasonId?, note? }`. Calls `paymentModule.refundPayment()`. |
| `GET` | `/admin/payments/payment-providers` | List payment providers. |
| `POST` | `/admin/payment-collections/:id/mark-as-paid` | Mark as paid via system provider. Creates session + authorizes + captures in one step. |

### Webhook route

| Method | Path | Handler |
|---|---|---|
| `POST` | `/hooks/payment/:provider` | Receive provider webhook. Preserves raw body. |

Webhook handler (inline, no event/subscriber):
```
1. Extract provider from params
2. Build payload: { data: req.body, rawData: req.rawBody, headers: req.headers }
3. Call paymentModule.getWebhookActionAndData({ provider, payload })
4. Filter: skip NOT_SUPPORTED, CANCELED, FAILED, REQUIRES_MORE, PENDING_AUTHORIZATION
5. For AUTHORIZED: call paymentModule.authorizePaymentSession(sessionId)
6. For CAPTURED: authorize (if not yet) + capture
7. Return 200 immediately
// TODO: Move to event/subscriber pattern with configurable delay for race condition handling
```

Raw body preservation: add middleware for `/hooks/payment/:provider` that keeps the raw request body available as `req.rawBody`.

---

## 9. Link Module Addition

### Definition (`apps/backend/src/link-modules/definitions/cart-payment-collection.ts`)

New link table + relations, following existing pattern (like `product-variant-inventory-item.ts`).

### Repository (`apps/backend/src/link-modules/repositories/cart-payment-collection.ts`)

Methods:
- `findByCartId(cartId)` -> returns the linked payment collection ID
- `findByPaymentCollectionId(paymentCollectionId)` -> returns the linked cart ID
- `link(cartId, paymentCollectionId)` -> creates the link row
- `unlink(cartId, paymentCollectionId)` -> soft-deletes the link row

### Registration

Add to `LinkService` and `registerLinkService()` in `apps/backend/src/link-modules/index.ts`.

Add `CART_PAYMENT_COLLECTION: 'cartPaymentCollection'` to `Links` in `modules-definition.ts`.

---

## 10. File Structure

```
apps/backend/src/
  core/
    types/
      payment/
        common.ts          # DTOs, status types, filterable types
        mutations.ts       # Create/Update DTOs
        provider.ts        # IPaymentProvider interface, input/output types
        service.ts         # IPaymentModuleService interface
        index.ts           # re-exports
      index.ts             # add payment export
    utils/
      module.ts            # update: add loaders to ModuleDefinition
      module-provider.ts   # NEW: ModuleProvider utility
      module-provider-loader.ts  # NEW: moduleProviderLoader utility
      index.ts             # add exports
    bootstrap/
      index.ts             # update: accept options, run loaders

  modules/
    payment/
      models/
        payment-collection.ts
        payment-session.ts
        payment.ts
        capture.ts
        refund.ts
        refund-reason.ts
        payment-provider.ts
        account-holder.ts
        index.ts
      repositories/
        payment-collection.ts
        payment-session.ts
        payment.ts
        capture.ts
        refund.ts
        refund-reason.ts
        payment-provider.ts
        account-holder.ts
        index.ts
      services/
        payment-module-service.ts
        payment-provider-service.ts
        index.ts
      providers/
        system.ts           # SystemPaymentProvider
      loaders/
        providers.ts         # loadProviders loader
      index.ts               # Module(Modules.PAYMENT, { service, repositories, loaders: [loadProviders] })
      drizzle.config.ts
      migrations/

  providers/
    payment-stripe/
      index.ts               # ModuleProvider(Modules.PAYMENT, { services: [StripeProviderService] })
      stripe-provider.ts     # StripeProviderService extends AbstractPaymentProvider

  link-modules/
    definitions/
      cart-payment-collection.ts   # NEW
      index.ts                     # add export
    repositories/
      cart-payment-collection.ts   # NEW
    index.ts                       # register new repo + add to LinkService
    services/
      link-service.ts              # add cartPaymentCollection

  api/
    store/
      payment-collections/
        route.ts                   # POST
        [id]/
          payment-sessions/
            route.ts               # POST
      payment-providers/
        route.ts                   # GET
    admin/
      payments/
        [id]/
          route.ts                 # GET
          capture/
            route.ts               # POST
          refund/
            route.ts               # POST
        payment-providers/
          route.ts                 # GET
      payment-collections/
        [id]/
          mark-as-paid/
            route.ts               # POST
    hooks/
      payment/
        [provider]/
          route.ts                 # POST (webhook)

  container.ts                     # add paymentModule bootstrap with provider options
  env.ts                           # add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
```

---

## 11. Test Scenario -- End-to-End Payment Lifecycle

Without order module, validates the full payment flow:

```
1. GET  /store/payment-providers
   -> Returns [{ id: "pp_stripe_default", isEnabled: true }]
   (system provider excluded from store -- admin-only for mark-as-paid flows)

2. POST /store/payment-collections  { cartId: "cart_xxx" }
   -> Creates PaymentCollection { id: "pay_col_xxx", amount: 5000, currencyCode: "usd", status: "not_paid" }
   -> Creates cart_payment_collection link

3. POST /store/payment-collections/pay_col_xxx/payment-sessions  { providerId: "pp_stripe_default" }
   -> Creates PaymentSession { id: "payses_xxx", status: "pending", data: { id: "pi_xxx", clientSecret: "pi_xxx_secret_xxx" } }
   -> Client uses clientSecret with Stripe.js to confirm payment

4. POST /hooks/payment/pp_stripe_default  (Stripe webhook: payment_intent.amount_capturable_updated)
   -> Verifies Stripe signature
   -> Extracts sessionId from intent metadata
   -> Calls authorizePaymentSession("payses_xxx")
   -> Creates Payment { id: "pay_xxx", amount: 5000, providerId: "pp_stripe_default" }
   -> PaymentCollection status -> "authorized"

5. POST /admin/payments/pay_xxx/capture  { amount: 5000 }
   -> Creates Capture { id: "capt_xxx", amount: 5000 }
   -> Calls Stripe capture
   -> Payment.capturedAt = now()
   -> PaymentCollection status -> "completed"

6. POST /admin/payments/pay_xxx/refund  { amount: 2500, note: "Partial refund" }
   -> Creates Refund { id: "ref_xxx", amount: 2500 }
   -> Calls Stripe refund
   -> PaymentCollection.refundedAmount = 2500

7. GET  /admin/payments/pay_xxx
   -> Returns Payment with captures: [{ amount: 5000 }], refunds: [{ amount: 2500 }]
```

### Mark-as-paid flow (system provider):

```
1. POST /admin/payment-collections/pay_col_xxx/mark-as-paid
   -> Creates session with pp_system_default
   -> Auto-authorizes (system provider always returns AUTHORIZED)
   -> Creates Payment + Capture
   -> PaymentCollection status -> "completed"
```

---

## 12. Dependencies

### New npm packages needed:
- `stripe` -- Stripe Node.js SDK (for the Stripe adapter)

### Existing packages used:
- `drizzle-orm` + `drizzle-kit` -- schema + migrations
- `awilix` -- DI container
- `postgres` -- pg driver

---

## 13. Out of Scope (Deferred)

- Order module and order-related payment routes
- Cart completion workflow (completeCartWorkflow)
- Event bus / subscriber system (leave TODO in webhook handler)
- Webhook delay / race condition handling (requires event system)
- Multiple currencies (schema supports it, service hardcodes USD)
- Region <-> PaymentProvider link
- updatePaymentSession (delete + recreate instead)
- upsertPaymentCollections
- Stripe error retry with exponential backoff
- Multiple Stripe payment method variants (Ideal, Bancontact, etc.)
