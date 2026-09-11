# Cron on Temporal Schedules

**Status:** planned.

**Goal:** scheduled work is a Temporal Schedule starting a workflow on a cron Worker of its own,
instead of a BullMQ repeatable job running inside the API process. After this, node has one
durable-execution system rather than two job systems, the API process executes no background work,
and a scheduled run is visible, triggerable, pausable and backfillable in the Temporal UI.

**Scope:** the `CronScheduler` port and its adapter, a third Worker process and its task queue, the
API server's bootstrap, the three BullMQ/Bull Board dependencies, the dev stack's process list, and
one ADR. `JobDefinition` does not change. The workerd runtime does not change.

---

## Problem Statement

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

## Solution

A Temporal Schedule per job, whose action starts a cron driver workflow on a task queue polled by a
third Worker process. The driver invokes one activity, which resolves the job's handler and calls it
with the container — ordinary Node code with a database, exactly as a subscriber is today.

`JobDefinition` keeps its shape: a name, a cron expression, a handler taking the container, and a
`disabled` flag. That is what makes one job list serve both runtimes — workerd continues to run the
same handlers under Cloudflare cron triggers, unaware that node's side changed.

A job that grows past one step does not change shape either. Its handler stops *doing* the work and
starts *dispatching* it: fetch whatever inputs the work needs from the database, then call a
`createWorkflow` definition through the workflow engine port. Because the cron Worker pins the
`temporal` engine, that call becomes a durable execution on the workflow task queue — the same
execution an admin route would get from the same `.run()` call. One workflow, two entry points, no
divergence.

What the operator gets that did not exist: a Schedules list with next-fire times, a manual trigger, a
backfill over a missed window, pause-on-failure, and a per-run history with the failure inside it.

## User Stories

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
11. As an operator, I want to see every schedule with its next fire time, so that I can tell at a
    glance what is going to happen and when.
12. As an operator, I want to trigger a scheduled job by hand, so that I can test it without waiting
    for its next tick or editing its cron expression.
13. As an operator, I want to pause a schedule, so that I can stop a misbehaving job without a deploy.
14. As an operator, I want a schedule to pause itself after a failed run, so that a job failing every
    minute does not fill the history before I notice.
15. As an operator, I want to backfill a schedule over a window, so that jobs missed during an outage
    can be run deliberately rather than lost or replayed by accident.
16. As an operator, I want a failed run's error visible in the execution history, so that diagnosis
    does not depend on having kept the process's logs.
17. As an operator, I want a second tick to be skipped while the previous run is still in flight, so
    that a job slower than its interval does not overlap itself.
18. As an operator, I want the overlap decision to account for the *work*, not just its dispatch, so
    that a job whose real work runs elsewhere still cannot overlap itself.
19. As an operator, I want a dead cron Worker to be noticed in about a minute rather than at the end of
    the job's timeout, so that a crash during a long job does not silently suppress every following
    tick.
20. As a developer, I want a per-job execution timeout, so that a job expected to take an hour is not
    held to the same limit as one expected to take seconds.
21. As a developer, I want the API server to refuse to start when Temporal is unreachable, so that a
    node deployment cannot come up serving routes whose workflows will all fail.
22. As a developer, I want that refusal to be loud and immediate at boot, so that the failure names
    itself instead of arriving later as a timeout inside a checkout.
23. As a developer, I want scripts and tests that only touch the database to keep working without
    Temporal, so that the strictness at the API's boot does not spread to everything that builds a
    container.
24. As a developer, I want cron expressions interpreted in UTC, so that a schedule means the same
    thing regardless of where it runs.
25. As a developer, I want disabling a job to preserve its schedule in a paused state, so that turning
    it back on does not lose the record that it existed.
26. As a developer, I want the BullMQ and Bull Board dependencies gone, so that the tree carries one
    job system rather than two.
27. As a developer, I want the `CronScheduler` port to stop returning framework-specific middleware,
    so that the port describes scheduling rather than what Express needs to render a dashboard.
28. As a developer, I want the test suite's TRUNCATE carve-out for the BullMQ schema removed, so that
    the test database's exceptions shrink rather than accumulate.
29. As a developer, I want the API to stop special-casing `NODE_ENV=test` to avoid stealing its own
    test suite's jobs, so that the reason that guard existed is gone rather than documented.
30. As a developer, I want the scheduler tested against a real Temporal server through the same port
    the BullMQ adapter was tested through, so that the migration is a substitution rather than a
    rewrite of what "tested" means here.

## Implementation Decisions

### The scheduler is a second adapter behind the existing port

`CronScheduler` stays. A Temporal-backed implementation replaces the BullMQ one on node; workerd keeps
its Cloudflare cron dispatcher untouched, as it must — the structural rule forbidding any path from
the workerd entry point to Temporal is what makes this a runtime split rather than a configuration.
This is the same shape as the event bus: one port, adapters chosen by runtime.

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

### One schedule per job, reconciled at API boot

The API server reconciles schedules on startup: create each enabled job's schedule, update it if the
spec already exists, and pause the disabled ones. Deletion happens only for a job explicitly marked
disabled — sweeping orphans is out of scope, per below.

Schedule identity is derived from the job name, as it is today with BullMQ's scheduler key. Policies:

- **Overlap: skip.** This is the behaviour the BullMQ adapter documented as desired and got implicitly
  from the library. On Temporal it is a stated policy, and it becomes changeable per job if one ever
  wants buffering instead.
- **Pause on failure: on.** New capability with no BullMQ analogue.
- **Catchup window:** left at the server default.

Reconciliation lives with the API's composition root rather than the cron Worker's, so that the
schedules exist whether or not a Worker happens to be running.

### The cron Worker is a third process

It polls a cron task queue of its own and is registered nowhere else. It follows the events Worker
closely enough that the differences are the interesting part:

| | events Worker | cron Worker |
| --- | --- | --- |
| Task queue | events queue | cron queue |
| Workflow engine pin | `temporal` | `temporal` |
| Event bus pin | `temporal` | `temporal` |
| Registers workflows | no — activity only | **yes, one** |

The last row is forced: a Schedule's action can only start a *workflow*, never a standalone activity.
So unlike the events Worker, this one bundles a workflow path — a single driver whose whole body is
one activity invocation.

The `temporal` engine pin is what makes a handler's `.run()` call become a durable execution on the
workflow queue rather than running inline. The events Worker's reasoning applies verbatim: a cron
handler calling `.run()` is the *entry* to a workflow and should get a durable execution like any
other entry point.

The cron driver workflow takes the job name and the job's timeout. It does not take the handler, the
container, or anything that cannot survive serialization.

### Queue split by lifecycle; priority, not queues, for urgency

Cron gets a queue because it is a separate process with a separate lifecycle and a tick that must not
be starved — the axis Temporal's own guidance endorses for adding a queue, alongside resource
requirements and rate limits.

It does **not** get one per trigger source. "Admin-triggered vs customer-triggered" is the case
Temporal steers to `priorityKey` on a shared queue: one line, no process, adjustable without a deploy,
and inherited automatically by the execution's activities and child workflows. The event bus already
sets priority and fairness keys per event; the workflow engine gaining a priority map keyed by
workflow name is the symmetric change, and it is **not part of this spec** — it is named here so the
queue count does not grow by reflex later.

### Heartbeat from the wrapper, and a per-job timeout

Absent a heartbeat, Temporal cannot detect a dead Worker before the activity's start-to-close timeout
elapses. With a long timeout and overlap-skip, one crash suppresses every following tick for the
remainder of that window, while the UI shows a run that looks healthy.

The activity that invokes the handler therefore heartbeats on an interval while the handler runs, and
declares a heartbeat timeout short enough that death is noticed in about a minute. The heartbeat is
the wrapper's, not the handler's: threading Temporal's activity context into `JobDefinition` would put
a node-only runtime concern into the type workerd also uses.

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
out of scope.

### What is deleted

The BullMQ adapter and its test; the `bullmq`, `@bull-board/api` and `@bull-board/express`
dependencies; the Bull Board mount on the Express app; `mountMonitor` from the port; the BullMQ schema
carve-out in the test suite's TRUNCATE; and the `NODE_ENV=test` guard that existed because the API ran
a Worker for a queue the test suite also polled.

### The recorded exit

When a job appears that is long-running or wide enough that awaiting it from an activity is wrong —
the failure being that a Worker restart fails the cron run while the dispatched work completes, so the
next tick runs it again — the cron driver gains a branch: start the job's workflow as a **child** on
the workflow queue instead of invoking the handler activity. A child's parent reattaches after a
restart, holds no slot while it waits, and keeps the schedule's outcome equal to the work's outcome.

Two things make this additive rather than a redesign. Branching on workflow *input* is replay-safe, so
adding it does not endanger executions in flight. And the driver input can be assembled by the
scheduler at reconciliation time — in Node, where the engine's configuration lives — and passed as the
schedule's action argument, which is what removes the need to reconstruct dispatch logic inside the
sandbox. A job wanting this variant queries for itself in its first step, so its input is empty and the
"input must be static at schedule time" objection does not bite.

It is not built now because no job exists to shape it.

### ADR

One ADR records: why cron is a Temporal Schedule rather than a repeatable job; why cron gets a task
queue and a process while urgency gets a priority key; why the cron handler stays ordinary Node code
outside the sandbox and what that costs; and the exit above, so that the next person to want a child
workflow finds the reasoning rather than re-deriving it.

## Testing Decisions

A good test here asserts what the scheduler and the Temporal server actually do, not how the adapter
is built. The three properties worth asserting — a schedule exists with the spec and policies it was
given, a triggered action really reaches the handler, and a dead Worker is noticed promptly — are all
observable from outside, and two of them are the *server's* behaviour rather than this code's. Testing
them against a double would be asserting the test's own arithmetic, which the event bus's server test
already says in so many words.

**One primary seam: the `CronScheduler` port.** The BullMQ test drives exactly this — construct the
adapter, start it with a job list, cause a job to run, observe the handler. The Temporal test replaces
it at the same seam, so the migration substitutes an implementation rather than redefining what is
tested.

The prior art to follow is the event bus's server test, not the workflow engine's: it boots a full dev
server rather than the time-skipping one, claims a task queue of its own so nothing else on the server
can steal its tasks, runs a real Worker with the real payload converter, and observes deliveries
through a recording handler. Schedules are a server feature, so the full server is required for the
same reason standalone activities needed it.

What that seam covers:

- A scheduled job produces a schedule whose spec, overlap policy and pause-on-failure match what the
  job declared.
- A job marked disabled ends up paused rather than firing.
- A manually triggered action runs the handler — the whole path, driver workflow through activity to
  the container-taking function, on a real Worker.
- A handler that outruns its timeout fails the run rather than hanging.
- A handler that blocks while its Worker is shut down abruptly has its run declared failed within
  roughly the heartbeat timeout, not the far longer start-to-close timeout. This is the assertion that
  makes the heartbeat wrapper a tested property rather than a hopeful one; without it the heartbeat
  could be deleted and every other test would stay green.

Triggering by hand rather than waiting for a tick is what keeps this suite fast, and it removes the
polling-with-a-ten-second-timeout loop the BullMQ test needed to observe a once-a-minute schedule.

**A second seam: the boot-time reachability preflight.** It is a small module taking an injected probe,
mirroring the events Worker's standalone-activity preflight, so both the reachable and unreachable
paths are asserted without a server. The API's `start()` has no tests today and this spec does not add
the infrastructure to give it one; the preflight is extracted precisely so the decision it encodes is
testable where it lives.

Because the primary suite needs a Temporal server, it belongs with the other server-dependent tests —
run by the Temporal test command, excluded from the default verification gate, which continues to work
for a checkout that has not started Temporal. The preflight test has no such dependency and runs in the
default suite.

## Out of Scope

- **Orphan schedule sweeping.** Renaming or deleting a job leaves its old schedule on the server. The
  project is not in production and a stale local schedule is a `temporal schedule delete` away.
- **Priority keys on the workflow engine.** Named in the decisions so the queue count does not grow by
  reflex, but a separate change with its own motivation.
- **The child-workflow variant of the cron driver.** Recorded as an exit with its design; not built.
- **Worker liveness checking at API boot.** Frontend reachability only.
- **workerd.** Cloudflare keeps its cron triggers, and the wrangler cron list keeps being hand-synced
  with the job list. Nothing in this spec improves or worsens that.
- **Backfill, trigger and pause as application features.** They are Temporal UI and CLI operations. No
  admin route wraps them.
- **Writing actual cron jobs.** The heartbeat job stays disabled. This migration ships with the same
  zero enabled jobs it started with.
- **Worker Versioning**, which remains the outstanding follow-up it already was.

## Further Notes

The migration is unusually cheap *right now* and gets more expensive with every job written: one
adapter, one test, three dependencies, one Express mount, one line of test-infrastructure prose. That
timing is the main argument for doing it before the first real job exists rather than after.

The dev stack grows from five processes to six. The stack description, the VS Code task, the README
topology table and the e2e fixture's port and queue map all list processes and queues explicitly, and
each needs the new one.

Temporal's own documentation now recommends Schedules over the older cron-schedule workflow option;
this spec uses Schedules, and the legacy option is not considered.

One consequence worth stating plainly: after this, a node deployment's scheduled work depends on
Temporal being up, where today it depends on Postgres being up — and Postgres is up anyway. That is a
real increase in what has to be running for cron to fire. It is accepted because the same deployment
already needs Temporal for every workflow, so the dependency is not new to the deployment, only new to
cron.
