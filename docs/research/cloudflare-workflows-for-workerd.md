# Cloudflare Workflows as a Durable Engine for the workerd Runtime

Research findings on whether [Cloudflare Workflows](https://developers.cloudflare.com/workflows/) can
be added as a **third `WorkflowEngine` adapter**, used only on workerd — closing the limitation
ADR-0022 accepted, that a Cloudflare deployment of this backend has no durable execution. Temporal
stays on node; `simple` stays for tests and in-process nesting.

**Date:** 2026-09-12
**Verification method:** a throwaway Worker was built at
`.scratch/cloudflare-workflows/prototype/` and driven against `wrangler dev` (wrangler 4.131.1,
workerd 1.20260911.1). Every claim tagged **MEASURED** is a run against that Worker, not an inference.
Claims tagged **DOCS** are cited to `developers.cloudflare.com` or Cloudflare's published OpenAPI
schema. Claims tagged **UNVERIFIED** were established by neither and are listed again in §13.
Codebase counts were taken by grep over `apps/backend/src` on the date above.
**One-line answer:** it does not fit as-is — one blocker (`BigNumber` step outputs raise
`DataCloneError` and kill the instance), one unavoidable change to `core/workflows/types.ts` (the
module-global engine cannot serve both the fetch handler and the workflow entrypoint, which share an
isolate), and a refactor to move two Temporal-shaped files out from behind `no-temporal-in-workerd`.
Everything else fits, and in several respects fits better than Temporal does.

---

## Table of contents

1. [The question, and what a passing answer looks like](#1-the-question-and-what-a-passing-answer-looks-like)
2. [How the platform maps onto the port](#2-how-the-platform-maps-onto-the-port)
3. [Serialization: three boundaries, three formats](#3-serialization-three-boundaries-three-formats)
4. [The blocker: `BigNumber` kills the instance](#4-the-blocker-bignumber-kills-the-instance)
5. [The error contract collapses to 500](#5-the-error-contract-collapses-to-500)
6. [One isolate, one `globalEngine`, two roles](#6-one-isolate-one-globalengine-two-roles)
7. [`run()` cannot block, and nothing pushes](#7-run-cannot-block-and-nothing-pushes)
8. [Retries: the naming invites a 310-second mistake](#8-retries-the-naming-invites-a-310-second-mistake)
9. [Connections, AsyncLocalStorage, and per-step scope](#9-connections-asynclocalstorage-and-per-step-scope)
10. [Triggering contexts, nesting, limits, versioning](#10-triggering-contexts-nesting-limits-versioning)
11. [Latency, measured locally](#11-latency-measured-locally)
12. [What fits as-is](#12-what-fits-as-is)
13. [Verdict, sequence, and where the evidence is thin](#13-verdict-sequence-and-where-the-evidence-is-thin)

---

## 1. The question, and what a passing answer looks like

ADR-0022 derives the engine from the runtime and records the consequence plainly: workerd gets
`simple`, so a `complete-cart` interrupted between `authorize-payment` and `record-transactions` is
lost. The reason was structural — Temporal's TypeScript Worker needs `@temporalio/core-bridge`, a
native addon workerd cannot load — and no adapter design changes it. Cloudflare Workflows is the first
durable execution engine that runs *inside* workerd, so it is the first thing that could change the
answer.

A passing answer has to satisfy four constraints that are not negotiable:

1. **`WorkflowEngine.run<TInput, TOutput>()` returns `Promise<TOutput>`.** 32 route handlers in
   `src/api/` await it and put the result in the response body; one subscriber and two workflows
   dispatch it too. Total: 35 dispatch sites, 98 `ctx.step` call sites across 30 workflows.
2. **`src/workflows/` must not learn which engine it is on.** ADR-0021's rule: zero imports from any
   adapter directory, today and after.
3. **The failure contract has to survive.** `WorkflowConfig.throws` is spread into each route's own
   `throws` and reaches the OpenAPI document; `errorHandler` maps an `AppError.type` to a status code.
4. **Whatever is claimed has to be checkable.** ADR-0021 and ADR-0022 rest their case on a parity
   suite, not on adapter unit tests.

## 2. How the platform maps onto the port

The mapping is unusually close, and the four things that make the Temporal adapter hard do not exist
here.

| This codebase | Cloudflare Workflows |
| --- | --- |
| `ctx.step(name, action)` | `step.do(name, config, callback)` — **the callback is a closure that runs in-process** |
| `ctx.step(name, action, compensation)` | `step.do(…, { rollback, rollbackConfig })` |
| `WorkflowTerminalError` | `NonRetryableError` — but see §5 |
| `WorkflowConfig.idempotent` → default policy | per-step `retries: { limit, delay, backoff }` |
| `StepContext { container }` | `this.env` on the entrypoint → `createWorkerdContainer` |
| replay purity (`check:workflow-purity`) | identical requirement — glue outside `step.do` re-runs |

**No closure/process boundary.** Temporal forced the generic `advanceWorkflow` driver and
`framework/workflows/temporal/replay.ts`, because a step action is a closure and an Activity is a
name-registered function. Cloudflare re-runs `run()` in the same isolate with completed steps
memoized, which is what `replay.ts` hand-rolls. **No O(n²) accumulated payload** — results are
persisted per step (1 MiB each), so ADR-0021's payload arithmetic and `measure:workflow-payload` stop
applying. **No shape fingerprint** — though §10 shows what replaces it is worse. **No
abandoned-handler divergence** — errors genuinely reject into `run()`, so `try`/`catch`/`finally`
around a step behaves as it does under `simple`.

## 3. Serialization: three boundaries, three formats

**MEASURED.** The prototype's `/serial` route round-trips one probe object through two `step.do` calls
and back out via `status().output`.

| value | `create({params})` in | across `step.do` | via `status().output` out |
| --- | --- | --- | --- |
| `Date` | preserved (**but see below**) | preserved | ISO **string** |
| `Map`, `Set`, `RegExp`, `Error` | — | preserved | `{}` — contents gone |
| `undefined` property | preserved | preserved | **key dropped** |
| `NaN`, `Infinity` | — | preserved | `null` |
| plain objects, arrays, `null`, floats, `-0` | preserved | preserved | preserved |
| **class instance** | — | **`DataCloneError` — instance dies** | — |
| **`BigInt`** | — | **`TypeError` — instance dies** | — |

So step-to-step is structured clone and the status API is JSON. Two consequences beyond §4.

**The port's output type becomes a lie at the far boundary.** `run()` promises `TOutput`; what returns
through `status().output` has had every `Date` turned into a string. The repo's convention is
`timestamptz` → Drizzle `Date` → DTO `Date` → ISO at the HTTP edge, so the *response body* is
unchanged — but anything touching a date between the workflow returning and the response serializing
gets a string where the type says `Date`.

**The `params` row disagrees with the documentation, and the documentation is more likely right.**
**DOCS:** `params` is "JSON-serializable", and the REST schema calls it "a JSON parsable string".
**MEASURED:** locally a `Date` arrives inside the instance as a real `Date`, nested ones included.
That is exactly the divergence Miniflare is prone to — in-process handoff where production has to put
bytes on a wire. Treat the local result as unreliable; it must be re-run against a deployment.

**There is no payload-converter hook.** **DOCS:** nothing in the API corresponds to Temporal's custom
data converter or codec. The only serialization controls are `retention`, the 1 MiB cap, and a
`ReadableStream<Uint8Array>` return type for large binary output.

## 4. The blocker: `BigNumber` kills the instance

**MEASURED**, against the real `bignumber.js` class, not a stand-in:

```
DataCloneError: Could not serialize object of type "BigNumber". This type does not support serialization.
```

Nested in a plain object and inside an array give the same result. A `toJSON()` method does **not**
rescue it: structured clone ignores `toJSON`. Null-prototype objects fail the same way. The failure is
loud and fatal rather than silent corruption, which is the one mercy here.

`src/framework/temporal/payload-converter.ts` exists for precisely this reason, and says so in its own
doc block: *"`CartDTO.createdAt` is a `Date`, `CartLineItemDTO.unitPrice` is a `BigNumber` … In
`complete-cart` that lands in the money path, which is why this converter exists."* There are 28
`BigNumber` fields across the `cart`, `order`, `payment`, `pricing` and link DTOs.

The blast radius is not a long tail — it is the money path:

| Site | What it returns |
| --- | --- |
| `complete-cart.ts:192` | `amount: BigNumber` — **step 3 of 14; checkout dies here** |
| `complete-cart.ts:521` | a `PaymentDTO` with four `BigNumber` fields |
| `add-to-cart.ts:81`, `:157` | line-item plans carrying `unitPrice: BigNumber` |
| `update-cart.ts:403`, `:497` | `PreviousLineItemPrice[]`, `PreviousPaymentCollection` |
| `create-payment-collection-for-cart.ts:19` | a `PaymentCollectionDTO` |

So `complete-cart`, `add-to-cart`, `update-cart` and `create-payment-collection-for-cart` all fail
outright — including the two highest-traffic store routes.

**The fix is real but it is not free.** The adapter owns the `ctx.step` implementation, so it can wrap:
`decode(await step.do(name, async () => encode(await action(ctx))))`. That is a payload converter, and
one already exists. But `encodeValue`/`decodeValue` are module-private, and the file lives under
`src/framework/temporal/`, which `structure/.dependency-cruiser.cjs`'s `no-temporal-in-workerd`
forbids `src/index.workerd.ts` from reaching through any path. Reuse therefore requires extracting the
tag-and-walk logic into a runtime-neutral home under `core/`.

One simplification: because `Date` survives structured clone natively (§3), only the `BigNumber` branch
is needed — but the **walk** still is, since a `BigNumber` can sit anywhere in the graph.

## 5. The error contract collapses to 500

**MEASURED.** `throw new NonRetryableError('step-4 failed terminally')` arrives at the caller as:

```json
{"name": "WorkflowFatalError",
 "message": "The execution of the Workflow instance was terminated, as a step threw an NonRetryableError and it was not handled"}
```

The original message is destroyed. A plain `Error` survives intact as `{name, message}` — so the
*terminal* error, the one carrying business meaning, is the one that is lost.

**DOCS:** `InstanceStatus.error` is structurally `{name, message}`. There is no `details`, no `cause`,
and `status()` exposes no per-step errors at all. The real per-attempt errors *are* retained
platform-side — the REST `GET .../instances/{id}` returns `steps[].attempts[].error` — but that is not
reachable from the binding a request path is holding.

`framework/temporal/failures.ts` solves the same problem for Temporal by flattening
`kind`/`name`/`message`/`type`/`code` into `ApplicationFailure.details`, and its doc block states the
stakes: without it, *"`errorHandler` would map a rolled-back checkout to 500 instead of 409."* That is
exactly what happens here:

| Today | Under a naive Cloudflare adapter |
| --- | --- |
| Declined card (`complete-cart.ts:514`, `CONFLICT` + `DECLINED`) → **409**, `{code:"declined", message:"<refusal reason>"}` | **500**, `{code:"unknown_error", message:"An internal error occurred"}` |
| Awaiting authorization (`:505`) → 409, distinguishable from a decline | 500, indistinguishable |
| Cart already completing (`:89`) → 409 | 500 |
| Cart has no email (`:293`, `INVALID_DATA`) → **400** with the reason | 500, reason gone |
| Session amount ≠ collection amount (`:180`) → 400 telling the shopper to reopen the session | 500 |

The storefront's entire checkout error surface collapses to "something went wrong", **and** every
`throws` array in both OpenAPI documents becomes false. The `workflow-*-error` standards rules would
still pass, because they are static — so nothing in the gate set would catch it.

**The fix is forced, and it decides the compensation design too.** Since errors reject into `run()`,
the entrypoint can catch, serialize via `failures.ts`'s existing shape, and **return** the failure as
the instance's `output` — `{ ok: false, error }` — where serialization is under our control. Returning
rather than throwing means Cloudflare never considers the instance failed, so native `rollback` is
out and compensation must be hand-rolled as reverse `step.do` calls. That is independently the right
call: **DOCS** say a rollback handler that exhausts its retries stops the remaining handlers, whereas
`simple-adapter.ts` swallows and runs them all.

`failures.ts` sits under `src/framework/temporal/` behind the same structure rule as §4.

## 6. One isolate, one `globalEngine`, two roles

**MEASURED.** A module-global written from the `fetch` handler was readable from inside the workflow,
with a matching isolate id:

```json
{ "fetchIsolateId": "f7d1e304",
  "workflowSaw": { "isolateId seen by workflow": "f7d1e304", "globalMarker": "written-by-fetch" } }
```

`globalEngine` and `globalContainer` are module-level in `core/workflows/types.ts`, set once by
`container.ts`. On node this is safe because the Temporal Worker is a **separate OS process** with its
own module scope — which is exactly what lets `container.worker.ts` pin `simple` for itself while the
API pins `temporal`, so that the two nested `.run()` calls stay inline.

On workerd there is one variable and two roles. The fetch handler needs `cloudflare`, so `.run()`
dispatches. The entrypoint needs something simple-shaped, so a nested `.run()` stays inline. Under a
naive adapter a nested `.run()` would instead create a **second durable instance and poll it from
inside a step** — a different failure and compensation shape from today's, and precisely what
`container.worker.ts` refuses to do on node.

It is not a recursion hazard; it terminates. It is a silent change of nesting semantics, and it cannot
be fixed in the adapter. The options — `AsyncLocalStorage` scoping, an engine carried on
`StepContext`, an explicit nested-engine concept — are all changes to the port's own module.

**This is the only unavoidable port change.**

A second consequence of the shared isolate: `src/index.workerd.ts` does a **top-level `await
createWorkerdContainer(...)`**, bootstrapping 14 modules at module load. The entrypoint must be
exported from that same module for wrangler to bind it, so a cold workflow invocation pays a full
container bootstrap. **UNVERIFIED:** whether that is per-instance or per-isolate.

## 7. `run()` cannot block, and nothing pushes

**DOCS.** `create()` returns a handle; `status()` is the only way to learn the outcome. For child
workflows it is explicit: *"The parent Workflow will not block waiting for the child Workflow to
complete."* `waitForStatus()` exists only in `cloudflare:test`, the vitest-pool-workers harness.

`step.waitForEvent()` is the wrong direction — external → instance. Event subscriptions
(`instance.completed`, `instance.errored`, and four others) are **delivered to a Queue**, which is
out-of-band by construction; this repo's own consumer runs `max_batch_timeout: 5` seconds.

So the adapter polls. That keeps the port frozen and all 35 dispatch sites unchanged, at the cost of
discovery lag bounded by the poll interval.

**A push alternative exists but should not be relied on yet.** Cloudflare's published OpenAPI schema
carries `GET /accounts/{id}/workflows/{name}/instances/{id}/subscribe` — *"Opens a WebSocket that
streams workflow instance events"* — with a companion five-minute token endpoint. **It has no page on
the documentation site.** Treat it as unsupported until Cloudflare writes it up.

The other push option is a Durable Object rendezvous: the handler awaits on a DO keyed by instance id;
the workflow's final step calls the DO. It works, and it buys only the poll interval — the engine time
is identical. It also cannot replace the poller, because a workflow that errors early never reaches a
notify step, the notify call can itself fail, and the instance may finish before the handler
registers. Push *plus* poll, for single-digit milliseconds.

## 8. Retries: the naming invites a 310-second mistake

**MEASURED.** Five steps failing at the last, `delay: '1 second'`:

| `retries.limit` | total | polls at a 10 ms interval |
| --- | --- | --- |
| 0 | 43 ms | 2 |
| 1 | 1040 ms | 66 |
| 2 | 3029 ms | 211 |

`limit` counts retries **after** the first attempt. The setting matching the Temporal adapter's
`maximumAttempts: 1` is therefore **`limit: 0`**, not `limit: 1`.

**DOCS:** the default policy is `limit: 5, delay: 10s, backoff: exponential` — 10+20+40+80+160 ≈ **310
seconds** of backoff holding a shopper's HTTP request open, on a step that is not idempotent and was
never meant to retry. No workflow in this codebase declares `idempotent`, so the adapter must pass an
explicit policy on **every** step.

**MEASURED:** `delay` is required even when `limit` is 0; omitting it fails the step with
`Step config for "..." is in a invalid format`.

The poll counts in that table are the other lesson: 211 polls to sit out a three-second backoff. A real
adapter wants an escalating interval, not a flat one.

## 9. Connections, AsyncLocalStorage, and per-step scope

**MEASURED.** An ALS store set in `run()` is **not** visible inside a `step.do` callback:

```
als.run('set-in-run', () => step.do('read-als', () => als.getStore()))
  → undefined
```

`core/db/workers-provider.ts` binds a fresh `postgres()` client into an `AsyncLocalStorage` per
`withConnection`, and `getDb()` throws outside that scope. So a step cannot inherit a connection scope
established in `run()`, and the adapter's step wrapper is forced to be:

```ts
step.do(name, config, () => dbProvider.withConnection(() => action(ctx)))
```

This agrees with **DOCS** independently: *"If you use Hyperdrive in a Workflow, create a new connection
inside each `step.do()` and run your queries in that same step. Do not reuse a Hyperdrive-backed
connection across steps."* An instance can hibernate between steps, so no connection can span a run —
wrapping per instance would pass in testing and fail in production.

Cost: one Postgres connection per step. `complete-cart` goes from 1 to 14.

**Transactions are safe, and this was the finding most likely to have been fatal.**
`createWithTransaction` is registered per module and consumed *inside* service methods. A search of
`src/workflows/` found **no transaction context crossing a `ctx.step` boundary** — the only
transaction references in workflow files are prose comments describing work done within a single step.
No step returns a transaction handle.

## 10. Triggering contexts, nesting, limits, versioning

**Triggering — DOCS.** `fetch`, `queue`, `scheduled`, Durable Objects, and inside another workflow's
`step.do()` are all supported. The asymmetry that matters is wall clock: a `fetch` handler may stay
open indefinitely while the client is connected, but **`queue` and `scheduled` handlers are capped at
15 minutes**. CPU accounting is favourable — awaiting I/O is not CPU time — so a polling handler bills
near zero. **UNVERIFIED:** whether a binding `status()` call consumes a subrequest, which would matter
on the Free plan's budget of 50.

Today one subscriber dispatches a workflow (`process-payment-captured.ts`, return value unused) and no
cron job does. That subscriber runs in the `queue` handler, where the consumer wraps the **whole batch**
in one `withConnection` — so a message dispatching a workflow would hold that batch's connection for
the entire poll, blocking up to nine unrelated messages. §9's per-step scoping resolves it.

**Nesting — MEASURED:** `step.do` *can* be called from inside a `step.do` callback. **DOCS** demonstrate
it as the fix for non-deterministic `Promise.race`, but never specify how inner steps are cached or
counted. Creating a child instance inside a step is the documented-correct pattern; creating one
outside a step is explicitly marked bad. There is **no documented child-completion pattern** at all.

**Limits — DOCS.** Creation is capped at **100 instances/second per workflow** (300/s per account), and
overflow is an **HTTP 429 at `create()`**, not a queue — unlike concurrency overflow, which degrades
gracefully into `queued`. Paid concurrency is 50,000; step results cap at 1 MiB.

**Idempotency — DOCS.** `create({id})` on an existing id **throws**; it is not a dedupe and does not
return the existing instance. The window is the retention period, so trimming retention to save
storage silently shortens it. `createBatch` does the opposite — silently skips collisions and returns
a shorter array with no indication of which were skipped.

**Versioning — the structural gap.** Instances carry a `versionId` and versions are listable, but
**DOCS do not state** whether a resumed instance runs the code it started under or the code just
shipped. There is no version parameter on `create()`, and no equivalent of Temporal Worker Versioning,
`patched()` or `getVersion()`. ADR-0022 already records Worker Versioning as a required-but-unbuilt
prerequisite for Temporal; here there is nothing to build it *from*.

## 11. Latency, measured locally

**MEASURED, local `wrangler dev` only — these numbers do not transfer.** 14 steps, burst of 10, warmup
discarded:

| | inline p50 | Cloudflare p50 | delta |
| --- | --- | --- | --- |
| completes | 2 ms | 26 ms | +24 ms |
| fails at last step, terminal | 1 ms | 42 ms | +41 ms |

With simulated per-step work the overhead stayed roughly constant rather than compounding: 14 steps ×
20 ms of work was 294 ms inline against 318 ms through Workflows. **If that shape holds in production,
the engine is a fixed entry-and-exit toll rather than a per-step tax** — which is the difference
between a checkout that gets slightly slower and one that doubles. It is the single most important
thing a deployment has to confirm, and Miniflare is a single-process emulator, so it confirms nothing
on its own.

The cost model is not the constraint. **DOCS:** steps are billed at $0.80/100K beyond 500K/month
included. `complete-cart` is 14 steps, so roughly 35K checkouts a month sit inside the included tier
and beyond that it is ~$0.11 per 1,000 checkouts.

## 12. What fits as-is

- **Every dispatch site keeps its shape**, provided the adapter blocks internally.
- **No transaction crosses a step boundary** (§9).
- **98/98 `ctx.step` names are string literals** — no duplicates within a workflow, none inside a loop.
  Cloudflare memoizes on name and occurrence where `replay.ts` memoizes on call index; with unique
  literal names and no loops the two agree.
- **All eight `check:workflow-purity` rules stay correct and necessary.** Cloudflare's replay model is
  the same shape: glue outside `step.do` re-runs on engine restart. `try-around-step` stays valuable as
  the conservative common denominator — Cloudflare allows it, `simple` allows it, Temporal abandons the
  handler.
- **The structure graph needs no redesign.** `framework` already reaches `core` and `workflowRegistry`;
  the entrypoint export is fine because `entrypoints: '*'`. What it needs is path edits: the generated
  registry must move out of `src/framework/workflows/temporal/` (which `no-temporal-in-workerd`
  forbids the workerd entry from reaching) up to `src/framework/workflows/`, updating
  `COMPOSITION_ROOTS.workflowRegistry`, the generator, the Temporal Worker's imports and `verify`'s
  `generated` drift gate.
- **The adapter must take the binding as a parameter** rather than importing `cloudflare:workers`,
  exactly as `createCloudflareQueuesEventBus` does. Note that `cloudflare:workers` is caught by neither
  existing structure rule, so this is convention, not enforcement.

## 13. Verdict, sequence, and where the evidence is thin

**Verdict: viable, but materially larger than "add a third adapter".** The platform fit is genuinely
good — closures work, no accumulated payload, no fingerprint, native compensation, and a first-class
vitest testing API (`introspectWorkflowInstance`, `mockStepError`, `disableRetryDelays`) that makes the
semantics suite far cheaper than it would otherwise be. What makes it large is that two Temporal-shaped
files turn out to be load-bearing for *any* serializing adapter, and that the engine singleton does not
survive a runtime where the caller and the executor share module scope.

An honest sequence, smallest-risk first:

1. **Extract the value tagging (`payload-converter.ts`) and the error serialization (`failures.ts`)
   into a runtime-neutral home under `core/`.** No Cloudflare code in it; worth doing on its own
   merits, since both are general and neither is Temporal-specific in substance.
2. **Make the engine scopeable** rather than a module global (`core/workflows/types.ts`). The one
   unavoidable port change.
3. **Move the generated registry** out from behind `no-temporal-in-workerd`.
4. **Then the adapter**, with the semantics suite under `@cloudflare/vitest-pool-workers`.

Before any of it, **deploy the prototype** — §11 is the gate, and a production number that shows
per-step coordinator latency would change the recommendation from "runtime-wide swap" to "per-workflow
opt-in", or to "not yet".

### Where the evidence is thin

- **Every MEASURED result is local emulation.** Structured-clone behaviour and isolate sharing are
  likely faithful, since that is workerd itself. The `params` result in §3 is likely **not** — the docs
  say JSON and the emulator says structured clone. The absence of an enforced size limit locally is
  likewise untrustworthy: the prototype accepted a 2 MB step return against a documented 1 MiB cap.
- **Production latency is entirely unmeasured** (§11).
- **Whether a failed step's failure is memoized on replay is unspecified** — **DOCS** guarantee
  memoization only for *successful* steps. §5's fix depends on catching a step failure in `run()` and
  branching on it; if that branch re-executes differently after an engine restart, the fix is unsound.
  This is the highest-value unknown remaining and it needs a probe.
- **In-flight instance behaviour across a deploy is undocumented** (§10).
- **Whether `status()` is rate-limited, billed, or consumes a subrequest is undocumented** (§7, §10).
- **Whether a step output replayed from storage rehydrates its `Date`** was observed only within a
  single invocation (§3).
- **Two official Cloudflare examples return a `WorkflowInstance` from a `step.do`**, which the API
  reference says should throw. Either there is an undocumented carve-out for RPC stubs or the examples
  are wrong; do not build on them.

### References

- ADR-0021 — the Temporal adapter, its replay design, and what it costs
- ADR-0022 — durable execution is a runtime split, and the limitation this research revisits
- ADR-0023, ADR-0024 — the event bus, whose Cloudflare Queues adapter is the precedent for taking a
  binding as a parameter
- `apps/backend/src/framework/workflows/README.md` — the port, the two adapters, and the parity suite
- `.scratch/cloudflare-workflows/prototype/` — the measuring rig, kept as the primary source;
  `FINDINGS.md` there carries the raw numbers
