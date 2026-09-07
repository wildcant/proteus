# Event Bus

"This should happen because that happened", without also saying "and the shopper waits for it, and
if it fails nothing tries again."

A publisher names an event and hands over its payload. A subscriber is a plain function in a file
shaped like a job. Nothing about the transport underneath reaches either file.

## Quick start

Publishing — anywhere that has the container: a workflow's final step, a route handler, a job.

```ts
import type { EventBus } from '@core/event-bus/types.js'
import { ContainerRegistrationKeys } from '@core/utils/index.js'

const bus = container.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)
await bus.emit('order.placed', { id: order.id })
```

Subscribing — one file in `src/subscribers/`, the same shape as `src/jobs/`:

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

Then `npm run --workspace=backend subscribers:generate` and commit `registry.gen.ts`. Nothing else
wires it up; `npm run verify` fails if you forget.

## Architecture

```
events.ts            — the event map: names, payloads, key extractors, dispatch identity
types.ts             — the port (EventBus) and the subscriber contract
adapter-selection.ts — which adapter a composition root wires, derived from RUNTIME
inline-adapter.ts    — in-process adapter: looks the subscribers up and runs them here
registry.ts          — event name → subscribers, from the generated import list
```

`src/core/event-bus/` and `src/core/workflows/` are peers and may not import each other, enforced by
`check:deps`. They will share a vendor on node — the engine runs workflow executions, the bus will
run standalone activities — and that is exactly the coupling the rule forbids: a fix in the engine's
replay code has to be structurally incapable of changing event dispatch. What they genuinely share
lives in `src/temporal/`.

`src/notifications/` is under neither, for the same kind of reason: its builders are called by a
checkout step today and by an `order.placed` subscriber next, so it may not reach either tree.

## Adding an event

Add it to `EventPayloads` in `events.ts`, with a payload carrying `id` — the resource it is about.
The name and the payload are then checked at compile time, so a typo is a build failure rather than
an event nobody receives.

Add an event **because a subscriber wants it**. A catalogue of names nothing consumes is one nobody
can safely delete from.

## Dispatch identity

Every delivery has an identity, derived by the bus as `${name}:${key}:${subscriber}` and handed to
the subscriber as `event.dispatchId`. `key` is `data.id` unless the event declares an extractor in
`EVENT_KEYS`.

**No call site supplies it**, which is the point. An earlier `emit(name, key, data)` let a hand-written
key disagree with its payload, and that defeats dedup *silently*: the publisher looks right, the
transport sees two distinct events, the subscriber runs twice.

The derived key means *once per resource*, which is correct for an order being placed and wrong for
an event that can legitimately fire twice against one thing. That is what the extractor is for, and
why one exists before the event that needs it does.

## Subscribers must be idempotent

Not advice — the contract. Two transports are coming with two delivery guarantees, and every
subscriber runs unchanged on both, so each one is written to the weaker: at-least-once, no dedup.
`event.dispatchId` is the key to be idempotent against.

## Publishing resolves on acceptance, not on completion

`await bus.emit(…)` means the event has been handed over, never that a subscriber finished. A
subscriber that throws is the transport's problem and never becomes the publisher's.

This is load-bearing rather than lenient. The order confirmation is sent after the payment is
authorized, so a failure that propagated back into the checkout workflow would compensate it and
refund a valid order over a mail outage. Every adapter has to keep that true.

The inline adapter does happen to wait for its subscribers — that is what makes it a seam a test can
assert through — but nothing may depend on it. On either real transport `emit` returns with the work
still to be delivered.

## Choosing an adapter

`resolveEventBusAdapterName` derives it from `RUNTIME`: workerd gets Cloudflare Queues, node gets
Temporal standalone activities. There is no `EVENT_BUS` env var and there is not meant to be — the
transport is not a per-deployment choice. A composition root pins the other one through
`projectConfig.eventBus.adapter`, and the test container pins `inline` for the reason the workflow
suite pins `simple`: `RUNTIME` is `node` under vitest, and `npm test` must not need a running server.

**Today every composition root pins `inline`, because the two transports do not exist yet** — they
are one adapter file each, and until then `bootstrapContainer` refuses to boot rather than
substituting something. Nothing publishes in production yet either, so the pin has nothing to
change.

## The generated registry

`src/subscribers/registry.gen.ts` is written by `scripts/generate-subscriber-registry.ts`, which
parses `src/subscribers/` for exported `config` objects. It is committed, and `--check` runs in the
verify gate.

Static imports, not a directory scan, for the three reasons the workflow registry has the same
shape: the handler closures have to exist in the process that dispatches, `tsx --watch` reloads off
the module graph, and `check:deps` cannot follow a scan. A committed artifact is also identical in
every environment, which a directory is not.

Every file in `src/subscribers/` is a subscriber. A helper module there is rejected by the generator
rather than skipped — a file that looks registered and never runs is the failure the generator
exists to remove.

## Testing

The in-process adapter is a production adapter that happens to be the test seam, exactly as
`simple-adapter.ts` is to the Temporal workflow engine. It is not a mock, and
`__tests__/bus-pin.test.ts` is what keeps that honest: it asserts *where the subscriber ran*, because
a suite silently publishing into a transport would pass every assertion about publishing.

There is deliberately **no parity suite** mirroring `test:temporal`. Only a handful of tests exercise
the bus, so the cost/benefit inverts: each transport's own behaviour is covered directly, against a
real server, where the assertions can be about dedup and retry rather than about the same business
outcome twice.

`src/subscribers/bus-probe.ts` is the bus's `pingWorkflow` — a subscriber whose only job is to prove
the arc works end to end. It logs its dispatch identity, which is the assertion in one string: the
event name, the key derived from the payload, and the subscriber's own name.
