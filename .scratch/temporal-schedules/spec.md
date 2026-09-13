# Cron on Temporal Schedules

**Status:** shipped, in two passes. The first put cron on Temporal Schedules and gave it a Worker of
its own (PRs #75–#78, ADR-0029). The second — originally drafted separately as
`.scratch/cron-registration/spec.md`, now merged in here — moved registration into that Worker,
made reconciliation total, removed `pauseOnFailure`, and generated the job list. Where the second
pass reversed a decision of the first, the reversal is marked **Revised** inline rather than
silently overwritten, because the first version's reasoning is what makes the second's legible.

**Goal:** scheduled work is a Temporal Schedule starting a workflow on a cron Worker of its own,
instead of a BullMQ repeatable job running inside the API process — and that Worker is the *only*
process that touches cron. After this, node has one durable-execution system rather than two job
systems, the API process executes and schedules no background work, changing the job list takes
effect on deploy in one process with nothing left behind, and a scheduled run is visible,
triggerable and backfillable in the Temporal UI.

**Scope:** the `CronScheduler` port and its adapter, a third Worker process and its task queue, the
API server's bootstrap, the three BullMQ/Bull Board dependencies, the dev stack's process list, the
job registry and its generator, the dev-loop scripts for all three Workers, and one ADR (written in
the first pass, amended in the second). `JobDefinition` does not change. The workerd runtime does
not change. No new runtime dependency.

---

## Problem Statement

### The second job system

Scheduled work on node runs on a second job system that exists for nothing else. BullMQ's Postgres
backend keeps its own schema, needs a carve-out in the test suite's TRUNCATE, and is bridged into
TypeScript with two `@ts-expect-error`s because the library's types only admit a Redis connection.
Bull Board is mounted into Express purely to look at it, which is the only reason the `CronScheduler`
port has a method returning framework-specific middleware.

The Worker that executes jobs runs **inside the API process**. That is why the API refuses to start
its scheduler under `NODE_ENV=test` — two Workers polling one queue on a shared database means
whichever is free claims the task, and the test suite's jobs vanish into the server's Worker. It is
also why a slow job competes with request handling for the process it was scheduled from.

Meanwhile the same repo already runs durable execution on Temporal: workflows on one task queue, event
subscribers on another, each with its own Worker process, retry policy, priority and fairness, and a
UI that shows every execution. Cron is the one kind of background work that does not get any of it. A
scheduled job today cannot be triggered by hand, cannot be paused, has no history beyond a log line,
and — because the handler map lives in process memory — silently does nothing if the deploy that
registered it is not the deploy that received the tick.

There are zero enabled cron jobs in the repo. The cost of the second system is being paid for nothing,
and every job written from here on makes the migration bigger.

### The split ownership the first pass left behind

*Found in review of the first pass, and the reason for the second.*

**Two processes have to agree about the job list, and nothing makes them.** The API reconciles
Schedules at boot; the cron Worker executes the runs those Schedules start. They are deployed
independently and hold the list in different places — the API writes server-side state from
`src/jobs/`, the cron Worker holds the same list in process memory. When they disagree, the failure is
quiet and the UI actively misleads: the Schedules tab lists the job with its next fire times, because
the schedule is exactly what the API created, while every run fails with `No job is registered as "…"
on this Worker`. An operator reading that tab sees a healthy job.

This was reproduced on a running stack. A job added to `src/jobs/` produced a Schedule within seconds
— the API runs under `tsx --watch` — and then failed on every tick against a cron Worker that had been
started before the job existed. Over the same period the pre-existing job on the same Worker completed
on every tick. One Worker, two jobs, opposite outcomes, decided entirely by which deploy the Worker's
memory came from.

**Deleting a job leaves its Schedule behind.** `start()` only touches jobs the list names, so a
removed job's Schedule survives every subsequent boot. Measured behaviour of one such orphan: it fires
once, fails, and the server pauses it via `pauseOnFailure`; a reconcile whose job list does not name it
leaves it untouched. So the standing cost is one failed run and an inert paused row — not a runaway,
but a row that accumulates per deleted job and that nothing will ever clean up. The first pass
documented this as deliberate, on the grounds that sweeping needs a rule about what else may own a
Schedule in the namespace and there isn't one. There is one: every Schedule this code creates is named
by `cronScheduleId()`, which stamps a `cron_` prefix.

**`pauseOnFailure` can wedge a job permanently.** It is also the one piece of cron state that cannot
be expressed in the source tree. During a rolling deploy an old replica can claim a newly added job's
first tick, fail it with `No job is registered`, and pause the Schedule. Reconciliation would unpause
it — but reconciliation only runs at boot, so if the rollout has finished, the new job is paused
indefinitely with no code change that explains it.

**Editing a job does not change its behaviour without a manual restart.** The workflow Worker runs
under `tsx watch --include 'src/workflows/**'` through a dev entrypoint that regenerates its registry,
so a brand-new workflow file is live within seconds — verified in review: a new workflow file appeared
in the generated registry unprompted, ran, and picked up an edit to its body across two invocations
without the Worker being restarted. The cron and events Workers run their production entrypoints
directly, with no watcher, so both hold whatever list they imported at start. For cron this is worse
than stale code: the API *does* reconcile on save, so a changed cron expression takes effect while the
changed handler does not.

## Solution

A Temporal Schedule per job, whose action starts a cron driver workflow on a task queue polled by a
third Worker process. The driver invokes one activity, which resolves the job's handler and calls it
with the container — ordinary Node code with a database, exactly as a subscriber is.

`JobDefinition` keeps its shape: a name, a cron expression, a handler taking the container, and a
`disabled` flag. That is what makes one job list serve both runtimes — workerd continues to run the
same handlers under Cloudflare cron triggers, unaware that node's side changed.

A job that grows past one step does not change shape either. Its handler stops *doing* the work and
starts *dispatching* it: fetch whatever inputs the work needs from the database, then call a
`createWorkflow` definition through the workflow engine port. Because the cron Worker pins the
`temporal` engine, that call becomes a durable execution on the workflow task queue — the same
execution an admin route would get from the same `.run()` call. One workflow, two entry points, no
divergence.

**The cron Worker owns cron, end to end.** The process that holds the job list is the process that
writes the Schedules and runs the handlers. The API does not touch cron. A Schedule that exists
without a Worker able to run it stops being a deploy-ordering rule nobody wrote down and becomes
structurally impossible: the same import, in the same process, produces both.

**Reconciliation is total.** Create, update and *delete*, scoped to the `cron_` prefix: any Schedule
this code owns that the job list does not name is removed. Deletion is safe here precisely because the
sweeping process is the executing process — the list it sweeps against is the same list that defines
what can run. Deletion is also the right verb rather than pause, because run history does not live in
the Schedule: deleting one leaves every past run intact and queryable by the `TemporalScheduledById`
search attribute, bounded only by namespace retention. Verified against a real server — seven runs,
schedule deleted, all seven still present with full history.

**Temporal keeps owning the clock.** Schedules stay. Worker-side timers and a long-running cron
workflow per job were both considered and rejected; the reasoning is recorded below and in the ADR, so
that the next person asking "why not just use timers" gets the measured answer.

**Code is the only control plane for cron.** Pausing, backfilling or editing a Schedule from the
Temporal UI is not a supported operation — reconciliation overwrites the pause flag from the definition
in both directions, and that is the point rather than a documented cost. `pauseOnFailure` is not set,
as the one server-side state change that would contradict it.

**The job list is generated, like the other two registries.** `src/jobs/registry.gen.ts` is written
from `src/jobs/` by the same kind of generator the workflows and subscribers already have, so adding a
job is adding a file.

**Every Worker has a watch-mode dev entrypoint** that regenerates its own registry before booting, so
editing a job or a subscriber changes behaviour the way editing a workflow already did.

What the operator gets that did not exist: a Schedules list with next-fire times that matches the
source tree exactly, a manual trigger, a backfill over a missed window, and a per-run history with the
failure inside it.

## User Stories

### Running the work

1. As a developer, I want scheduled jobs to run on the same durable-execution system as workflows and
   events, so that I have one set of concepts to learn and one UI to look at.
2. As a developer, I want the API process to execute no background work, so that a slow job cannot
   compete with request handling in the process that scheduled it.
3. As a developer, I want to write a cron job as a function that takes the container, so that it can
   query the database and call services exactly like every other piece of backend code.
4. As a developer, I want a cron job to call an existing workflow, so that a nightly cleanup and an
   admin button can share one implementation rather than two.
5. As a developer, I want the workflow a cron job calls to be dispatched identically to the way a route
   handler dispatches it, so that "works from the admin, breaks from cron" is not a class of bug that
   exists.
6. As a developer, I want a job's shape not to change when it graduates from one step to many, so that
   growing a job is an edit to its body rather than a migration of its definition.
7. As a developer, I want one job list to serve both node and workerd, so that adding a job does not
   mean writing it twice.
8. As a developer, I want the cron Worker to be startable and stoppable independently of the API, so
   that restarting one does not interrupt the other.
9. As a developer, I want cron work on its own task queue, so that a long job cannot take slots from a
   shopper's checkout step, and a checkout burst cannot delay a scheduled tick.
10. As a developer, I want the cron Worker to look like the events Worker, so that there is one shape
    for "a Worker that is not the workflow Worker" rather than two inventions.

### Owning the schedules

11. As a backend developer, I want adding a job to `src/jobs/` to create its Schedule and make its
    handler runnable in one step, so that I never have a Schedule the Worker cannot serve.
12. As a backend developer, I want deleting a job file to delete its Schedule, so that the Schedules
    tab reflects the source tree rather than the history of every job that ever existed.
13. As a backend developer, I want renaming a job to remove the old Schedule and create the new one,
    so that a rename is not silently a leak.
14. As a backend developer, I want editing a job's cron expression to take effect on the next deploy
    without a second command, so that the expression in the source file is the expression that fires.
15. As a backend developer, I want `disabled: true` to be the only way to stop a job, so that there is
    exactly one answer to "does this job run" and it is in the diff.
16. As a backend developer, I want flipping `disabled` back to `false` to resume the job on deploy, so
    that enabling is as cheap as disabling.
17. As a developer, I want disabling a job to preserve its schedule in a paused state rather than
    deleting it, so that turning it back on does not lose the record that it existed.
18. As an on-call engineer, I want cron to have one owning process, so that "is the schedule there"
    and "can anything run it" are one question with one answer.
19. As an on-call engineer, I want rolling a deploy back to remove the jobs that deploy added, so that
    a rollback returns cron to the state of the code that is actually running.
20. As an on-call engineer, I want the rollback behaviour written down, so that a Schedule
    disappearing after a rollback is recognised rather than investigated.
21. As a deploy pipeline, I want no ordering constraint between the API and the cron Worker, so that a
    rollout cannot produce a window where schedules exist for jobs nothing can run.
22. As a deploy pipeline, I want cron reconciliation to happen wherever the cron Worker happens to
    start, so that no deploy step can be skipped or run out of order.

### Registering a job

23. As a backend developer, I want adding a job file to register the job, so that there is no
    hand-maintained list to forget to edit.
24. As a backend developer, I want a file in `src/jobs/` that is not a job to be rejected rather than
    skipped, so that a helper module cannot look registered and never run — which for cron also means
    a Schedule swept by the next reconcile.
25. As a backend developer, I want two jobs sharing a name to be a hard error, so that the second
    cannot silently overwrite the first's Schedule under the one `cron_` id they share.
26. As a reviewer, I want the committed registry checked for drift by `verify`, so that a stale list
    cannot reach a deploy.

### The dev loop

27. As a backend developer, I want editing a job's handler locally to change what the next tick does,
    so that iterating on a job feels like iterating on a workflow.
28. As a backend developer, I want a brand-new job file to be picked up locally without restarting a
    pane, so that the dev loop does not depend on remembering which of my six processes is stale.
29. As a backend developer, I want editing a subscriber locally to change what the next delivery does,
    for the same reason.
30. As a backend developer, I want a brand-new subscriber file to be registered locally without a
    manual `subscribers:generate`, so that the events Worker behaves like the workflow Worker.
31. As a backend developer, I want the dev-loop change to leave the production entrypoints untouched,
    so that a watcher never ends up inside a container where filesystem events do not fire.

### Operating it

32. As an operator, I want to see every schedule with its next fire time, so that I can tell at a
    glance what is going to happen and when.
33. As an operator, I want the Schedules tab to list exactly the jobs that this deploy can run, so
    that what I am looking at is the truth.
34. As an operator, I want to trigger a scheduled job by hand, so that I can test it without waiting
    for its next tick or editing its cron expression.
35. As an operator, I want to trigger a job by hand without that trigger being able to pause it, so
    that testing a job in production is not a way to break it.
36. As an operator, I want a job that fails on every tick to keep failing visibly rather than pausing
    itself, so that a broken job is fixed in code rather than silenced by the server.
37. As an operator, I want to backfill a schedule over a window, so that jobs missed during an outage
    can be run deliberately rather than lost or replayed by accident.
38. As an operator, I want a failed run's error visible in the execution history, so that diagnosis
    does not depend on having kept the process's logs.
39. As an operator, I want a run that fails because the Worker does not know the job to say so by
    name, so that a mid-rollout failure is diagnosable from the failure itself.
40. As an operator, I want a job's past runs to survive the deletion of its Schedule, so that removing
    a job does not destroy the evidence of what it did.
41. As an operator, I want to find a deleted job's runs by the Schedule that started them, so that a
    post-mortem does not depend on the Schedule still existing.
42. As an operator, I want a second tick to be skipped while the previous run is still in flight, so
    that a job slower than its interval does not overlap itself.
43. As an operator, I want the overlap decision to account for the *work*, not just its dispatch, so
    that a job whose real work runs elsewhere still cannot overlap itself.
44. As an operator, I want a dead cron Worker to be noticed in about a minute rather than at the end of
    the job's timeout, so that a crash during a long job does not silently suppress every following
    tick.

### Boot, timeouts and clock

45. As a developer, I want a per-job execution timeout, so that a job expected to take an hour is not
    held to the same limit as one expected to take seconds.
46. As a developer, I want the API server to refuse to start when Temporal is unreachable, so that a
    node deployment cannot come up serving routes whose workflows will all fail.
47. As a developer, I want that refusal to be loud and immediate at boot, so that the failure names
    itself instead of arriving later as a timeout inside a checkout.
48. As a developer, I want scripts and tests that only touch the database to keep working without
    Temporal, so that the strictness at the API's boot does not spread to everything that builds a
    container.
49. As a developer, I want cron expressions interpreted in UTC, so that a schedule means the same
    thing regardless of where it runs.

### What the migration removes, and what it must not touch

50. As a developer, I want the BullMQ and Bull Board dependencies gone, so that the tree carries one
    job system rather than two.
51. As a developer, I want the `CronScheduler` port to stop returning framework-specific middleware,
    so that the port describes scheduling rather than what Express needs to render a dashboard.
52. As a developer, I want the test suite's TRUNCATE carve-out for the BullMQ schema removed, so that
    the test database's exceptions shrink rather than accumulate.
53. As a developer, I want the API to stop special-casing `NODE_ENV=test` to avoid stealing its own
    test suite's jobs, so that the reason that guard existed is gone rather than documented.
54. As a reviewer, I want no new runtime dependency, so that the change does not reintroduce a
    scheduling library the migration removed.
55. As a reviewer, I want `JobDefinition` to be untouched by the registration change, so that the
    workerd runtime keeps running the same job list under Cloudflare's triggers.
56. As a reviewer, I want the driver workflow, the activity and the heartbeat untouched by the
    registration change, so that it is about registration and nothing else.
57. As a reviewer, I want the reasoning about why Temporal still owns the clock recorded, so that the
    next person asking "why not just use timers" gets the measured answer.
58. As a reviewer, I want the measured cost of an orphaned Schedule recorded, so that the severity of
    the problem the second pass solves is not overstated later.

### Tests

59. As a developer, I want the scheduler tested against a real Temporal server through the same port
    the BullMQ adapter was tested through, so that the migration is a substitution rather than a
    rewrite of what "tested" means here.
60. As a test author, I want the existing server test to be the place every later behaviour change is
    asserted, so that the suite substitutes behaviour rather than growing a second seam.
61. As a test author, I want a deleted job's Schedule removal asserted against a real server, so that
    the sweep is a tested property rather than a hopeful one.
62. As a test author, I want the sweep asserted to spare a Schedule it does not own, so that the
    prefix rule is proven rather than assumed.

## Implementation Decisions

### The scheduler is a second adapter behind the existing port

`CronScheduler` stays. A Temporal-backed implementation replaces the BullMQ one on node; workerd keeps
its Cloudflare cron dispatcher untouched, as it must — the structural rule forbidding any path from the
workerd entry point to Temporal is what makes this a runtime split rather than a configuration. This is
the same shape as the event bus: one port, adapters chosen by runtime.

`mountMonitor()` is removed from the port. The Temporal UI's Schedules tab is the monitor, and it is
not something this codebase mounts.

### `JobDefinition` does not change

A job is a name, a cron expression, a handler taking the container, and `disabled`. Two additions are
considered and rejected:

- **A declarative `workflow` variant** that would let the driver start the job's workflow as a child.
  Rejected because the input for a real job is usually *fetched* — "every cart abandoned more than a
  day ago" is a query, and a query needs a container, which cannot exist inside the workflow sandbox.
  Worse, constructing the engine's driver input from sandbox code would mean a second copy of dispatch
  logic that the workflow engine's own configuration owns. The recorded exit for when this is wanted
  is below.
- **A `handler` / `workflow` union.** Same reason. The graduation path is the handler's body changing,
  not the definition's type.

`schedule` keeps its existing `CronExpression` enum type. Temporal's schedule spec accepts cron
strings directly, so every existing value carries over unchanged, interpreted as UTC with no timezone
set.

This held across both passes: the second changed which process registers a job, and nothing about what
a job *is*.

### The cron Worker reconciles; the API does not

> **Revised.** The first pass reconciled at API boot, on the reasoning that "the schedules should exist
> whether or not a Worker happens to be running". That is exactly the property that turned out to be
> wrong: a Schedule that exists while nothing can run it is not resilience, it is a lie the Schedules
> tab tells. The first version of this section is preserved in the ADR's superseded paragraphs.

Reconciliation lives in the cron Worker's bootstrap, before it begins polling. The API does not
construct, register or call the `CronScheduler` at all, and the registration key it resolved is removed
from the node container's composition root.

The cron Worker already imports the job list in order to build its activity. Reconciling from the same
import is what makes the two facts — "this Schedule exists" and "this process can run it" —
consequences of one thing.

Nothing else about the Worker changes: same queue, same driver, same activity, same heartbeat.

### Reconciliation is a total desired-state sync over the `cron_` prefix

> **Revised.** The first pass created and updated only, and listed orphan sweeping as out of scope
> because "sweeping needs a rule about what else may own a schedule in this namespace, and there is not
> one yet". There is one, and it was there all along: the prefix `cronScheduleId()` stamps.

`start(jobs)` creates each job's Schedule or updates it to match, then sweeps. It lists the namespace's
Schedules, keeps those whose id carries the `cron_` prefix, and deletes any the job list does not name.
Schedules without that prefix are not this code's and are never touched.

Deletion, not pause: a paused orphan is indistinguishable in the UI from a deliberately disabled job,
and run history does not live in the Schedule, so nothing is lost by removing it.

The sweep runs even when a reconcile failed, because a failure cannot make it delete something it
should not — what survives is decided by the job *list*, not by the outcomes.

`remove()` keeps its semantics: absent is the desired state, so a Schedule that is already gone is not
an error.

Schedule identity is derived from the job name, as it was with BullMQ's scheduler key. Policies:

- **Overlap: skip.** The behaviour the BullMQ adapter documented as desired and got implicitly from
  the library. On Temporal it is a stated policy, changeable per job if one ever wants buffering.
- **Catchup window:** left at the server default.

### The definition is authoritative, including the pause flag

Every reconcile writes `paused` from `disabled`, so disabling pauses and enabling unpauses. The warning
logged when reconciliation overrules a server-side pause is kept — it is the trace of a UI action being
undone — but as of the second pass it documents an unsupported operation rather than an accepted cost.

### `pauseOnFailure` is removed

> **Revised.** The first pass set it, and listed it as one of the capabilities Temporal gave that
> BullMQ had not. It was the right read of the server's feature set and the wrong fit for this
> codebase's control plane.

The Schedule is created without it. Two reasons: it is the only cron state that cannot be expressed in
the source tree, which the control-plane decision rules out; and because reconciliation runs only at
boot, a pause applied after the last Worker of a rollout has started is never undone, so a transient
mid-rollout failure can stop a job indefinitely.

The behaviour it guarded — a job failing every minute filling up history — is bounded by namespace
retention and is now visible rather than silenced.

Measured detail worth recording: `pauseOnFailure` only ever tripped on *scheduled* runs. Three
consecutive failures from manual `trigger()` calls paused nothing.

### The job list is generated

> **Added in the second pass**, after the rest of it. `src/jobs/index.ts` was the last hand-written
> registry of the three.

`scripts/generate-job-registry.ts` writes `src/jobs/registry.gen.ts` from `src/jobs/`, on the
subscriber generator's model: one `export const config` per file, carrying a name the generator can
read without running it. Static imports rather than a directory scan, for the three reasons the other
two generators exist — the handler closures have to be in the process that runs them, `tsx --watch`
reloads off that module graph, and `tsc` and `check:structure` cannot follow a scan.

This list carries more weight than the other two, and the rules follow from that. It is not only the
set of handlers that can run; it is the **desired state reconciliation deletes against**, so a job file
the generator quietly skipped would have its Schedule *swept* rather than merely go unrun. Hence:

- a file in `src/jobs/` the generator cannot read is **rejected**, not passed over;
- two jobs of one name are a **hard error** — both reconcile to one `cron_` id, and the second would
  silently overwrite the first;
- `check:job-registry` joins the workflow and subscriber checks in `verify`'s `generated` gate.

### Rolling back removes the jobs the rolled-back deploy added

A consequence of desired-state reconciliation, and correct: the jobs that exist are the jobs the
running code defines. It is called out because a Schedule vanishing after a rollback otherwise looks
like data loss.

The narrow race this leaves is two Worker versions reconciling concurrently during a rollout, which
self-heals on the next boot of the newer version. It is accepted rather than solved; solving it needs
leader election, which is a larger decision than this spec.

### The cron Worker is a third process

It polls a cron task queue of its own and is registered nowhere else. It follows the events Worker
closely enough that the differences are the interesting part:

| | events Worker | cron Worker |
| --- | --- | --- |
| Task queue | events queue | cron queue |
| Workflow engine pin | `temporal` | `temporal` |
| Event bus pin | `temporal` | `temporal` |
| Registers workflows | no — activity only | **yes, one** |
| Writes server state at boot | no | **yes — reconciles every Schedule** |

The fourth row is forced: a Schedule's action can only start a *workflow*, never a standalone activity.
So unlike the events Worker, this one bundles a workflow path — a single driver whose whole body is one
activity invocation. The fifth is the second pass's doing.

The `temporal` engine pin is what makes a handler's `.run()` call become a durable execution on the
workflow queue rather than running inline. The events Worker's reasoning applies verbatim: a cron
handler calling `.run()` is the *entry* to a workflow and should get a durable execution like any other
entry point.

The cron driver workflow takes the job name and the job's timeout. It does not take the handler, the
container, or anything that cannot survive serialization.

### Queue split by lifecycle; priority, not queues, for urgency

Cron gets a queue because it is a separate process with a separate lifecycle and a tick that must not
be starved — the axis Temporal's own guidance endorses for adding a queue, alongside resource
requirements and rate limits.

It does **not** get one per trigger source. "Admin-triggered vs customer-triggered" is the case
Temporal steers to `priorityKey` on a shared queue: one line, no process, adjustable without a deploy,
and inherited automatically by the execution's activities and child workflows. The event bus already
sets priority and fairness keys per event; the workflow engine gaining a priority map keyed by workflow
name is the symmetric change, and it is **not part of this spec** — it is named here so the queue count
does not grow by reflex later.

### Heartbeat from the wrapper, and a per-job timeout

Absent a heartbeat, Temporal cannot detect a dead Worker before the activity's start-to-close timeout
elapses. With a long timeout and overlap-skip, one crash suppresses every following tick for the
remainder of that window, while the UI shows a run that looks healthy.

The activity that invokes the handler therefore heartbeats on an interval while the handler runs, and
declares a heartbeat timeout short enough that death is noticed in about a minute. The heartbeat is the
wrapper's, not the handler's: threading Temporal's activity context into `JobDefinition` would put a
node-only runtime concern into the type workerd also uses.

`JobDefinition` gains **no** timeout field; the timeout is the scheduler's configuration, defaulting to
the five minutes both existing adapters use, with per-job overrides expressed where the scheduler is
constructed — the same place per-step retry policies are already expressed for the workflow engine.

### The API refuses to boot without Temporal

On node, every workflow dispatch goes over gRPC, so an API that starts with Temporal unreachable is an
API whose checkouts will all fail. Bootstrap performs a reachability check and fails the start.

The check lives in the API server's startup path, **not** in the workflow engine factory. The engine's
lazy connection exists so that scripts and tests which only touch the database do not need a Temporal
server, and that property is kept. The check itself follows the events Worker's preflight shape: a
small module taking an injected probe, so it is testable without a server.

Reachability of the frontend service is what is checked. Whether a Worker is actually polling is a
different question with a different answer — a Worker restarting must not take the API down — and is
out of scope. Note that after the second pass the API no longer reconciles anything, so this check
guards route dispatch and event publication rather than cron.

### The dev loop mirrors the workflow Worker's, for all three

> **Revised** within the second pass itself. The draft called for cron to need "only the watcher",
> because its job list was hand-written and already in the Worker's module graph. Generating that list
> removed the asymmetry: all three Workers now have the same shape.

Each Worker gets a `:dev` twin — `worker:dev`, `worker:events:dev`, `worker:cron:dev` — which
regenerates its own registry and then imports the production entrypoint, under `tsx watch` with:

- an `--include` over the source directory, which is what makes a *brand new* file reload at all: the
  watcher otherwise only follows modules already in the graph, and a file nothing imports yet is by
  definition not in it;
- an `--exclude` on the generated file, or writing it would restart the Worker that just wrote it.

The generator runs as a child process rather than an import, so the Worker never carries a parser into
its own module graph. A failure is fatal — and for cron especially, since booting on a stale registry
would delete the missing jobs' Schedules rather than merely fail to run them.

All three are **new** scripts rather than changes to the existing ones. The existing scripts are the
`command:` of the compose services, and a watcher inside a container silently never fires — the bind
mount carries writes but not filesystem events. The dev task definitions and the dev-stack
documentation move to the new scripts; the compose services do not.

### What is deleted

The BullMQ adapter and its test; the `bullmq`, `@bull-board/api` and `@bull-board/express`
dependencies; the Bull Board mount on the Express app; `mountMonitor` from the port; the BullMQ schema
carve-out in the test suite's TRUNCATE; and the `NODE_ENV=test` guard that existed because the API ran
a Worker for a queue the test suite also polled.

The second pass adds: the scheduler's registration in the node container, `ContainerRegistrationKeys.SCHEDULER`,
the API's `scheduler.start(jobs)` call and its shutdown, `policies.pauseOnFailure`, and the
hand-written `src/jobs/index.ts`.

### The recorded exit

When a job appears that is long-running or wide enough that awaiting it from an activity is wrong — the
failure being that a Worker restart fails the cron run while the dispatched work completes, so the next
tick runs it again — the cron driver gains a branch: start the job's workflow as a **child** on the
workflow queue instead of invoking the handler activity. A child's parent reattaches after a restart,
holds no slot while it waits, and keeps the schedule's outcome equal to the work's outcome.

Two things make this additive rather than a redesign. Branching on workflow *input* is replay-safe, so
adding it does not endanger executions in flight. And the driver input can be assembled by the
scheduler at reconciliation time — in Node, where the engine's configuration lives — and passed as the
schedule's action argument, which is what removes the need to reconstruct dispatch logic inside the
sandbox. A job wanting this variant queries for itself in its first step, so its input is empty and the
"input must be static at schedule time" objection does not bite.

It is not built now because no job exists to shape it.

### Rejected: removing Temporal from the clock

Recorded because it was the second pass's starting proposal. Worker-side timers would remove the
Schedule and with it the orphan question, but they need a cron parser dependency that left the tree
with BullMQ, they fire once per replica unless deduplicated by a per-tick workflow id, and they lose
any tick during a restart with no record that one was owed. A long-running workflow per job is more
server state, not less, and puts determinism and versioning constraints on code that is currently free
of them.

The property actually wanted was never statelessness — the event bus is not stateless either; it
deduplicates on server-side activity ids. It is that the state be shaped like an *occurrence* rather
than a *definition*, so it expires on its own and cannot drift from the source tree. Cron's state is
definition-shaped by nature, so the answer is to reconcile it totally from one process rather than to
eliminate it.

### Rejected: an archived state for retired Schedules

There is none. The whole handle surface is describe, update, delete, trigger, backfill, pause and
unpause; a Schedule is running or paused. Temporal's Archival is a namespace-level feature for closed
workflow histories going to blob storage, is marked experimental, is explicitly unsupported when
running Temporal through Docker, and is disabled in this namespace. It is not a schedule state.

It is also unnecessary: run history survives deletion and is bounded by retention either way, so
keeping a dead Schedule buys nothing.

### ADR

**ADR-0029**, written in the first pass, records: why cron is a Temporal Schedule rather than a
repeatable job; why cron gets a task queue and a process while urgency gets a priority key; why the
cron handler stays ordinary Node code outside the sandbox and what that costs; and the exit above, so
that the next person to want a child workflow finds the reasoning rather than re-deriving it.

The second pass **amends it rather than superseding it** — the decision it records, cron as a Temporal
Schedule on a Worker of its own, stands. What changes is the owning process, the completeness of
reconciliation, `pauseOnFailure`, the generated job list, and the status of its "pause survives only
until the next boot" trade, which becomes a stated non-goal. The measured orphan cost and the rejected
alternatives above belong in it, so the next reader gets the numbers rather than the argument. The
paragraphs the amendment overturns are struck through in place rather than deleted.

## Testing Decisions

A good test here asserts what the scheduler and the Temporal server actually do, not how the adapter is
built: which Schedules exist after reconciling a list, what state they are in, and whether a run
reaches the handler. None of it needs to know how the adapter is assembled, and most of it is the
*server's* behaviour — the schedule spec is its decoding of a cron string, overlap is a policy it
enforces, a start-to-close timeout is a clock it runs, and a dead Worker being noticed at all is it
acting on missing heartbeats. Asserting any of that against a double is asserting the test's own
arithmetic, which the event bus's server test already says in so many words.

**One primary seam, across both passes: the `CronScheduler` port.** The BullMQ test drove exactly this
— construct the adapter, start it with a job list, cause a job to run, observe the handler. The
Temporal test replaced it at the same seam, so the migration substituted an implementation rather than
redefining what is tested; the second pass then added assertions to that same file rather than growing
a second one.

The prior art to follow is the event bus's server test, not the workflow engine's: it boots a full dev
server rather than the time-skipping one, claims task queues of its own so nothing else on the server
can steal its tasks, runs real Workers with the real payload converter, and observes runs through
recording handlers. Schedules are a server feature, so the full server is required for the same reason
standalone activities needed it.

What that seam covers after both passes:

- A scheduled job produces a schedule whose spec and overlap policy match what the job declared, and
  which carries no `pauseOnFailure`.
- A job marked disabled ends up paused rather than firing.
- A manually triggered action runs the handler — the whole path, driver workflow through activity to
  the container-taking function, on a real Worker.
- A handler that outruns its timeout fails the run rather than hanging.
- A handler that blocks while its Worker is shut down abruptly has its run declared failed within
  roughly the heartbeat timeout, not the far longer start-to-close timeout. This is the assertion that
  makes the heartbeat wrapper a tested property rather than a hopeful one; without it the heartbeat
  could be deleted and every other test would stay green.
- A run whose job the Worker does not know fails by name and non-retryably.
- Reconciling a list that no longer names a previously scheduled job removes that job's Schedule. The
  mutation that must fail it: keep the reconcile-only `start()`, and the Schedule is still there.
- The sweep spares a Schedule whose id does not carry the prefix. A neighbouring Schedule created under
  another id must survive a reconcile that names neither — otherwise the test passes against a sweep
  that deletes everything.
- A job whose *scheduled* run fails is still unpaused afterwards. This is the one assertion that needs
  a real tick rather than a manual trigger, because a manual trigger never tripped the flag in the
  first place.
- The pause direction, both ways: disabled pauses, enabled unpauses, and reconciliation overrules a
  hand-applied pause.

Triggering by hand rather than waiting for a tick is what keeps this suite fast, and it removes the
polling-with-a-ten-second-timeout loop the BullMQ test needed to observe a once-a-minute schedule. The
one exception is the assertion above that requires a scheduled action.

**A second seam: the boot-time reachability preflight.** It is a small module taking an injected probe,
mirroring the events Worker's standalone-activity preflight, so both the reachable and unreachable
paths are asserted without a server. The API's `start()` has no tests today and neither pass adds the
infrastructure to give it one; the preflight is extracted precisely so the decision it encodes is
testable where it lives.

Because the primary suite needs a Temporal server, it belongs with the other server-dependent tests —
run by the Temporal test command, excluded from the default verification gate, which continues to work
for a checkout that has not started Temporal. The preflight test has no such dependency and runs in the
default suite.

What is deliberately not tested:

- **That the cron Worker reconciles at boot.** It is composition-root wiring, the same class of thing
  as the registration it replaces, and asserting it means asserting that a process starts. The port
  test covers what reconciliation *does*.
- **The watch-mode scripts.** Tooling, with no assertion that would fail for the right reason. Verified
  instead by the repo's own practice for gates: make the change, add a job file, confirm the Worker
  reloads, then confirm it does not when the flag is removed — and say so in the PR. The same practice
  covers the job generator's three failure modes, each of which was reintroduced and observed to fail.

The API's `start()` loses its call to the scheduler in the second pass; no test covers that path and
neither pass adds one. Its removal is visible in the boot sequence and in the node container no longer
registering the key.

## Out of Scope

- **Any UI-driven control as a supported operation.** Pausing, backfilling or editing a Schedule from
  the Temporal UI stays possible and stays unsupported: reconciliation will overwrite it. Making UI
  state durable — a three-way merge against a last-applied marker in the Schedule's memo, or any
  similar scheme — is a separate decision.
- **Leader election among cron Workers.** The concurrent-reconcile race during a rollout is accepted.
- **Priority keys on the workflow engine.** Named in the decisions so the queue count does not grow by
  reflex, but a separate change with its own motivation.
- **The child-workflow variant of the cron driver.** Recorded as an exit with its design; not built.
- **Worker liveness checking at API boot.** Frontend reachability only.
- **Cleanup for subscribers.** There is no server-side registration to clean up; a subscriber's only
  server state is per-delivery and expires on its own. Removing a subscriber is already complete.
- **Schedules in the namespace that this code did not create.** The sweep is scoped by prefix and will
  not touch them.
- **Namespace retention or Archival configuration.** Both are deployment concerns, and Archival is
  unavailable under Docker regardless.
- **workerd.** Cloudflare keeps its cron triggers, and the wrangler cron list keeps being hand-synced
  with the job list. Nothing in either pass improves or worsens that.
- **Backfill and trigger as application features.** They are Temporal UI and CLI operations. No admin
  route wraps them.
- **Writing actual cron jobs.** The heartbeat job stays disabled. This ships with the same zero enabled
  jobs it started with.
- **Worker Versioning**, which remains the outstanding follow-up it already was.

> **No longer out of scope.** The first pass listed **orphan schedule sweeping** here, on the grounds
> that "the project is not in production and a stale local schedule is a `temporal schedule delete`
> away". The second pass does it, once the owning process made it safe.

## Further Notes

The migration was unusually cheap *at the time* and gets more expensive with every job written: one
adapter, one test, three dependencies, one Express mount, one line of test-infrastructure prose. That
timing was the main argument for doing it before the first real job existed rather than after. The same
argument applies to the second pass: with zero enabled jobs, changing who owns registration cost
nothing that a running fleet would have made expensive.

The dev stack grows from five processes to six. The stack description, the VS Code task, the README
topology table and the e2e fixture's port and queue map all list processes and queues explicitly, and
each needs the new one.

Temporal's own documentation now recommends Schedules over the older cron-schedule workflow option;
this uses Schedules, and the legacy option is not considered.

One consequence worth stating plainly: node's scheduled work depends on Temporal being up, where it
previously depended on Postgres being up — and Postgres is up anyway. That is a real increase in what
has to be running for cron to fire. It is accepted because the same deployment already needs Temporal
for every workflow, so the dependency is not new to the deployment, only new to cron.

### Measured, not inferred

Everything the second pass asserts was measured against a running dev stack, during review or during
implementation:

- A job added to `src/jobs/` produced a Schedule within seconds and then failed on every tick against a
  cron Worker started before it existed, while a pre-existing job on the same Worker completed on every
  tick.
- An orphaned Schedule fired once, failed, and was paused by the server after exactly one scheduled
  run; a reconcile whose list did not name it left it paused and untouched.
- `pauseOnFailure` did not trip on three consecutive manual triggers, only on a scheduled run.
- Deleting a Schedule left all seven of its past runs intact and queryable by `TemporalScheduledById`.
  Local namespace retention is three days.
- A brand-new workflow file was added to the generated registry unprompted and executed on a Worker
  that was never restarted; an edit to its body changed the result of the next invocation.
- After the change: the cron Worker's boot sweep removed a real orphan left on the server by the review
  session, and dropping a job file into `src/jobs/` regenerated the registry, restarted the Worker and
  created its Schedule — with deleting the file reversing all three. Without the `--include` flag, the
  same new file produced no restart at all.

### Tracker note

The second pass was drafted as its own spec at `.scratch/cron-registration/spec.md` and has been merged
into this file, which is now the single working record for cron on Temporal. `.scratch/` is what
AGENTS.md names as this repo's issue tracker in place of GitHub Issues; the house convention is the
`**Status:**` line at the top.
