# Subscribers

"This should happen because that happened", without also saying "and the shopper waits for it, and if
it fails nothing tries again." A subscriber is a plain function in a file shaped like a job, and
nothing about the transport underneath reaches it.

Adding the event it handles is [events](./events.md). The transports themselves — what each one
guarantees, how a delivery is deduped, which runtime resolves which — are mechanism, and live in
[`src/framework/event-bus/README.md`](../../../../../apps/backend/src/framework/event-bus/README.md).

## Structure

```
src/subscribers/
  <name>.ts            — one subscriber per file; every file here is a subscriber
  registry.gen.ts      — generated, committed, checked by the verify gate
  __tests__/           — what one delivery does
```

## Shape

```ts
type OrderEvent = 'order.placed' | 'order.canceled'

async function orderNotifier({ event, container }: SubscriberArgs<OrderEvent>) {
  const { id } = event.data
  // …
}

export const config: SubscriberConfig<OrderEvent> = {
  name: 'order-notifier',
  event: ['order.placed', 'order.canceled'],
  handler: orderNotifier,
}
```

## Rules

### Every file in `src/subscribers/` is a subscriber

A named function plus an exported `config`, the same shape as a job in `src/jobs/`. A helper module
placed here is **rejected by the generator** rather than skipped — a file that looks registered and
never runs is the failure the generator exists to remove. A helper a subscriber needs lives where its
subject does: a pure one in the module's `utils/`, anything calling a service behind that module's
service.

`config.name` is required, and it is the dedup key — it is not derived from the filename. Two
subscribers may not share one.

### The type argument on `SubscriberConfig` is load-bearing

`SubscriberConfig<'order.placed'>` narrows `event.data` to that event's payload. Leaving it off would
widen the union to every event in the map, so the handler would stop type-checking against the
payloads it actually receives instead of failing to compile — the worse of the two failures, because
it looks like it works. Which is why `TEvent` is declared with **no default**: omitting it is
`TS2314`, an error you are told about at the declaration.

### Regenerate the registry and commit it

```bash
pnpm --filter backend run subscribers:generate
```

Nothing else wires a subscriber up, and `pnpm run verify` fails if you forget: `registry.gen.ts` is
committed and the generator's `--check` runs in the `generated` gate. Static imports rather than a
directory scan, for reasons that are
[the registry's](../../../../../apps/backend/src/framework/event-bus/README.md#the-generated-registry).

### Every subscriber is idempotent

Not advice — the contract. Two transports with two delivery guarantees, and every subscriber runs
unchanged on both, so each one is written to the weaker: at-least-once, no dedup. Temporal's
server-side dedup is extra safety, not permission to depend on it.

`event.dispatchId` is the key to be idempotent against. Concurrent deliveries of one event are
possible on workerd in a way they are not on node — as exposed as processing the same work inline
already is, so neutral rather than a regression, but a fact a subscriber is written against rather
than one to discover.

### Throwing is how you ask for a retry

A subscriber's failure is the transport's problem and never becomes the publisher's; `emit` has
already resolved. So do not swallow an error to keep the delivery "clean" — an unhandled throw is the
only way to get the work tried again, and on both transports it is the *bounded* retry
`wrangler.jsonc` and the activity's retry policy define.

### A subscriber imports no transport vocabulary

No `@temporalio/*`, no `cloudflare:workers`, no queue types. The whole point of the port is that the
same file runs on both runtimes, and a transport import is what makes one of them stop being true. A
subscriber may reach both `src/core/event-bus/` and `src/core/workflows/`, which those two may not do
to each other.

### Tests split by what they cover

One file under `src/subscribers/__tests__/` covering what the handler does with **one delivery**, and
an existing test on the publisher's side covering that it publishes at all. `send-order-confirmation`
is the reference: its own test takes one delivery, and
`src/workflows/cart/__tests__/complete-cart.test.ts` asserts that checkout publishes — and publishes
nothing when it unwinds.

`process-payment-captured` splits the same way one layer up:
`src/api/hooks/payment/[provider]/__tests__/payment-webhook.api.test.ts` drives the whole arc through
the real route — a signed webhook in, an order and one charge out — and also pins the half that is
easy to lose: with the publish intercepted, the route does *nothing*.

The suite runs on the in-process adapter, which is a production adapter that happens to be the test
seam rather than a mock. `__tests__/bus-pin.test.ts` is what keeps that honest, asserting *where* the
subscriber ran: a suite silently publishing into a real transport would pass every assertion about
publishing.

## Enforcement

| Rule id | The paragraph it enforces |
|---|---|
| `subscribers-name-no-transport` | that a subscriber imports no transport vocabulary |

That one is a dependency-cruiser rule in `apps/backend/structure/.dependency-cruiser.cjs`, run by the
`structure` gate; `standards/rules/backend/subscribers/` holds none, and this directory exists
because the use cases do rather than because the rules did.

Two more claims above are held by the type system rather than by a rule, which is why no rule repeats
them. `SubscriberConfig<TEvent>` declares `TEvent` with **no default**, so omitting the type argument
is `TS2314` rather than a widened union; and `name` is a required field, so leaving it out is
`TS2741`. Both fail the `typecheck` gate at the declaration, and
`src/core/event-bus/__tests__/subscriber-contract.test.ts` pins the first with a `@ts-expect-error`
so it fails visibly if the type ever gains a default. The generator holds the third: it refuses a
non-subscriber file, and `--check` fails a stale registry, both in the `generated` gate.

`standards/README.md` covers how each kind of rule runs and how to suppress one.

## What is deliberately not enforced

- **Idempotency itself.** The contract above is a claim about what a handler *does* with a repeated
  delivery, and the compliant shape varies with what it writes — an upsert, a `capturedAt` guard, a
  unique index it lets fail. There is nothing to match on, and this is the reason it is stated as
  plainly as it is.
- **That `event.dispatchId` is read.** It is the key to be idempotent against, not the only one: a
  handler whose write is naturally idempotent never mentions it. A rule demanding the identifier would
  push people to reference it and ignore it.
- **That two subscribers on one event do not race.** `process-payment-captured` is deliberately one
  subscriber doing two things in sequence rather than two on one event: two would run concurrently,
  both calling `authorizePaymentSession` for the same session, and the unique index on the payment's
  session id would make one lose — converging on a retry on a real transport, and nothing at all under
  the in-process adapter. Whether two handlers of one event contend is a question about what they
  write, not about how they are declared.

## Examples

| Subscriber | Event | What it does |
|---|---|---|
| `send-order-confirmation` | `order.placed` | the shopper's confirmation, off checkout's critical path |
| `process-payment-captured` | `payment.captured` | records what the provider reported, then re-runs cart completion for the cart behind the session |
| `bus-probe` | `bus.probe`, `bus.probe.repeatable` | the bus's own round trip; no production behaviour rides on it |

`bus-probe` is the bus's `pingWorkflow` — a subscriber whose only job is to prove the arc works end
to end. It logs its dispatch identity, which is the assertion in one string: the event name, the key
derived from the payload, and the subscriber's own name.

## Relationship with events

A subscriber is why an event exists, and both are usually written in the same change. Adding the name
and choosing where it is published from is [events](./events.md).
