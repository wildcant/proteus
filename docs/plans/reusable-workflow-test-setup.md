# Workflow Tests on the Real Stack — Refactor Plan

**Status:** 12 of 14 files converted, 612 tests passing, `npm run verify` green. The two
remaining (`cancel-order`, `create-order-fulfillment`) are blocked on a production defect the
migration uncovered — see "What the migration found" below.

Fourteen workflow test files build a fake world: an object literal per module service, a fake
`ILinkService`, an Awilix container, `setWorkflowEngine`. This plan moves them onto the real
container and real Postgres, the way `src/api` tests already run.

**An earlier revision of this plan proposed a typed `mockModules` helper to make that fake world
cheaper to build.** That was the wrong direction and is recorded here as a rejected option — the
reasoning below is the reason.

Scope: `apps/backend/src/workflows/**/__tests__` — 14 files, 80 tests. The other four files there
test pure functions and need nothing.

## Why not better mocks

**It contradicts the suite's first principle.** `.claude/skills/backend-test/REFERENCE.md`: *"Real
database, real container. Nothing about the module graph is stubbed, so a passing test means the
wiring works."* These are the only files that stub the module graph.

**The mocked tests duplicate real ones that already exist.** `src/api/store/carts/__tests__/cart.api.test.ts`
exercises `complete-cart` end to end, including a compensation path, against real modules. The
mocked `complete-cart.test.ts` covers the same workflow in a world where none of it is real.

**A mock cannot tell you whether the path it exercises is reachable.** Injecting a failure at
`addOrderTransaction` — where the mocked compensation test injects it — does not fail the real
workflow at all: `record-transactions` opens with `if (captures.length === 0) return`, and the
default `pp_system_default` provider authorizes without capturing. The mocked test reaches that
path only because it hand-builds a payment with `captures: [{...}]`. Verified by spiking it.

**Mocked assertions check that the code does what the code does.** `complete-cart`'s idempotency
guarantee is a unique index on `order_cart.cart_id`. The mocked test asserts `createMany` was
called with the links in a particular array order — a proxy. The real test asserts the guarantee:
five concurrent completions produce one order, one payment, one reserved unit. Likewise
`retrieveShippingOption` stubbed as `{ isEnabled: true }` is 1 of `ShippingOptionDTO`'s 15 fields,
and can never catch a workflow that assumed the option exists.

**Four of the seven fake link services ignore the repo name.** `repo: vi.fn().mockReturnValue(x)`
hands back the same object whatever the workflow asks for, so a workflow resolving the wrong link
repo passes.

**Nothing type-checks a stub against the interface it replaces**, and nothing resets the workflow
engine — `setWorkflowEngine` writes module-level globals that `bootstrapContainer` also writes.
Both problems disappear rather than getting fixed.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Fake modules | Rejected | See above. The redundancy against module tests is the point: it is what proves the wiring |
| Container | `await createApi()` with no definitions | Already returns a bootstrapped container and starts no server. `bootstrapContainer` already calls `setWorkflowEngine` (`src/container.ts:56`), so `workflow.run()` resolves against real modules with no extra wiring |
| Arranging state | Existing `service.create.*` factories | `createCheckoutReadyCart` was built for exactly this, with `inventory: null` / `payment: null` escape hatches |
| Failure injection | `vi.spyOn(container.resolve(Modules.X), 'method')` | Module services register as `asValue(service)` (`core/bootstrap/index.ts:38`), so the resolved object is the one the workflow gets. `cart.api.test.ts:89` already does this |
| `container.resolve` in a test file | **Installing a spy, and nothing else** | The skill already says the factories exist to keep `container.resolve` out of test files. Stubbing a method is the one thing no factory can do for you; reading or writing through the resolved service is a factory that was not written |
| Assertions | On persisted state, through the `service` fixture | `expect(await service.read.orders(container)).toHaveLength(0)` over `expect(deleteOrders).toHaveBeenCalledWith(['ord_1'])` — and never over a resolved service |
| Step runners | Keep — `step.run`, `step.runAndCompensate` | Orthogonal to mocking. Still removes three `makeTestWorkflow` copies and five throwaway failing workflows |
| Migration unit | One file at a time | A few files will want a seam that does not exist yet; those are worth deciding individually, not pre-empting with a framework |

## Proof

Two tests, real container, no stubbed modules, both green in 296ms
(`scratchpad/workflow-real-stack-spike.test.ts`):

```ts
test.beforeEach(async ({ createApi }) => {
  api = await createApi() // no definitions: container, no HTTP server
})

test('a failure after the order exists unwinds every earlier step', async ({ service, expect }) => {
  const { cart } = await service.create.checkoutReadyCart(api.container)

  const paymentService = api.container.resolve<IPaymentModuleService>(Modules.PAYMENT)
  vi.spyOn(paymentService, 'authorizePaymentSession').mockRejectedValueOnce(new Error('provider unavailable'))

  await expect(completeCartWorkflow.run({ cartId: cart.id })).rejects.toThrow('provider unavailable')

  // Every compensation asserted on the state it restored, not on the call that restored it.
  expect(await service.read.orders(api.container)).toHaveLength(0)
  expect(await service.read.linkRepo(api.container, 'orderCart').findByCartId(cart.id)).toBeNull()
  expect(await service.read.reservationItems(api.container)).toHaveLength(0)

  const reverted = await service.read.cart(api.container, cart.id)
  expect(reverted.status).toBe('active')
  expect(reverted.completedAt).toBeNull()
})
```

The last three assertions have no counterpart in the mocked version — it cannot see restored state.

`container.resolve` appears once, to install the spy. The reads go through `service.read`, which
is the rule: a spy is the only thing a factory cannot do for you. `service.read.cart` does not
exist yet — see below.

## What is actually new

Almost nothing. Three pieces:

**1. A way to create a real order.** `tests/factories/services/order.ts` is reads-only. Four files
— `cancel-order`, `create-order-fulfillment`, `create-order-shipment`, `mark-order-delivered`, 31
of the 80 tests — need an order that exists. The natural source is the one production has:
complete a checkout-ready cart.

```ts
// tests/factories/services/order.ts
/** An order in the state production leaves one in: created by completing a checkout-ready cart,
 *  so its line items, links, reservations and payment collection are all real and consistent. */
export async function createOrder(container: AwilixContainer, options?: CreateCheckoutReadyCartOptions)
```

Everything downstream (fulfilling, shipping, delivering, cancelling) then runs its own workflow
against it, which is also how those states are reached in production.

**2. Read factories for the state these tests assert on.** Compensation is asserted on restored
rows, and several of those rows have no reader today — `service.read.cart` is the first
(`tests/factories/services/cart.ts` is create-only). Each is a few lines under a `// ---- Reads ----`
heading and a line in the `service` fixture, added as the file that needs it is converted. The
alternative — resolving the module service in the test — is the thing the factory layer exists to
prevent.

**3. The step runners** (`tests/setup/run-step.ts`):

```ts
export type WorkflowStep<TInput, TOutput> = (ctx: WorkflowContext, input: TInput) => Promise<TOutput>

/** Runs one step as a single-step workflow. */
export function runStep<TInput, TOutput>(step: WorkflowStep<TInput, TOutput>, input: TInput): Promise<TOutput>

/** Runs the step, then fails the workflow so the step's compensation runs. The deliberate
 *  failure is swallowed; anything the step itself throws is rethrown. */
export function runStepAndCompensate<TInput>(step: WorkflowStep<TInput, unknown>, input: TInput): Promise<void>
```

Exposed as a `step` fixture. `rejects.toThrow('deliberate failure')` in the current tests asserts
the scaffolding, not the code, and goes away with it.

## Per-file migration

| File | Tests | Arrangement | Injection |
|---|---|---|---|
| `cart/complete-cart` | 8 | `checkoutReadyCart` — every guard test is one override (`cart: { email: null }`, `lineItem: { variantId: null }`, `payment: null`) | `authorizePaymentSession` |
| `cart/confirm-inventory-workflow` | 6 | `checkoutReadyCart` + `stockVariant` levels | none |
| `cart/update-cart` | 7 | `createCart` + real customer module | `updateCartWithAddresses` ×3 |
| `cart/transfer-cart-customer` | 3 | `createCart` + `factories.customer` | none — "customer not found" becomes a real missing id |
| `order/cancel-order` | 10 | **`createOrder`** | `cancelPayment`, `deleteReservationItems` |
| `order/create-order-fulfillment` | 10 | **`createOrder`** | `updateFulfillmentStatus` |
| `order/create-order-shipment` | 5 | **`createOrder`** + fulfil it | `updateFulfillmentStatus` |
| `order/mark-order-delivered` | 6 | **`createOrder`** + fulfil + ship | `updateFulfillmentStatus` |
| `product/set-product-options` | 6 | `createProduct`, `productOption`, `service.update.productOptions` | `createProductVariants` |
| `product/batch-variant-images` | 4 | `createProduct`, `variantImages` | `listProductVariants` |
| `product/batch-image-variants` | 3 | as above | `listProductImages` |
| `auth/set-auth-app-metadata` | 7 | real auth module; `step.run` / `step.runAndCompensate` | none |
| `notification/send-notifications` | 2 | `step.run`; assert the persisted row | none |
| `notification/notify-on-failure` | 3 | `step.runAndCompensate`; assert the persisted row | none |

Twelve injection points across 80 tests. The other 68 need none.

**As built**, the converted files came to 74 tests over 12 files. The factory layer grew by the
reads and arrangements those assertions needed:

| Added | Where |
|---|---|
| `service.create.order` / `fulfilledOrder` / `shippedOrder` | `services/order.ts` — an order via `complete-cart`, then driven through the fulfillment workflows |
| `service.create.customer`, `cartAddresses`, `authIdentity`, `inventoryLevel`, `capturedPayment`, `canceledPayment` | arrangements no factory covered |
| `service.update.cart`, `order`, `fulfillment` | direct writes for states no workflow produces — a completed cart, a canceled-but-shipped order |
| `service.read.cart`, `cartAddress`, `cartLineItems`, `carts`, `customer`, `customers`, `authIdentity`, `notifications`, `order`, `orderAddress`, `orderLineItems`, `orderShippingMethods`, `orderTransactions`, `fulfillment`, `payment`, `prices`, `productOptionsForProduct` | every assertion that used to read a mock call |

Two existing factories changed:

- `createCheckoutReadyCart` stocked exactly one unit while `generateCreateLineItemDTO` fakes a
  quantity of 1–10, so completing a default cart was a coin flip. Stock now defaults to the
  quantity the cart actually orders, which keeps the oversell property the concurrency test
  relies on.
- `generateCreateNotificationDTO` hardcoded `to: 'user@example.com'`. Faked, per the generator
  rules; two module-service tests that asserted the hardcoded value now assert the input's.

**Notification providers come from the database**, not the DI declarations
(`notification-provider-service.ts:39`), and the per-test `TRUNCATE` leaves that table empty. A
`createNotification` therefore persists with `providerId: null` and dispatches nothing — which is
exactly what these two files want. A test that needs real dispatch has to seed a provider row and
register a fake through `createApi({ register })`.

## What this costs

**Diagnosis gets noisier.** A bug in the cart module will fail cart module tests *and* every
workflow test that touches it. That is the accepted trade for the redundancy being meaningful.

**Roughly 20 assertions get rewritten** from "was called with X" to "the resulting row looks like
X". Mostly an improvement, but it is real work and some are not mechanical.

**Runtime.** Measured: mocked workflow tests average ~99ms (they already pay the per-test
`TRUNCATE`; the setup file is global), API tests ~168ms. About +70ms × 80 ≈ 5.6s of summed test
time, under a second of wall clock across seven workers. The parallelism work paid for this.

**Two rejected extras.** The earlier plan wanted `generateShippingOptionDTO` and
`generatePaymentCollectionDTO` to satisfy typed stubs. Neither is needed now — the real services
produce those objects.

## What the migration found

**Reservations are keyed to cart line items; the order workflows look them up by order line
item.** `complete-cart`'s `reserve-inventory` step writes `lineItemId` from the *cart*'s line
items (`complete-cart.ts:302`), while `cancel-order` (`cancel-order.ts:40`) and
`create-order-fulfillment` (`create-order-fulfillment.ts:138`) both query
`listReservationItems({ lineItemId })` with *order* line item ids. Probed against a real order:

```
cart line item:      cali_68a32b1f5cfd4a05b27575d88cb3d452
order line item:     ordli_673a2d95765642b5bc1656c0d5ce3dd5
reservation points → cali_68a32b1f5cfd4a05b27575d88cb3d452
```

Two consequences in production:

- **Cancelling an order never releases its stock.** The lookup returns nothing, the step
  no-ops, and the reservation is stranded — the units stay unsellable forever.
- **Fulfilling an order with managed inventory always throws.** `computeInventoryAdjustments`
  rejects a managed-inventory line with no reservation, so `create-order-fulfillment` fails
  for every tracked variant.

Both were invisible to the mocked tests, which fabricated reservations against order line item
ids. Deciding where the mapping belongs — re-keying reservations to order line items in
`reserve-inventory`, or carrying a `cartLineItemId` onto the order line item — is a design call
outside this plan's scope, so the two affected files are left on their mocked versions until it
is made. The converted-but-blocked `cancel-order` file is parked in the session scratchpad.

**One test was deleted rather than ported.** `cancel-order`'s "skips reservation deletion when
order has no line items" guarded a state no real order can reach: every order comes from a cart
with line items, and nothing deletes them afterwards. It existed because the mock could
fabricate it.

## Sequencing

1. Build `run-step.ts` and the `step` fixture. Convert `notification/*` and
   `auth/set-auth-app-metadata` (12 tests, no injection, no new arrangement) to settle the shape.
2. Convert `cart/transfer-cart-customer`, `cart/confirm-inventory-workflow`, `cart/update-cart`
   and the two `product/batch-*` files — existing factories cover all of them.
3. Add `service.create.order`. Convert the four `order/*` files.
4. Convert `cart/complete-cart` last, and reconcile it against `cart.api.test.ts` — some of its
   eight tests are already covered there and should be deleted rather than ported.
5. Fold `product/set-product-options` in wherever it lands; it is self-contained.
6. Document beside the `createApi` section in `.claude/skills/backend-test/REFERENCE.md`: workflow
   tests get a container from `createApi()` with no definitions, failure injection is a `vi.spyOn`
   on a resolved service, and that spy is the *only* thing a resolved service may be used for.

Throughout: when an assertion needs state nothing reads yet, add the read factory. A
`container.resolve` in a converted file that is not immediately followed by `vi.spyOn` is a
missing factory.
