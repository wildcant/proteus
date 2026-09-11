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
events.ts                     — the event map: names, payloads, key extractors, dispatch identity
types.ts                      — the port (EventBus) and the subscriber contract
adapter-selection.ts          — which adapter a composition root wires, derived from RUNTIME
inline-adapter.ts             — in-process adapter: looks the subscribers up and runs them here
cloudflare-queues-adapter.ts  — workerd transport: producer and queue() consumer
temporal-adapter.ts           — node transport: one standalone activity execution per delivery
temporal/                     — that transport's own pieces: queue name, dispatch activity, events Worker
registry.ts                   — event name → subscribers, from the generated import list
```

`src/core/event-bus/` and `src/core/workflows/` are peers and may not import each other, enforced by
`check:deps`. They share a vendor on node — the engine runs workflow executions, the bus runs
standalone activities — and that is exactly the coupling the rule forbids: a fix in the engine's
replay code has to be structurally incapable of changing event dispatch. What they genuinely share
lives in `src/core/temporal/`: the payload converter, the failure encoding, and the client *factory*. Each
subsystem gets its own `Client` on its own connection, and its own task queue.

The bounded-retry rule is the visible cost of that split. `createTemporalEventBus` refuses an
unbounded retry policy exactly as `createTemporalWorkflowEngine` refuses one for a step, and the four
lines that do it are written twice on purpose — a shared validator would be the import the rule
exists to forbid.

`src/notifications/` is under neither, for the same kind of reason: its builders are called by the
`order.placed` subscriber and, before it, by a checkout step, so it may not reach either tree.

## Adding an event

Add it to `EventPayloads` in `events.ts`, with a payload carrying `id` — the resource it is about.
The name and the payload are then checked at compile time, so a typo is a build failure rather than
an event nobody receives.

Add an event **because a subscriber wants it**. A catalogue of names nothing consumes is one nobody
can safely delete from. `order.placed` arrived with `src/subscribers/send-order-confirmation.ts`
and `payment.captured` with `src/subscribers/process-payment-captured.ts`; either is the shape to
copy.

Publish it from a workflow's **final step**, and derive its id from something an earlier step
already recorded. A step that retries runs its action again: an id minted inside the action is a new
one per attempt, so the dispatch identity changes, dedup has nothing to match, and the subscriber
runs twice. `order.placed` carries `order.id`, which `create-order` produced.

## Dispatch identity

Every delivery has an identity, derived by the bus as `${name}:${key}:${subscriber}` and handed to
the subscriber as `event.dispatchId`. `key` is `data.id` unless the event declares an extractor in
`EVENT_KEYS`.

**No call site supplies it**, which is the point. An earlier `emit(name, key, data)` let a hand-written
key disagree with its payload, and that defeats dedup *silently*: the publisher looks right, the
transport sees two distinct events, the subscriber runs twice.

The derived key means *once per resource*, which is correct for an order being placed and wrong for
an event that can legitimately fire twice against one thing. That is what the extractor is for, and
`payment.captured` is the first production event to need it: one session can be authorized and then
captured, so keying on the session alone would dedup the capture into the authorization and never
deliver it. A *redelivery* of either still keys identically, which is what makes a repeat of one
webhook a duplicate rather than a second capture.

## Subscribers must be idempotent

Not advice — the contract. Two transports with two delivery guarantees, and every subscriber runs
unchanged on both, so each one is written to the weaker: at-least-once, no dedup, which is what
Cloudflare Queues offers. Temporal's server-side dedup is extra safety, not permission to depend on
it. `event.dispatchId` is the key to be idempotent against.

Concurrent deliveries of one event are therefore possible on workerd in a way they are not on node.
That is exactly as exposed as processing the same work inline already is, so it is neutral rather
than a regression — but it is a fact a subscriber is written against, not one to discover.

## Publishing resolves on acceptance, not on completion

`await bus.emit(…)` means the event has been handed over, never that a subscriber finished. A
subscriber that throws is the transport's problem and never becomes the publisher's.

This is load-bearing rather than lenient. `complete-cart` publishes `order.placed` from its final
step, after the payment is authorized, so a failure that propagated back into the workflow would
compensate it and refund a valid order over a mail outage. Every adapter has to keep that true.

**`emit` never rejects — on either runtime.** Not for a subscriber failure, not for a transport
failure, and not for a delivery the adapter itself refuses to send. Every such case is logged at
error level naming the event and the subscriber, and that event is lost; the log line is its only
trace. That is the residual D8 accepts, and the fix is an outbox — adapter internals, not a port
change.

One rule for every adapter, not a property of whichever one a runtime resolves. A caller cannot know
which runtime it is on, so a guarantee that held on node and not on workerd would not be a contract.
Losing an event is recoverable by replay; refunding a paid order in front of a shopper is not.

The inline adapter does happen to wait for its subscribers — that is what makes it a seam a test can
assert through — but nothing may depend on it. On either real transport `emit` returns with the work
still to be delivered.

## Choosing an adapter

`resolveEventBusAdapterName` derives it from `RUNTIME`: workerd gets Cloudflare Queues, node gets
Temporal standalone activities. There is no `EVENT_BUS` env var and there is not meant to be — the
transport is not a per-deployment choice. A composition root states or overrides it through
`projectConfig.eventBus.adapter`.

Neither transport can be built by `bootstrapContainer` itself — one needs a workerd binding, the
other a native addon workerd cannot load — so a root that resolves one also passes
`createEventBusAdapter`. One seam for one concern: a field per transport would put a transport name
inside a runtime-agnostic type, which is the thing selection must not carry. `bootstrapContainer`
refuses to boot when the factory is missing rather than substituting something it can build.

Who states what:

| Root | Adapter | Why |
|---|---|---|
| `container.node.ts` (API) | derived → `temporal` | Nothing to say; the derived answer is the right one. |
| `container.workerd.ts` | `cloudflare-queues`, named | Derived anyway, but written out so a deploy's transport reads next to the binding that supplies it. |
| `container.worker.ts` (both Workers) | **required parameter** | Two Worker processes share one root. A default would hand one of them a choice made for the other, silently. |
| the test container | `inline` | For the reason the workflow suite pins `simple`: `RUNTIME` is `node` under vitest, and `npm test` must not need a running server. |

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
  disabled` without it; `temporal/dynamicconfig/development-sql.yaml` sets it. Because `emit` never
  rejects, a stack that missed it would drop *every* event with one log line each, and no test can
  catch that — the CLI dev server the tests boot has the flag on. So the events Worker asks the
  server at boot and refuses to start when the answer is no: `temporal/preflight.ts`, which
  describes an activity id that cannot exist and reads `UNIMPLEMENTED` as the disabled answer and
  `NOT_FOUND` as the working one.
- **Something has to poll `proteus-events`.** That is `npm run --workspace=backend worker:events`,
  and the `events-worker` service in `docker-compose.yml`. A queue nobody polls does not fail; the
  event waits, durably, until something does.

The dispatch identity becomes the `activityId`, so it inherits Temporal's `limit.maxIDLength` — 1000
by default, 255 as this repo's server is configured. The adapter checks it and drops the delivery
with an error log naming the identity, rather than letting the server answer `Failed to start
activity` with the real reason a gRPC layer down. Truncating instead would be worse than dropping:
two different events would share an id and the second would be deduped into the first, silently.

## On workerd

`src/index.workerd.ts` reads the queue binding from `cloudflare:workers` and passes it in, next to
the cron block. A binding is a live object the runtime builds from `wrangler.jsonc` and is never
serialised into one, so it cannot travel through `.env.workerd` however `nodejs_compat` is set —
`src/env.ts` has nothing to say about it. The `queue()` export is the consumer.

One message is **one delivery to one subscriber**, which is what makes a retry retry that subscriber
and nothing that travelled beside it. The consumer acks and retries per message, and opens one
database connection for the batch — the request that published the event closed its own long before
the message arrived, which is the bug the whole feature exists to fix.

`wrangler.jsonc` bounds retries and names a dead-letter queue: an email subscriber that retried
forever is a mail loop, and what still fails after that has to stay somewhere readable rather than
disappear.

`emit` does not reject here either. An oversized payload, an over-limit batch and a queue that
refuses the write all log and resolve, naming the event and every subscriber whose delivery was lost
— one `sendBatch` carries the whole fan-out, so a refusal loses all of it. The check that names the
byte count still exists; it just reports rather than throws, because a rejection in checkout's final
step refunds an authorized order and a lost event is recoverable by replay.

The bus refuses to be **built** without the `EVENTS` binding, which is the one thing that is not a
log line. The generated `Env` types it as always present because this app's `wrangler.jsonc` declares
it, and that is a claim about one config file rather than about the runtime a bundle ends up in — a
Worker without a `queues` block would otherwise build cleanly and die at the first publish.

### Exercising it locally

`npm run --workspace=backend dev:workerd` is a genuine test of this transport, not a stub of it.
Wrangler binds `EVENTS` through miniflare and delivers to the Worker's own `queue()` export, so the
whole arc runs locally: publish → message → consumer → `withConnection` → subscriber, with
`max_retries` and `proteus-events-dlq` honoured — four attempts, then a *"Moving message … to dead
letter queue"* warning.

To trigger a publish by hand, POST a signed Stripe webhook to `/hooks/payment/pp_stripe_default`.
Two things are easy to get wrong:

- **The path segment is the container key, not the vendor name** — `pp_stripe_default`, not `stripe`.
- **The intent must carry `metadata.sessionId`**, or `getWebhookActionAndData` returns
  `not_supported` and nothing is published at all.

Sign the body as `t=<unix>,v1=<hmac-sha256(STRIPE_WEBHOOK_SECRET, "<t>.<rawBody>")>`.

`.env.workerd` is untracked and plaintext — the root `.env` is dotenvx-encrypted — so it drifts from
`src/env.ts` on its own. A missing key kills the Worker at boot with `Invalid environment variables`;
diff the key lists against the root `.env` when it will not start.

## The generated registry

`src/subscribers/registry.gen.ts` is written by
`apps/backend/scripts/generate-subscriber-registry.ts`, which parses `src/subscribers/` for exported
`config` objects. It is committed, and `--check` runs in the verify gate.

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

The Cloudflare adapter is tested under node against a fake binding, the way
`core/db/__tests__/workers-provider.test.ts` covers the other half of that runtime — no workerd test
pool and no queue. What is worth protecting there is what the adapter does with a binding, not what
Cloudflare does with a message: ack and retry per message, and one connection per batch. Both are
silent when wrong, which is why they are asserted rather than read.

`src/subscribers/bus-probe.ts` is the bus's `pingWorkflow` — a subscriber whose only job is to prove
the arc works end to end. It logs its dispatch identity, which is the assertion in one string: the
event name, the key derived from the payload, and the subscriber's own name.

`send-order-confirmation` is the first production subscriber, and its tests split the same way the
adapters' do: `src/subscribers/__tests__/` covers what the handler does with one delivery, and
`src/workflows/cart/__tests__/complete-cart.test.ts` covers that checkout publishes at all — and
publishes nothing when it unwinds.

`process-payment-captured` splits the same way, one layer up: `src/subscribers/__tests__/` covers what
one delivery does, and `src/api/hooks/payment/[provider]/__tests__/payment-webhook.api.test.ts` drives
the whole arc through the real route — a signed webhook in, an order and one charge out. That file also
pins the half that is easy to lose: with the publish intercepted, the route does *nothing*.

## Subscribers, and what each one is for

| Subscriber | Event | What it does |
|---|---|---|
| `send-order-confirmation` | `order.placed` | the shopper's confirmation, off checkout's critical path |
| `process-payment-captured` | `payment.captured` | records what the provider reported, then re-runs cart completion for the cart behind the session |
| `bus-probe` | `bus.probe`, `bus.probe.repeatable` | the bus's own round trip; no production behaviour rides on it |

`process-payment-captured` is deliberately **one subscriber doing two things in sequence** rather than
two on one event. Two subscribers run concurrently, so both would call `authorizePaymentSession` for
the same session at once and the unique index on the payment's session id would make one lose — which
converges on a retry on a real transport, and is nothing at all under the in-process adapter. In
sequence there is no race to converge from. The cost is that a completion failure retries the whole
unit, re-running a capture that already succeeded; that re-run is a no-op against `capturedAt`.

## Decisions

- **ADR-0023** — this design: the port, the three adapters, the two delivery guarantees, the runtime
  split, the lost-emit residual, the standalone-activities preview risk and its fallback.
- **ADR-0024** — why grouped events were not built, and what would trigger revisiting.
