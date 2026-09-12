# 29. Cron Is a Temporal Schedule on a Worker of Its Own, and a Job Stays Ordinary Node Code

**Status:** Accepted

## Context

Scheduled work on node ran on a second job system that existed for nothing else. BullMQ's Postgres
backend kept its own schema — one more non-`public` schema the test suite's `TRUNCATE` scoping had to
be explained around — and was bridged into TypeScript with two `@ts-expect-error`s because the
library's types only admit a Redis connection. Bull Board was mounted into Express purely to look at
it, which was the only reason the `CronScheduler` port had a method returning framework-specific
middleware.

The Worker that executed jobs ran **inside the API process.** That is why the API refused to start
its scheduler under `NODE_ENV=test`: two Workers polling one queue on a shared database means
whichever is free claims the task, so the test suite's jobs vanished into the server's Worker. It is
also why a slow job competed with request handling in the very process that scheduled it.

The same repo already ran durable execution on Temporal — workflows on one task queue (ADR-0021,
ADR-0022), event subscribers on another (ADR-0023), each with its own Worker process, retry policy,
priority and fairness, and a UI showing every execution. Cron was the one kind of background work
that got none of it. A scheduled job could not be triggered by hand, could not be paused, had no
history beyond a log line, and — because the handler map lived in process memory — silently did
nothing if the deploy that registered it was not the deploy that received the tick.

There were **zero enabled cron jobs in the repo.** The cost of the second system was being paid for
nothing, and every job written from here on would have made the migration bigger. That timing, more
than any individual argument below, is why this was done now rather than later.

## Decision

**A Temporal Schedule per job, whose action starts a cron driver workflow on a task queue polled by
a third Worker process.** The driver invokes one activity; that activity resolves the job's handler
and calls it with the DI container — ordinary Node code with a database, exactly as a subscriber is.

### Why a Schedule rather than a repeatable job

The first reason is subtraction: **one durable-execution system rather than two.** Temporal was
already a hard dependency of every workflow on node, so the queue-backed scheduler was a second
backing store, a second schema, a second set of concepts and a second dashboard bought for a
capability the first one already had. Deleting it removed three dependencies (`bullmq`,
`@bull-board/api`, `@bull-board/express`), an Express mount, a port method that existed only to
render that mount, a sentence of test-infrastructure prose, and the `NODE_ENV=test` guard — which is
gone rather than documented, because a Worker in its own process cannot steal the test suite's tasks.
The `TRUNCATE` in `tests/setup/db-setup.ts` is untouched: it was always scoped to `schemaname =
'public'` for drizzle's sake, and the `bullmq` schema merely happened to sit outside it too.

The second is what the operator gains, none of which the previous adapter had and none of which is
application code here:

| Capability | Where it lives |
|---|---|
| Every schedule listed with its **next fire time** | Temporal UI → Schedules |
| **Trigger by hand**, without waiting for a tick or editing a cron expression | UI / `temporal schedule trigger` |
| **Pause** a misbehaving job without a deploy | UI / `temporal schedule pause` |
| **Pause on failure**, so a job failing every minute stops before it fills the history | `policies.pauseOnFailure`, set per schedule |
| **Backfill** over a missed window, so an outage is replayed deliberately rather than lost | `temporal schedule backfill` |
| **A per-run history with the failure inside it** | the driver execution, in the UI |

Two more properties that were previously implicit are now stated. **Overlap is `SKIP`:** a job
slower than its interval does not overlap itself, which is what the library happened to do and is
now a policy that can be changed per job. And a job's cron expression is interpreted in **UTC** —
no `timezone` is set — so a schedule means the same thing wherever it runs.

Temporal's own documentation now recommends Schedules over the older cron-schedule workflow option.
That option was not considered.

Backfill, trigger and pause are deliberately **not** wrapped in admin routes. They are UI and CLI
operations on the server, and an application feature in front of them would be a second surface to
keep correct for no capability gained.

### Why cron gets a queue and a process, while urgency gets a priority key

Cron gets a task queue because it is **a separate process with a separate lifecycle and a tick that
must not be starved** — the axis Temporal's own guidance endorses for adding a queue, alongside
differing resource requirements and rate limits. The concrete failure it prevents runs both ways: a
nightly job that takes an hour must not hold a slot a shopper's `authorize-payment` step is waiting
for, and a checkout burst must not delay a scheduled run past its next tick — which under overlap
`SKIP` means *dropping* that tick, not queueing it. One pool of slots per kind of work is the only
arrangement where neither can starve the other.

It does **not** get a queue per trigger source. "Admin-triggered versus customer-triggered" is
precisely the case Temporal steers to `priorityKey` on a shared queue: one line, no process,
adjustable without a deploy, and inherited automatically by the execution's activities and child
workflows. The event bus already sets priority and fairness keys per event; the workflow engine
gaining a priority map keyed by workflow name is the symmetric change.

**That priority map is deliberately out of scope here.** It is named in this ADR and not built,
because the thing worth writing down is the rule, not the feature: the queue count grows for a
lifecycle, and only for a lifecycle. A fourth queue proposed for urgency should be read as a request
for a priority key.

| Queue | Process | Runs | Workflow engine pin | Registers workflows |
|---|---|---|---|---|
| `proteus` | `worker` | `src/workflows/` — a workflow's steps | `simple` (nested `.run()` stays inline) | yes, all of them |
| `proteus-events` | `events-worker` | `src/subscribers/` | `temporal` | no — activity only |
| `proteus-cron` | `cron-worker` | `src/jobs/` | `temporal` | **yes, exactly one** |

The last column is the one forced difference. A Schedule's action can only start a *workflow*, never
a standalone activity, so unlike the events Worker this one bundles a workflow path — a single
driver whose whole body is one activity invocation. The `temporal` engine pin is what makes a cron
handler's `.run()` call a durable execution on the workflow queue rather than an inline one: a
handler calling `.run()` is the *entry* to a workflow and should get what any other entry point
gets, which is what makes "a nightly cleanup and an admin button share one implementation" true
rather than aspirational.

### Why the handler stays outside the workflow sandbox, and what that costs

A cron job is written as a function taking the container:

```ts
export const config: JobDefinition = {
  name: 'heartbeat',
  schedule: CronExpression.EVERY_MINUTE,
  handler: async (container) => { /* query, call services, dispatch a workflow */ },
  disabled: true,
}
```

It runs in the Worker process, not in the v8 isolate the driver runs in. That is not a convenience:
the workflow sandbox has no filesystem, no clock, no network and no database, so a container cannot
exist inside it, and a job whose work is "every cart abandoned more than a day ago" is a query before
it is anything else. Keeping the handler outside is what makes a job the same kind of code as a
module service or a subscriber, rather than a third dialect with its own rules.

**The cost, stated plainly: the driver *awaits* an activity, so the run's fate and the work's fate
can diverge.** A Worker that restarts mid-run fails that activity — `maximumAttempts: 1`, because a
cron handler is ordinary application code and nothing makes it idempotent — while the work the
handler already dispatched carries on to completion. The schedule then reports a failure for a job
that in some sense succeeded, and `pauseOnFailure` stops the next tick over it. For a job that does
its work inline this is the honest answer. For a job that dispatches work elsewhere it is wrong, and
the exit below is how it gets fixed.

A second cost had to be paid for rather than accepted. Absent a heartbeat, Temporal cannot tell a
dead Worker from a slow job until the run's `startToCloseTimeout` elapses — and with a long timeout
and overlap `SKIP`, one crash suppresses **every following tick** for the remainder of that window
while the UI shows a run that looks healthy. So the activity wrapper heartbeats while the handler
runs, with a heartbeat timeout short enough that death is noticed in about half a minute. The
heartbeat is the *wrapper's*, never the handler's: threading Temporal's activity context into
`JobDefinition` would put a node-only runtime concern into the one type workerd also reads.

### Why `JobDefinition` did not change

A job is a name, a cron expression, a handler taking the container, and a `disabled` flag — the same
four fields as before the migration. Two additions were considered and rejected:

- **A declarative `workflow` variant**, letting the driver start the job's workflow directly with no
  handler in between. Rejected because a real job's input is usually *fetched*: "every cart abandoned
  more than a day ago" is a query, a query needs a container, and a container cannot exist inside the
  sandbox. Worse, assembling the engine's driver input from sandbox code would be a second copy of
  dispatch logic that the workflow engine's own configuration owns — and a copy that cannot be tested
  where it runs.
- **A `handler` / `workflow` union**, for the same reason. **The graduation path is the handler's
  body changing, not the definition's type.** A job that grows past one step stops *doing* the work
  and starts *dispatching* it: fetch the inputs, then call a `createWorkflow` definition through the
  workflow engine port. Growing a job is then an edit to a function, not a migration of a shape.

That stability is also what keeps **one job list serving both runtimes.** workerd runs the same
handlers under Cloudflare cron triggers, unaware that node's side changed; a Temporal-shaped variant
in the type would have been a field one of the two runtimes could never honour.

`TemporalCronScheduler` is the **port's one implementation**, and workerd does not go through the
port at all: `index.workerd.ts` drives `scheduler/kuron/` directly from that same `src/jobs/` list,
through Kuron's own `cron.schedule(pattern, handler)` API rather than the port's
`schedule(job: JobDefinition)`. So this is a **runtime split rather than an adapter selection**,
which is the difference from the event bus — there is no `scheduler-selection.ts` and nothing derives
an implementation. The split is deliberate, not an omission: `no-temporal-in-workerd` forbids the
workerd entry point every Temporal-shaped path *except* `scheduler/kuron/`, which it names as the
half of the scheduler workerd is meant to reach.

`mountMonitor()` is gone from the port, because the Schedules tab is the monitor and it is not
something this codebase mounts.

Per-job configuration that *is* Temporal-shaped lives where it is honoured: `startToCloseTimeout` is
a map at the scheduler's composition root, which is the same place the workflow engine's per-step
retry policies already live.

### The recorded exit: the child-workflow variant

**When a job appears that is long-running or wide enough that awaiting it from an activity is
wrong** — the failure being the divergence named above, where a Worker restart fails the cron run
while the dispatched work completes and the next tick runs it again — **the driver gains a branch:
start the job's workflow as a *child* on the workflow queue instead of invoking the handler
activity.**

What that buys, and what nothing else does:

- A child's parent **reattaches after a restart** rather than failing, so the run survives a deploy.
- A parent waiting on a child **holds no Worker slot**, so a job that runs for an hour costs the cron
  Worker nothing while it waits.
- The schedule's outcome becomes **equal to the work's outcome**, which is what makes overlap `SKIP`
  and `pauseOnFailure` mean what an operator reads them as — the overlap decision then accounts for
  the work, not just its dispatch.

Two properties make this **additive rather than a redesign**, and they are the reason it is worth
recording instead of deciding now. **Branching on workflow *input* is replay-safe**, so the branch
can be added while executions are in flight without endangering them. And **the driver's input can
be assembled by the scheduler at reconciliation time** — in Node, where the engine's configuration
lives — and carried as the schedule's action argument, which is exactly what removes the need to
reconstruct dispatch logic inside the sandbox. The obvious objection, that a workflow's input would
have to be static at schedule time, does not bite: a job wanting this variant queries for itself in
its first step, so its input is empty.

**It is not built now because no job exists to shape it.** The repo ships with the same zero enabled
jobs it started with, and a branch with no caller is a guess about which of its two forms is needed.

## Consequences

**node's scheduled work now depends on Temporal being up, where it previously depended on Postgres
— which was up anyway.** That is a real increase in what has to be running for a tick to fire, and
it is the one consequence worth stating without qualification. It is accepted because the same
deployment already needs Temporal for every workflow: the dependency is new to *cron*, not to the
deployment. The API makes it loud rather than latent by refusing to boot when the frontend is
unreachable (`src/framework/temporal/preflight.ts`), so the failure names itself at startup instead
of arriving later as a timeout inside a checkout.

**The dev stack is six processes, not five.** `worker:cron` is a pane in the VS Code `dev` task and a
`cron-worker` service in `docker-compose.yml`, alongside `worker` and `events-worker`. It is the one
non-workflow Worker with a healthcheck, because registering the driver means it pays the same webpack
pass over the sandbox entrypoint that `worker` does — without the probe, `docker compose up --wait`
would return during exactly the window in which `proteus-cron` has no poller.

**A schedule whose queue nobody polls does not fail loudly.** The API reconciles schedules whether or
not a Worker is running — deliberately, so the schedules exist independently of process lifetimes —
so a stack missing `cron-worker` creates every schedule, starts every run, and fails each one on its
own timeout. That is the same "queue nobody polls" failure mode ADR-0023 records for the event bus,
and the same thing it is easy to misread as a broken job.

**Reconciliation pauses but never unpauses.** Marking a job `disabled` pauses its schedule rather
than deleting it, so turning it back on stays a one-line edit rather than a rediscovery that the job
existed. Enabling one, however, does *not* unpause: `pauseOnFailure` and an operator's own pause write
the same flag, and a boot that cleared it would restart a job that was stopped for a reason. The
scheduler logs a warning naming the schedule when a job is enabled in code and paused on the server,
because that combination never fires and has no other signal.

**Orphan schedules are not swept.** Renaming or deleting a job leaves its old schedule on the server
until someone removes it; `remove()` is the explicit way, and a stale local schedule is a
`temporal schedule delete` away. Sweeping needs a rule about what else may own a schedule in this
namespace, and there is not one yet.

**The primary test seam is the `CronScheduler` port, and it needs a real server.** Schedules are a
server feature, so `__tests__/temporal-cron-scheduler.server.test.ts` boots a full dev server rather
than the time-skipping one, claims a task queue of its own, and runs a real Worker — the event bus's
server test is the prior art, not the workflow engine's. It asserts the spec and policies, that a
disabled job ends up paused, that a manually triggered action reaches the handler through the whole
path, that a handler outrunning its timeout fails the run, and that a handler whose Worker is killed
mid-run is failed within roughly the heartbeat timeout rather than the far longer start-to-close one.
That last assertion is what makes the heartbeat a tested property rather than a hopeful one; without
it the wrapper could be deleted and every other test would stay green. Like the other
server-dependent suites it is excluded from the default verification gate, which keeps working for a
checkout that has not started Temporal.

**workerd is unchanged.** Cloudflare keeps its cron triggers, the wrangler cron list keeps being
hand-synced with the job list, and the structural rule forbidding any path from the workerd entry
point to Temporal is what makes this a runtime split rather than a configuration — ADR-0022's
position, applied to a third subsystem.

**Worker Versioning remains the outstanding follow-up it already was** (ADR-0022). A deploy that
changes the driver's shape while a run is in flight is the same hazard it is for any workflow here,
and the driver being one activity call is what keeps that surface as small as it can be.

## References

- ADR-0021, ADR-0022 — the workflow engine and the runtime split this inherits
- ADR-0023 — the event bus, whose second Worker this one is modelled on, and its "queue nobody polls"
  failure mode
- `.scratch/temporal-schedules/spec.md` — the working spec
- `apps/backend/src/framework/scheduler/temporal/config.ts` — the queue, the driver path and the
  heartbeat arithmetic, with the reasoning inline
- `apps/backend/src/framework/scheduler/temporal/temporal-cron-scheduler.ts` — reconciliation and the
  schedule policies
- `apps/backend/src/framework/scheduler/temporal/workflows.ts` — the driver, and the branch point the
  exit above describes
- `apps/backend/src/core/types/scheduler.ts` — `JobDefinition`, unchanged
- `apps/backend/src/framework/scheduler/kuron/README.md` — the workerd half, and why it does not
  implement the port
- `apps/backend/docker-compose.yml`, `.vscode/tasks.json` — the sixth process
