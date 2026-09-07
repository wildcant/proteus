# 23. The Event Bus Is One Port over Three Adapters, and Subscribers Are Written to the Weaker One

**Status:** Accepted

## Context

Work that was *caused* by a request ran *inside* that request, and there was no way to write it any
other way. Three symptoms, all live on `main` before this work:

1. **A shopper waited for an email nobody could see fail.** `complete-cart`'s
   `send-order-confirmation` step sent the confirmation inline, wrapped in a `try` that swallowed
   every error — and it *had* to swallow, because the payment is authorized by that point and
   throwing would compensate the workflow and refund a valid order over a mail failure. A failed send
   landed as `status = 'failure'` in the notification table and nothing ever read it again.
2. **A payment webhook that overtook checkout raced it, with the gateway as the only retry.** The
   Stripe hook was processed inline under a `TODO(events)` comment. If the process died mid-way the
   work was lost; if it threw, the only thing that retried was Stripe redelivering against a non-2xx.
3. **A shopper could be charged and get no order, deterministically.** An intent still settling maps
   to `pending_authorization`, `authorize-payment` correctly refuses, the whole checkout compensates
   — and then the webhook authorizes and captures. Nothing re-ran cart completion.

Underneath all three is one missing capability: a way to say *"this should happen because that
happened"* without also saying *"and the shopper waits for it, and if it fails nothing tries again."*

## Decision

**One port, `src/core/event-bus/`, with three adapters behind it and a subscriber contract that
never learns which one it is on.**

```ts
await bus.emit('order.placed', { id: order.id })
```

```ts
// src/subscribers/send-order-confirmation.ts — the same shape as src/jobs/
export const config: SubscriberConfig<'order.placed'> = {
  name: 'send-order-confirmation',
  event: 'order.placed',
  handler: sendOrderConfirmation,
}
```

`src/core/event-bus/` sits beside `src/core/workflows/` and mirrors its structure deliberately: a
`types.ts` holding the port, an `adapter-selection.ts` mirroring `resolveWorkflowEngineName`, and one
file per transport.

| Adapter | Runs on | Transport |
|---|---|---|
| `cloudflare-queues` | workerd | Cloudflare Queues |
| `temporal` | node | Temporal standalone activities, on `proteus-events` |
| `inline` | tests, and any root that pins it | in-process, awaited |

Selection is **derived from the runtime and overridable only at a composition root** — there is no
`EVENT_BUS` environment variable, for the reason ADR-0022 gives for `WORKFLOW_ENGINE`: workerd cannot
load `@temporalio/core-bridge` and Cloudflare Queues do not exist off workerd, so each runtime has
exactly one production answer and picking it is not something anyone should be able to get wrong from
a `.env` file.

**The third adapter is not test scaffolding.** `RUNTIME` is `node` under vitest, so a derived default
would be Temporal and every test touching an emit would need a running server. It is a production
adapter that happens to also be the test seam, exactly as `simple-adapter.ts` is to the Temporal
workflow engine, and `__tests__/bus-pin.test.ts` is what keeps a suite from silently running on a
different one.

### The publish surface, and what it refuses to be

```ts
emit<N extends EventName>(name: N, data: EventPayloads[N]): Promise<void>
```

Names and payloads are declared centrally in `events.ts`, so a typo is a build failure rather than an
event nobody receives. Every payload carries `id`, and the **dispatch identity is derived
internally** as `${name}:${key}:${subscriber}` — no call site supplies it, so no call site can get it
wrong. An earlier `emit(name, key, data)` shape let a hand-written key disagree with its payload,
which defeats dedup *silently*.

`key` is `data.id` unless the event declares an extractor in `EVENT_KEYS`. The default means *once per
resource*, which is right for an order being placed and wrong for anything that can legitimately
happen twice to one thing. `payment.captured` is the first production event to need the escape hatch:
one session can be authorized and then captured, and keying on the session alone would dedup the
capture into the authorization and never deliver it.

**`emit` resolves on acceptance and never rejects** — not for a subscriber failure, not for a
transport failure, and not for a delivery an adapter refuses to send. Every such case is logged at
error level naming the event and the subscriber, and that event is lost. This is not leniency: it is
what makes a bare `await bus.emit(...)` safe in checkout's final step, after the payment is
authorized, where a rejection would compensate the workflow and refund a valid order over a transport
blip. Losing an event is recoverable by replay; refunding a paid order in front of a shopper is not.
One rule for every adapter, not a property of whichever one a runtime resolves — a caller cannot know
which runtime it is on, so a guarantee that held on node and not on workerd would not be a contract.

### Two delivery guarantees, and why subscribers are written to the weaker

| | node (Temporal standalone activities) | workerd (Cloudflare Queues) |
|---|---|---|
| Delivery | at-least-once, **server-side dedup** on `activityId` | at-least-once, **no dedup** |
| Concurrent duplicates | collapsed into the running execution across processes | possible |
| Retry | the activity's own bounded policy | `wrangler.jsonc` `max_retries` + DLQ |
| Failure surface | a failed activity execution in the Temporal UI | a message in `proteus-events-dlq` |

The same subscriber runs unchanged on both, so **every subscriber is written to the weaker contract**:
at-least-once with no dedup. Temporal's dedup is extra safety, not permission to depend on it, and
`event.dispatchId` is the key to be idempotent against. Stated here rather than left to be discovered
in production.

That is a real behavioural difference between deployments, and it is the same shape ADR-0022 already
accepts for durability: **concurrent deliveries of one event are possible on workerd and not on node.**
For the payment webhook that is neutral rather than a regression — processing was inline before, so
two deliveries were already two concurrent requests — but "neutral" means an open race, and the
durable fix is the distributed lock `complete-cart` already records as absent in its `TODO(locking)`.
The unique index on the payment's session id is what makes the residual overlap fail loudly rather
than write a duplicate payment row.

### Transactional semantics by ordering, not by staging

**A workflow emits from its final step.** An earlier failure means the emit never runs, so a
compensated workflow publishes nothing; under Temporal a crash after an earlier step resumes and
eventually reaches it. There is no staging store and no event group — see ADR-0024 for why not.

### Accepted residual: a publish that fails is lost, and this is wider than a crash window

**A publish that the transport refuses is lost outright.** `emit` never rejects, and every adapter
honours that by catching and logging — `inline-adapter.ts`, `cloudflare-queues-adapter.ts` and
`temporal-adapter.ts` all end the same way. So a Queues outage, a Temporal frontend that is down, or
a dispatch identity the server rejects produces one error line and a `Promise<void>` that resolves,
and the event never existed.

Two consequences worth separating, because an earlier draft of this ADR described only the first:

- **Inside a transaction-bearing caller**, there is additionally the ordinary interleaving: neither
  `queue.send()` nor an activity start runs inside the Drizzle transaction, so a crash between the
  commit and the enqueue loses the event even when the transport is healthy.
- **At a route handler with no commit to be in a window after** — the payment webhook is exactly
  this — the loss is not an interleaving at all. Any transport error, no crash required, and the
  work is gone. `POST /hooks/payment/:provider` had a retry before the bus: it processed inline, so a
  failure was a non-2xx and Stripe redelivered. Publishing removed that retry for the *publish* step
  and replaced it only for the *subscriber* step. This is the one place where the bus is strictly
  worse than what it replaced, and it moves money.

**The operator signal is the log line, and nothing else.**
`[event-bus] Could not dispatch "<event>" to "<subscriber>"` at error level is the whole trace a lost
delivery leaves — no row, no dead-letter message, no failed activity, because none of those were ever
created. Any deployment of this backend has to alert on it.

The fix is an outbox table, which changes adapter internals only and leaves `emit()`'s signature
alone. It was not built here because the rule that makes it necessary is also the rule that keeps a
mail outage from refunding an authorized order — see the publish surface above — and a rejection
channel only the webhook uses would be a port change for one caller.

### Isolation from the workflow engine

`src/core/event-bus/` and `src/core/workflows/` are peers that may not import each other, enforced by
`check:deps`. They share a vendor on node — the engine runs workflow executions, the bus runs
standalone activities — and that is exactly the coupling the rule forbids: a fix in the engine's
replay code has to be *structurally* incapable of changing event dispatch.

Standalone activities are what make that real rather than aspirational: no driver, no
`advanceWorkflow`, no replay, no shape fingerprint, no `registry.gen.ts` entanglement. What the two
genuinely share lives in `src/temporal/` — `payload-converter.ts` (deliberately, because two encodings
of `BigNumber` and `Date` would diverge and appear as corrupt data rather than as an error), the
failure serializers, and `client.ts` as a *factory* producing a separate `Client` per subsystem.

The visible cost is duplication: `createTemporalEventBus` refuses an unbounded retry policy with four
lines that `createTemporalWorkflowEngine` also has. Written twice on purpose — a shared validator
would be the import the rule exists to forbid.

## Consequences

**Standalone activities are Public Preview.** Verified working on Temporal 1.31.2, and the surface used
— start, id reuse and conflict policies, retry, priority and fairness — is the stable core. They also
need `activity.enableStandalone` in dynamic config: without it a self-hosted 1.31.2 answers
`Standalone activity is disabled`, and because `emit` never rejects, a stack that missed the flag would
drop *every* event with one log line each. That is why the events Worker asks the server at boot and
refuses to start when the answer is no (`src/core/event-bus/temporal/preflight.ts`).

The fallback, if the preview surface moves, is a dedicated `dispatchEvent` workflow type: one
registered workflow type and no redesign. The isolation above holds either way.

**Something has to poll `proteus-events`.** That is `npm run --workspace=backend worker:events`, and the
`events-worker` service in `docker-compose.yml`. A queue nobody polls does not fail — the event waits,
durably, until something does — which is the right failure mode and an easy one to misread as "the
subscriber is broken".

**A subscriber that starts a workflow holds its events-worker slot until that workflow finishes**, because
`.run()` on the workflow port is blocking by design. `process-payment-captured` runs a whole
`complete-cart` this way. On node that is a durable execution; on workerd it is `complete-cart` on the
`simple` engine inside a `queue()` invocation, with 15 minutes of wall clock and no durability — the same
runtime split ADR-0022 already accepts, applied to the longest thing this feature runs.

**The dispatch identity becomes the Temporal `activityId`**, so it inherits `limit.maxIDLength` — 255 as
this repo's server is configured. The adapter checks it and drops the delivery with an error log naming
the identity rather than letting the server fail a start a gRPC layer down. Truncating would be worse
than dropping: two different events would share an id and the second would be deduped into the first,
silently.

**A new subscriber wires itself up.** `src/subscribers/registry.gen.ts` is generated from the source tree
and committed, with `--check` in the verify gate, for the three reasons the workflow registry has the same
shape: the handler closures have to exist in the process that dispatches, `tsx --watch` reloads off the
module graph, and `check:deps` cannot follow a runtime directory scan.

## References

- ADR-0024 — why grouped events were not built
- ADR-0021, ADR-0022 — the workflow engine this mirrors, and the runtime split it inherits
- `apps/backend/src/core/event-bus/readme.md` — the working guide, kept next to the code
- `apps/backend/src/core/event-bus/adapter-selection.ts` — the derivation, with the reasoning inline
- `apps/backend/deps-analyzer/.dependency-cruiser.cjs` — `event-bus-and-workflows-stay-peers`,
  `shared-temporal-stays-shared`, `no-temporal-in-workerd`
