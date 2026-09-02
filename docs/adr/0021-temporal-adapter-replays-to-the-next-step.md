# 21. The Temporal Adapter Replays a Handler to Reach Its Next Step

**Status:** Accepted

## Context

ADR-0009 built the workflow engine as a driven port and said so explicitly: *"A distributed adapter
(e.g. Temporal, Inngest) could implement the same `WorkflowEngine` interface."* This is that adapter.
The goal was durability — an execution that survives losing the process running it — with **no change
to any of the 26 workflow files** and no change to the port.

Three facts about the existing code decided the design, and all three were verified against it before
anything was written.

**Every `ctx.step` action is a closure.** Audited across 26 workflows and 72 steps: a handler body is
a sequence of `const x = await ctx.step('name', async ({ container }) => …)` with pure glue between
them, and each action captures handler-local variables. A Temporal Activity is the opposite: a
top-level function registered by name and invoked with serializable arguments. A closure cannot be
shipped to one. This is the whole problem.

**All the I/O is inside those actions.** Nothing resolves a service or touches the database between
steps. That is what makes a bridge possible at all — and it is a property of the code as it happens
to be written today, not one the type system enforces.

**Step outputs carry `Date` and `BigNumber`.** `CartDTO.createdAt` is a `Date`; `CartLineItemDTO.unitPrice`
is a `BigNumber`. Temporal's default JSON converter turns the first into a string and the second into
its `{s,e,c}` internals — silent corruption in `complete-cart`'s money path.

## Decision

**The Temporal workflow is one generic driver, and the application handler is re-entered from the top
once per step.**

```ts
// src/temporal/workflows.ts — the only code in the Temporal sandbox
const outputs = []
for (;;) {
  const result = await advanceWorkflow({ name, input, outputs, fingerprint })
  if (result.done) return result.output
  outputs.push({ value: result.output })
  fingerprint = result.fingerprint
}
```

`advanceWorkflow` is an Activity running in a normal Node Worker with the DI container. It looks the
workflow up by name in `src/temporal/registry.ts` and re-executes its handler with a replay `ctx`
whose `step()` returns the stored output for every already-completed step and executes exactly the
next one, then abandons the handler. Compensation is the same replay run backwards.

The closure never moves. The *outputs* move.

Memoization keys on **call index, not step name**, so a `ctx.step` inside a loop cannot collide with
itself.

Rejected: wrapping the whole handler in a single Activity — durable as a job queue, but a Worker that
dies restarts the checkout from step 1. Rejected: refactoring all 72 steps into registered Activities
— that is the no-refactor goal abandoned.

### Consequences, each of which cost something

**Handler bodies must be pure and synchronous between steps, and that is now enforced.** The glue
re-runs on every replay: `complete-cart`'s 14 steps cost 91 glue executions across one run. A
`Date.now()` there does not fail — it produces a different value every replay and the workflow
proceeds on it. Because the consequence is corruption rather than an error, purity is checked rather
than documented: `scripts/checks/replay-purity.ts` parses every handler and rejects `await` (other
than `ctx.step`, or a helper whose name ends in `Step` *and* which is handed `ctx`), `new Date()`,
`Date.now()`, `Math.random()`, `crypto.*`, `process.env` and `container.*` outside a `ctx.step`
callback. Being handed the context is not on its own enough to be a step: `await db.query(ctx)` is
raw I/O and is reported. It runs in `verify.sh`'s `conventions` job, and it checks itself first
against a deliberately impure fixture — a checker that has silently stopped matching produces the
same output as a clean tree.

Two things it deliberately does not do. It does not follow imports: helpers under
`src/workflows/*/utils/` are pure by convention and trusted. And it does not police step
*concurrency*, which `src/temporal/replay.ts` asserts at runtime instead, where it can see two
`ctx.step` calls actually overlap — `Promise.all` **inside** a step action is fine, and 14 workflows
do it.

**Payloads accumulate quadratically — measured, and it does not bind.** Every `advanceWorkflow` call
ships every prior step's output, so request *k* carries outputs 1..*k*-1 and the aggregate bytes over
a run grow with the square of the step count. Temporal enforces a hard 2 MiB per-message gRPC limit,
so the binding constraint is the largest single request.

`scripts/temporal/measure-payload.ts` runs real `complete-cart` executions and reads the bytes
Temporal actually encoded for each `ActivityTaskScheduled` input:

| line items | requests | largest request | total shipped | % of 2 MiB |
|---|---|---|---|---|
| 1 | 15 | 1.7 KiB | 12.6 KiB | 0.08% |
| 10 | 15 | 2.1 KiB | 14.4 KiB | 0.10% |
| 25 | 15 | 2.7 KiB | 17.6 KiB | 0.13% |
| 50 | 15 | 3.8 KiB | 22.8 KiB | 0.18% |
| 100 | 15 | 5.9 KiB | 33.4 KiB | 0.29% |

At 100 line items the per-request profile is:

```
1:133 B  2:161 B  3:164 B  4:336 B  5:339 B  6:342 B  7:380 B  8:856 B
9:1.2 KiB  10:1.2 KiB  11:5.4 KiB  12:5.4 KiB  13:5.9 KiB  14:5.9 KiB  15:5.9 KiB
```

The three jumps are the three big outputs entering the accumulator: request 9 carries the `OrderDTO`
from `create-order` (+~500 B, constant), request 11 carries `reserve-inventory`'s array of reservation
ids (+4.2 KiB at 100 items — this is the only part that scales with the cart), and request 13 carries
the `PaymentDTO` from `authorize-payment` (+~500 B, constant).

**The largest request grows by ~43 bytes per line item and would reach 2 MiB at roughly 48,000 line
items.** The risk is real in shape and does not bind in practice for `complete-cart`: the DTOs that
dominate the payload are fixed-size, and the only per-item term is a list of ids. A workflow whose
step output grows with its input would behave differently, and the measurement script exists so that
is checkable rather than guessed.

The escape hatch, if it ever binds: persist step outputs Worker-side keyed by workflow run id and
pass references instead of values. Not built — there is nothing to fix yet.

**Retries default to off, and the default is `maximumAttempts: 1`.** Temporal's own default is
infinite-with-backoff, and today's steps are not idempotent: `add-to-cart` creates line items,
`create-order-fulfillment` moves stock, `authorize-payment` charges a card. A retried step
double-executes. Retry-on-by-default is also incompatible with the parity suite — a test asserting
"this workflow fails when the database errors" would see Temporal succeed on attempt two. So the
adapter is behaviour-identical to the in-process one by default, and a step opts in once someone has
established it is safe to run twice, through `createTemporalWorkflowEngine({ retry })` rather than
through the port, which does not change. `maximumAttempts` is required and must be a finite count ≥ 1,
because Temporal reads both an absent value and `0` as *unlimited* — a policy meant to tune backoff
would otherwise opt a card authorization into retrying forever.

Two consequences of that default that are not obvious from the option name, both found while building
this and both real:

- **A Worker that dies mid-step gets no retry, opted in or not.** The retry can only be arranged
  *after* a first attempt has reported which step failed, and a lost Worker produces a
  `TimeoutFailure`, which names no step. There is no policy to look up, so the execution compensates
  instead of resuming. That is right for a half-run non-idempotent step and wrong for one declared
  safe to repeat — which is the case retry classically exists for. Changing it is a decision, not a
  patch: the driver knows the step *index* even when it cannot know the name. This is also why the
  resume guarantee below is stated for a graceful drain.
- **Backoff restarts.** The retry is a second Activity invocation whose first attempt fires
  immediately, so `{ maximumAttempts: 3, initialInterval: '30s' }` waits `[0s, 30s]` rather than the
  `[30s, 60s]` a single Temporal policy would. `startToCloseTimeout` is likewise per invocation, not
  per logical step.

**An in-flight deploy fails loudly, via a shape fingerprint.** The design relocates Temporal's
determinism problem rather than removing it: the sandboxed driver is generic and carries no
determinism burden, but the replay Activity re-executes application code. If a deploy adds, removes
or reorders a step under a running execution, the stored outputs no longer line up and the handler
would replay into the wrong step with the wrong inputs — in `complete-cart` that is charging a card
and not creating an order. The driver carries a rolling hash of the step names completed so far; on
mismatch the Activity throws non-retryably, the workflow fails, and compensations run. **Temporal
Worker Versioning / Build IDs is the real answer and is a required follow-up before any production
use** (see ADR-0022).

**Errors are rebuilt on the caller's side.** Without that, a route handler sees a `WorkflowFailedError`
wrapping an `ActivityFailure`, and `errorHandler` — which reads `AppError.type` — turns a "cart is
already completed" 409 into a 500. `AppError` and `WorkflowTerminalError` cross the wire as
`{ kind, name, message, type, code }` and are reconstructed. Anything else arrives as a plain `Error`
carrying the original name and message, so a **custom `Error` subclass does not survive as a class** —
`instanceof` on a bespoke error thrown from a step will not hold under this adapter. Anything the
adapter did not raise (a timeout, a cancellation, a connection failure) passes through untouched
rather than being dressed up as an `AppError`.

**A custom payload converter, loud on anything it does not know.** `Date` and `BigNumber` are tagged
structurally (`{__p:'date',v}`, `{__p:'bignum',v}`) rather than encoded as bare strings, because a
bare ISO string is indistinguishable from a string field — fine outbound, fatal for a round trip. The
*format* is the one `packages/http-schemas/src/common.ts` already defines (`dateToIso`,
`BigNumber.toFixed()`), and `stringToBigNumber` is reused verbatim for decoding. Anything that is
neither JSON-safe nor a registered custom type throws at serialization time with the offending path
in the message. That converts "the audit missed a type" from silent corruption into a loud failure,
which is the point.

## Evidence

- **Parity.** `npm run --workspace=backend test` (simple) and `npm run --workspace=backend test:temporal`
  run the same 71 files and the same assertions and both report **828 passed, 3 skipped**. Neither
  needs an environment variable; both pin the engine through `projectConfig.workflows.engine`.

  **How much of that number is adapter evidence.** At most 24 of the 71 files can route through the
  pinned engine — 15 workflow tests that call `.run()`, the 8 `src/api` files whose routes dispatch a
  workflow, and the engine-pin probe below. Review round 1 put the assertions that genuinely
  round-trip through Temporal at roughly 120–250 of the ~830. The rest are engine-blind rather than
  incidentally passing: `src/temporal/__tests__` and the other `src/core/workflows/__tests__` files
  build their own engines, and the module, core, framework and provider tests never reach a workflow
  at all. So the claim is "no behavioural divergence anywhere the adapter is reachable", not "828
  assertions' worth of adapter coverage". Do not restate the headline without this.

- **The run is on the engine it says it is.** `src/core/workflows/__tests__/engine-pin.test.ts` runs a
  one-step workflow and asserts *where the step body executed* — `Context.current()` resolves only
  inside a Temporal Activity — so `test:temporal` degrading into a second run of the simple suite
  fails loudly instead of passing in four minutes. It asserts whichever engine the run pins, so the
  default suite is equally protected against silently acquiring a Temporal dependency. Residual: a
  test that passes its own `config.projectConfig.workflows.engine` still gets that engine, because
  the pin is a default rather than an override.
- **Resume.** `npm run --workspace=backend temporal:crash-resume` starts `complete-cart`, stops the
  Worker after 8 steps, starts a new one, and prints from Temporal's history which OS process ran each
  step: 1–8 on the first pid, 9–14 on the second, no step twice, order created.
- **Purity.** `npm run check:workflow-purity` reports 26 workflows checked and all 7 rules still
  tripping on the fixture.

## Risks

- **The purity check cannot see through imported helpers.** Helpers under `src/workflows/*/utils/` are
  trusted by convention. A helper that started reading the clock would not be caught.
- **Glue re-execution is O(n²) in CPU as well as bytes** — 91 executions for `complete-cart`. It is
  `.map`/`.filter`/string building today, so it is microseconds against 14 task-queue round trips.
  The purity check forbids impurity, not expense; someone putting real computation between steps
  would not be caught by it.
- **The converter's provider-bag surface is only half proven.** Rich content — nested objects, arrays,
  fractional numbers, explicit `null`, unicode — was observed crossing intact through
  `FulfillmentDTO.data`. The payment path was exercised too, but every payment in those runs used
  `pp_system_default`, whose `data` bag is literally `{}`, so it proved plumbing rather than content.
  A Stripe-backed `authorize-payment` is the first real test of that surface.
- **A failed first connection poisons the engine.** `temporal-adapter.ts` caches the connection
  promise including a rejected one, so if Temporal is unreachable at first use, every later `run()`
  rejects with that same original error until the API process restarts. Pre-existing; the fix is to
  clear the handle on rejection.
- **Two adapters, two behaviours, one codebase.** A bug reproducible only on Cloudflare, or only on
  Node, is now possible. The parity suite is the mitigation, and it is why it matters more than it
  looks. See ADR-0022.

## References

- `apps/backend/src/core/workflows/readme.md` — how to write a workflow against either adapter
- `apps/backend/src/temporal/` — the driver, the replay, the Activities, the converter
- `scripts/checks/replay-purity.ts` — the purity rule and why it lives at the repo root
- ADR-0009 — the port this adapter implements
- ADR-0022 — which runtime gets which adapter, and what that costs
