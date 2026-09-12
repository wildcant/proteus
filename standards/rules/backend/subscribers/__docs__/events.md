# Events

Adding a name to the event map, and publishing it from the right place. Handling one is
[subscribers](./subscribers.md) — the two are separate sittings, because adding a subscriber to an
event that already exists is the common case and never touches `events.ts`.

The transports underneath, their delivery guarantees and which runtime resolves which are mechanism,
and live in
[`src/framework/event-bus/README.md`](../../../../../apps/backend/src/framework/event-bus/README.md).

## Structure

```
src/core/event-bus/events.ts   — EventPayloads: the name, its payload, its key extractor
src/workflows/<domain>/…       — the final step that publishes it
```

## Shape

```ts
// events.ts
export type EventPayloads = {
  'order.placed': { id: string }
  // …
}
```

```ts
// publishing — anywhere that has the container: a workflow's final step, a route handler, a job
import type { EventBus } from '@core/event-bus/types.js'
import { ContainerRegistrationKeys } from '@core/utils/index.js'

const bus = container.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)
await bus.emit('order.placed', { id: order.id })
```

## Rules

### The payload carries `id` — the resource it is about

Add the name to `EventPayloads` in `events.ts` with a payload holding `id`. Both are then checked at
compile time, so a typo is a build failure rather than an event nobody receives.

`id` is load-bearing rather than conventional: the bus derives each delivery's identity from it, so a
payload without one has nothing for dedup to key on. An event that can legitimately fire twice
against the same resource declares an extractor in `EVENT_KEYS` instead —
[dispatch identity](../../../../../apps/backend/src/framework/event-bus/README.md#dispatch-identity)
explains what that changes.

### Add an event because a subscriber wants it

A catalogue of names nothing consumes is one nobody can safely delete from. `order.placed` arrived
with `src/subscribers/send-order-confirmation.ts` and `payment.captured` with
`src/subscribers/process-payment-captured.ts`; either is the shape to copy. Write the subscriber in
the same change as the event.

### Publish from a workflow's final step

And derive the payload's `id` from something an earlier step already recorded. A step that retries
runs its action again: an id minted inside the action is a new one per attempt, so the dispatch
identity changes, dedup has nothing to match, and the subscriber runs twice. `order.placed` carries
`order.id`, which `create-order` produced.

Final, not merely late. `complete-cart` publishes after the payment is authorized, and the ordering
is what makes the publish safe — an emit added halfway through a workflow can be followed by a step
that fails and compensates, and the event has already gone.

### A publish never fails the publisher

`await bus.emit(…)` means the event has been handed over, never that a subscriber finished, and
`emit` never rejects on either runtime. So there is nothing to guard, nothing to `catch`, and no
branch to write for the failure case.

This is load-bearing rather than lenient: `complete-cart` publishes from its final step after the
payment is authorized, so a failure that propagated back into the workflow would compensate it and
refund a valid order over a mail outage. Losing an event is recoverable by replay; refunding a paid
order in front of a shopper is not. What that costs — a lost delivery leaves a log line and nothing
else — is the residual recorded in
[`README.md`](../../../../../apps/backend/src/framework/event-bus/README.md#publishing-resolves-on-acceptance-not-on-completion)
and in ADR-0023.

## Enforcement

**No rule checks any of this** — `standards/rules/backend/subscribers/` is empty. The type of
`EventPayloads` catches a misspelt name and a malformed payload, and
`src/core/event-bus/__tests__/subscriber-contract.test.ts` pins that with `@ts-expect-error` so it
fails visibly if it ever stops being true; everything else here is a convention.
`standards/README.md` covers what happens when one hardens.

## What is deliberately not enforced

- **That the emit is in the *final* step.** The ordering guarantee only holds while it is, and an
  emit added halfway through quietly gives it up. ADR-0024 records this as convention rather than
  rule; the `complete-cart` test asserting that a compensated checkout publishes nothing is what
  would notice.
- **That the `id` came from an earlier step.** An id minted inside the retrying action and one read
  off a previous step's return value are the same expression to any pattern; the difference is where
  the value was produced, which is a data-flow question across step boundaries.
- **That an event has a subscriber.** The registry is generated from `src/subscribers/`, so an
  orphaned name in `EventPayloads` is a cross-file reachability question rather than a shape. It
  costs nothing at runtime and everything at deletion time, which is why it is written down here.

## Relationship with subscribers

An event exists because something handles it. Writing that handler — and the idempotency it owes the
weaker transport — is [subscribers](./subscribers.md).
