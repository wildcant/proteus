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
temporal-adapter.ts  — node transport: one standalone activity execution per delivery
temporal/            — that transport's own pieces: queue name, dispatch activity, events Worker
registry.ts          — event name → subscribers, from the generated import list
```

`src/core/event-bus/` and `src/core/workflows/` are peers and may not import each other, enforced by
`check:deps`. They share a vendor on node — the engine runs workflow executions, the bus runs
standalone activities — and that is exactly the coupling the rule forbids: a fix in the engine's
replay code has to be structurally incapable of changing event dispatch. What they genuinely share
lives in `src/temporal/`: the payload converter, the failure encoding, and the client *factory*. Each
subsystem gets its own `Client` on its own connection, and its own task queue.

The bounded-retry rule is the visible cost of that split. `createTemporalEventBus` refuses an
unbounded retry policy exactly as `createTemporalWorkflowEngine` refuses one for a step, and the four
lines that do it are written twice on purpose — a shared validator would be the import the rule
exists to forbid.

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

Not advice — the contract. Two transports with two delivery guarantees, and every subscriber runs
unchanged on both, so each one is written to the weaker: at-least-once, no dedup. Temporal's
server-side dedup is extra safety, not permission to depend on it. `event.dispatchId` is the key to
be idempotent against.

## Publishing resolves on acceptance, not on completion

`await bus.emit(…)` means the event has been handed over, never that a subscriber finished. A
subscriber that throws is the transport's problem and never becomes the publisher's.

This is load-bearing rather than lenient. The order confirmation is sent after the payment is
authorized, so a failure that propagated back into the checkout workflow would compensate it and
refund a valid order over a mail outage. Every adapter has to keep that true.

**Nor does a transport failure reach the publisher.** An adapter that cannot reach its transport, or
cannot derive a sendable identity for the delivery, logs it and resolves. The argument above does not
weaken when the failure moves from the subscriber to the wire. The cost is real and stated rather
than hidden: such an event is lost, with a log line as its only trace. Closing that window means an
outbox table, which is adapter internals rather than a port change.

The inline adapter does happen to wait for its subscribers — that is what makes it a seam a test can
assert through — but nothing may depend on it. On either real transport `emit` returns with the work
still to be delivered.

## Choosing an adapter

`resolveEventBusAdapterName` derives it from `RUNTIME`: workerd gets Cloudflare Queues, node gets
Temporal standalone activities. There is no `EVENT_BUS` env var and there is not meant to be — the
transport is not a per-deployment choice. A composition root pins another one through
`projectConfig.eventBus.adapter`, and the test container pins `inline` for the reason the workflow
suite pins `simple`: `RUNTIME` is `node` under vitest, and `npm test` must not need a running server.

The node roots — the API and both Workers — take the derived answer. workerd still pins `inline`,
because Cloudflare Queues is ILLO-88 and `bootstrapContainer` refuses to boot rather than
substituting something for a transport it cannot build.

## The node transport

One **standalone activity execution** per (event, subscriber) pair, on `proteus-events`. Not a
workflow execution: a workflow's unit is a replayable history, which is a great deal of machinery for
"run this function, retry it if it fails" — and avoiding it is what makes the peer split structural
rather than aspirational, because no driver, replay or shape fingerprint is involved.

| What | How |
|---|---|
| Dedup | `activityId` is the dispatch identity, with `ALLOW_DUPLICATE_FAILED_ONLY` + `USE_EXISTING`. Server-side, across processes, no idempotency-key table. |
| Retry | The activity's own policy, bounded. Refused at construction if it is not. |
| Fairness | `fairnessKey` is the event name, so a flood of one event cannot starve an order-critical one. This is what lets one queue serve every event. |
| Priority | `priorityKey` per event; 1 is highest, 5 the server's default lowest, 3 the default. |
| Failures | Queryable, replayable activity executions in the Temporal UI. |

Two operational requirements, both easy to miss:

- **`activity.enableStandalone` must be on.** Self-hosted 1.31.2 answers `Standalone activity is
  disabled` without it; `temporal/dynamicconfig/development-sql.yaml` sets it. The Temporal CLI dev
  server the tests boot defaults it on, so tests alone would not catch a stack that missed it.
- **Something has to poll `proteus-events`.** That is `npm run --workspace=backend worker:events`,
  and the `events-worker` service in `docker-compose.yml`. A queue nobody polls does not fail; the
  event waits, durably, until something does.

The dispatch identity becomes the `activityId`, so it inherits Temporal's `limit.maxIDLength` — 1000
by default, 255 as this repo's server is configured. The adapter checks it and drops the delivery
with an error log naming the identity, rather than letting the server answer `Failed to start
activity` with the real reason a gRPC layer down. Truncating instead would be worse than dropping:
two different events would share an id and the second would be deduped into the first, silently.

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
outcome twice. `__tests__/temporal-adapter.server.test.ts` is that suite, run by
`npm run --workspace=backend test:temporal:server` — dedup, the retry budget and the recorded
priority are all the *server's* behaviour, so a double would only be asserting the test's own
arithmetic. It boots a full Temporal from the CLI rather than the time-skipping server the workflow
engine's tests use, because standalone activities are not part of what that implementation supports.

`__tests__/temporal-adapter.test.ts` is the half a server cannot show: what the adapter refuses to be
built with, and what it does when a start fails.

`src/subscribers/bus-probe.ts` is the bus's `pingWorkflow` — a subscriber whose only job is to prove
the arc works end to end. It logs its dispatch identity, which is the assertion in one string: the
event name, the key derived from the payload, and the subscriber's own name.
