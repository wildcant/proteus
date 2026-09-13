# 29. Cron Is a Temporal Schedule on a Worker of Its Own, and a Job Stays Ordinary Node Code

**Status:** Accepted, and amended — see [Amendment: the cron Worker owns cron, end to
end](#amendment-the-cron-worker-owns-cron-end-to-end) at the bottom. The decision recorded here
stands; what changed is which process reconciles, how complete reconciliation is, and
`pauseOnFailure`.

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

Two rows of that table did not survive the amendment below. `pauseOnFailure` is no longer set, and
pausing from the UI is no longer a supported operation — both for the same reason, that code is the
only control plane for cron. They are left in place because they are what the server offers, and
because the amendment's argument is only readable against them.
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
that in some sense succeeded. (At the time this was written `pauseOnFailure` also stopped the next
tick over it; the amendment removes that, so the divergence is now a failed run in the history and
nothing more.) For a job that does its work inline this is the honest answer. For a job that dispatches work elsewhere it is wrong, and
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

**A schedule whose queue nobody polls does not fail loudly.** ~~The API reconciles schedules whether
or not a Worker is running — deliberately, so the schedules exist independently of process lifetimes
— so a stack missing `cron-worker` creates every schedule, starts every run, and fails each one on
its own timeout.~~ *Superseded by the amendment:* the Worker that polls is the process that
reconciles, so a stack missing `cron-worker` has no cron schedules at all rather than schedules
nothing answers. The "queue nobody polls" failure mode ADR-0023 records for the event bus no longer
has a cron analogue.

**Reconciliation writes the pause flag from the definition, in both directions.** Marking a job
`disabled` pauses its schedule rather than deleting it, so turning it back on stays a one-line edit
rather than a rediscovery that the job existed — and enabling one unpauses it, because `disabled` in
the source file is the whole answer to "does this job run". A schedule that disagrees is drift, and
is corrected at boot exactly as the cron spec and the workflow action are.

The cost is real and is accepted knowingly. `pauseOnFailure` and an operator's pause in the UI write
that same flag, and Temporal cannot tell either from a deliberate one, so **a pause applied on the
server survives only until the next boot**: an incident contained by pausing a job is uncontained by
the next deploy or restart. *The amendment turns this from an accepted cost into the point, and
removes `pauseOnFailure` as the half of it that no source file could express.* Two things make that affordable rather than merely cheap. Unpausing
something that was paused logs a warning naming the schedule and saying what was overruled, so it is
never silent. And a pause meant to outlive a restart has a place to go that reconciliation respects
— `disabled: true` on the job, which is a one-line change on the same branch that would carry the
fix. The alternative, preserving a server-side pause, was tried first and traded one silent failure
for another: a job enabled in code that never fires, whose only trace is a flag in a UI nobody is
looking at.

**Orphan schedules are not swept.** ~~Renaming or deleting a job leaves its old schedule on the
server until someone removes it; `remove()` is the explicit way, and a stale local schedule is a
`temporal schedule delete` away. Sweeping needs a rule about what else may own a schedule in this
namespace, and there is not one yet.~~ *Superseded by the amendment:* there is such a rule — the
`cron_` prefix `cronScheduleId()` stamps — and reconciliation sweeps by it.

**The primary test seam is the `CronScheduler` port, and it needs a real server.** Schedules are a
server feature, so `__tests__/temporal-cron-scheduler.server.test.ts` boots a full dev server rather
than the time-skipping one, claims a task queue of its own, and runs a real Worker — the event bus's
server test is the prior art, not the workflow engine's. It asserts the spec and policies, that a
disabled job ends up paused and an enabled one is unpaused even over a pause applied by hand, that a
manually triggered action reaches the handler through the whole path, that a handler outrunning its timeout fails the run, and that a handler whose Worker is killed
mid-run is failed within roughly the heartbeat timeout rather than the far longer start-to-close one.
The amendment adds three more at the same seam: that a job the list no longer names has its schedule
swept, that a schedule without the `cron_` prefix survives that sweep, and that a job whose
*scheduled* run fails is still unpaused afterwards — the one assertion in the file that waits for a
real tick, because a manual trigger never tripped `pauseOnFailure` to begin with.
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

## Amendment: the cron Worker owns cron, end to end

**Amended 2026-09-12.** Everything above stands — a Schedule per job, a driver workflow, a third
Worker, a handler that is ordinary Node code. What follows replaces the parts of it that put
registration in the API process.

### The problem it fixes

**Two processes had to agree about the job list, and nothing made them.** The API reconciled
Schedules at boot; the cron Worker executed the runs those Schedules started. They deploy
independently and held the list in different places — the API wrote server-side state from
`src/jobs/`, the Worker held the same list in process memory. When they disagreed the failure was
quiet and the UI actively misleading: the Schedules tab listed the job with its next fire times,
because the Schedule was exactly what the API created, while every run failed with
`No job is registered as "…" on this Worker`. An operator reading that tab saw a healthy job.

Reproduced on a running stack: a job added to `src/jobs/` produced a Schedule within seconds — the
API runs under `tsx --watch` — and then failed on every tick against a cron Worker started before the
job existed, while a pre-existing job on the same Worker completed on every tick. One Worker, two
jobs, opposite outcomes, decided entirely by which deploy the Worker's memory came from.

### The decision

**The process that holds the job list writes the Schedules.** Reconciliation moved into the cron
Worker's bootstrap, before it begins polling, from the same `src/jobs/` import it builds its activity
from. The API stops constructing, registering or calling the `CronScheduler`, and
`ContainerRegistrationKeys.SCHEDULER` is gone from the node container. A Schedule existing without a
Worker able to run it stops being a deploy-ordering rule nobody wrote down and becomes structurally
impossible: the same import, in the same process, produces both. Nothing else about the Worker
changed — same queue, same driver, same activity, same heartbeat.

**Reconciliation became total.** `start(jobs)` creates, updates *and deletes*: it lists the
namespace's Schedules, keeps those whose id carries the `cron_` prefix `cronScheduleId()` stamps, and
deletes any the job list does not name. Schedules without that prefix are not this code's and are
never touched — that is the rule the original said did not exist yet. Deleting a job file deletes its
Schedule; renaming a job removes the old one and creates the new one.

Deletion is safe here precisely because the sweeping process is the executing process: the list it
sweeps against is the list that defines what can run. Deletion rather than pause, because a paused
orphan is indistinguishable in the UI from a deliberately disabled job — and because **run history
does not live in the Schedule.** Measured against a real server: seven runs, Schedule deleted, all
seven still present with full history and still queryable by the `TemporalScheduledById` search
attribute, bounded only by namespace retention (three days locally).

**`pauseOnFailure` is removed.** It is the one piece of cron state that cannot be expressed in the
source tree, which the control-plane decision below rules out. It is also a wedge: reconciliation
runs only at boot, so a pause applied after the last Worker of a rollout has started is never undone
— during a rolling deploy an old replica can claim a newly added job's first tick, fail it with
`No job is registered`, and pause the Schedule indefinitely with no code change that explains it. The
behaviour it guarded, a job failing every minute filling up history, is bounded by namespace
retention and is now visible rather than silenced.

A measured detail worth keeping: `pauseOnFailure` only ever tripped on *scheduled* runs. Three
consecutive failures from manual `trigger()` calls paused nothing. That is why the test asserting its
absence waits for a real tick instead of triggering one.

**Code is the only control plane for cron, and that is now a decision rather than a cost.** Pausing,
backfilling or editing a Schedule from the Temporal UI stays possible and stays unsupported:
reconciliation overwrites the pause flag from the definition in both directions, and logs a warning
naming what it overruled. `disabled: true` is the only way to stop a job, and flipping it back
resumes the job on deploy.

**The measured cost of an orphaned Schedule, recorded so the severity is not overstated later.** An
orphan fired once, failed, and was paused by the server after exactly one scheduled run; a reconcile
whose list did not name it left it paused and untouched. The standing cost was one failed run and an
inert paused row per deleted job — not a runaway, but a row that accumulated and that nothing would
ever clean up.

### Consequences of the amendment

**Rolling a deploy back removes the jobs that deploy added.** A consequence of desired-state
reconciliation, and correct — the jobs that exist are the jobs the running code defines. It is called
out because a Schedule vanishing after a rollback otherwise looks like data loss.

**Two Worker versions reconciling concurrently during a rollout is accepted, not solved.** It
self-heals on the next boot of the newer version. Solving it needs leader election, which is a larger
decision than this one and is not taken here.

**The job list is generated, and every Worker now has a watch-mode dev entrypoint.**
`src/jobs/index.ts` was hand-written — the last of the three registries that was — and is replaced by
`src/jobs/registry.gen.ts`, written by `scripts/generate-job-registry.ts` from the same `export const
config` convention the subscriber generator reads. That makes all three Workers one shape: a
`worker.dev.ts` that regenerates its registry before booting, under `tsx watch` with an `--include`
over the source directory so a brand-new file reloads at all, and the generated file excluded so
writing it cannot restart the Worker that just wrote it.

Generating this particular list carries more weight than the other two. It is not only the set of
handlers that can run; it is the **desired state reconciliation deletes against**, so a job file the
generator failed to notice would have its Schedule swept rather than merely go unrun. That is why the
generator *rejects* a file in `src/jobs/` it cannot read instead of skipping it, and why duplicate job
names are a hard error — two jobs of one name reconcile to one `cron_` id, and the second silently
overwrites the first. `check:job-registry` joins the other two in `verify`'s `generated` gate.

The three `:dev` scripts are **new** rather than changes to the existing ones: those are the
`command:` of the compose services, and a watcher inside a container silently never fires, because
the bind mount carries writes but not filesystem events.

### Rejected: removing Temporal from the clock

Recorded because it was the starting proposal, so that the next person asking "why not just use
timers" gets the measured answer rather than the argument again.

**Worker-side timers** would remove the Schedule and with it the orphan question, but they need a
cron parser dependency that left the tree with BullMQ, they fire once per replica unless deduplicated
by a per-tick workflow id, and they lose any tick that falls during a restart with no record that one
was owed. **A long-running cron workflow per job** is *more* server state than a Schedule, plus a
determinism and versioning burden on code that is currently exempt from both.

The property actually wanted was never statelessness — the event bus is not stateless either, it
deduplicates on server-side activity ids. It is that the state be shaped like an *occurrence* rather
than a *definition*, so it expires on its own and cannot drift from the source tree. Cron's state is
definition-shaped by nature, so the answer is to reconcile it totally from one process rather than to
eliminate it.

### Rejected: an archived state for retired Schedules

There is none to use. The whole handle surface is describe, update, delete, trigger, backfill, pause
and unpause; a Schedule is running or paused. Temporal's Archival is a namespace-level feature for
closed workflow histories going to blob storage, is marked experimental, is explicitly unsupported
when running Temporal through Docker, and is disabled in this namespace. It is not a schedule state.

It is also unnecessary: run history survives deletion and is bounded by retention either way, so
keeping a dead Schedule buys nothing.

### Non-goals

- **UI-driven control as a supported operation.** Making a UI pause durable — a three-way merge
  against a last-applied marker in the Schedule's memo, or any similar scheme — is a separate
  decision. The original's "a pause applied on the server survives only until the next boot" is a
  stated non-goal here rather than an accepted cost.
- **Leader election among cron Workers.**
- **Worker Versioning**, still the outstanding follow-up ADR-0022 and this ADR already name.
- **Any change to the workerd runtime.** Cloudflare owns that clock through `wrangler.jsonc`, which
  stays hand-synced with the job list. `JobDefinition`, the driver workflow, the activity and the
  heartbeat are all untouched by this amendment.
- **Schedules in the namespace that this code did not create.** The sweep is scoped by prefix.

## References

- ADR-0021, ADR-0022 — the workflow engine and the runtime split this inherits
- ADR-0023 — the event bus, whose second Worker this one is modelled on, and its "queue nobody polls"
  failure mode
- `.scratch/temporal-schedules/spec.md` — the working spec, covering both this ADR and its amendment
- `apps/backend/src/framework/scheduler/temporal/config.ts` — the queue, the driver path and the
  heartbeat arithmetic, with the reasoning inline
- `apps/backend/src/framework/scheduler/temporal/temporal-cron-scheduler.ts` — reconciliation, the
  sweep and the schedule policies
- `apps/backend/src/framework/scheduler/temporal/worker.ts` — where reconciliation now runs
- `apps/backend/scripts/generate-job-registry.ts` — the job list, generated like the other two
- `apps/backend/src/framework/scheduler/temporal/workflows.ts` — the driver, and the branch point the
  exit above describes
- `apps/backend/src/core/types/scheduler.ts` — `JobDefinition`, unchanged
- `apps/backend/src/framework/scheduler/kuron/README.md` — the workerd half, and why it does not
  implement the port
- `apps/backend/docker-compose.yml`, `.vscode/tasks.json` — the sixth process
