# Cron registration belongs to the cron Worker

**Status:** planned.

**Goal:** changing the job list — adding, editing or deleting a job — takes effect on deploy, in one
process, with nothing left behind. After this, no two processes have to agree about what jobs exist,
a removed job's Schedule is removed with it, and the source tree is the only control plane for cron.

**Scope:** the `CronScheduler` port's reconciliation semantics, which process owns it, the cron
Worker's bootstrap, the API server's bootstrap, `pauseOnFailure`, the dev-loop scripts for the cron
and events Workers, and an amendment to ADR-0029. `JobDefinition` does not change. The driver
workflow, the activity and the heartbeat do not change. The workerd runtime does not change. No new
dependency.

---

## Problem Statement

Two processes have to agree about the job list, and nothing makes them.

The API reconciles Schedules at boot; the cron Worker executes the runs those Schedules start. They
are deployed independently and hold the list in different places — the API writes server-side state
from `src/jobs/`, the cron Worker holds the same list in process memory. When they disagree, the
failure is quiet and the UI actively misleads: the Schedules tab lists the job with its next fire
times, because the schedule is exactly what the API created, while every run fails with `No job is
registered as "…" on this Worker`. An operator reading that tab sees a healthy job.

This was reproduced during review. A job added to `src/jobs/` produced a Schedule within seconds —
the API runs under `tsx --watch` — and then failed on every tick against a cron Worker that had been
started before the job existed. Over the same period the pre-existing job on the same Worker
completed on every tick. One Worker, two jobs, opposite outcomes, decided entirely by which deploy
the Worker's memory came from.

**Deleting a job leaves its Schedule behind.** `start()` only touches jobs the list names, so a
removed job's Schedule survives every subsequent boot. Measured behaviour of one such orphan: it
fires once, fails, and the server pauses it via `pauseOnFailure`; a reconcile whose job list does not
name it leaves it untouched. So the standing cost is one failed run and an inert paused row — not a
runaway, but a row that accumulates per deleted job and that nothing will ever clean up. The adapter
documents this as deliberate, on the grounds that sweeping needs a rule about what else may own a
Schedule in the namespace and there isn't one. There is one: every Schedule this code creates is
named by `cronScheduleId()`, which stamps a `cron_` prefix.

**`pauseOnFailure` can wedge a job permanently.** It is also the one piece of cron state that cannot
be expressed in the source tree. During a rolling deploy an old replica can claim a newly added job's
first tick, fail it with `No job is registered`, and pause the Schedule. Reconciliation would unpause
it — but reconciliation only runs at boot, so if the rollout has finished, the new job is paused
indefinitely with no code change that explains it.

**Editing a job does not change its behaviour without a manual restart.** The workflow Worker runs
under `tsx watch --include 'src/workflows/**'` through a dev entrypoint that regenerates its
registry, so a brand-new workflow file is live within seconds — verified during review: a new
workflow file appeared in the generated registry unprompted, ran, and picked up an edit to its body
across two invocations without the Worker being restarted. The cron and events Workers run their
production entrypoints directly, with no watcher, so both hold whatever list they imported at start.
For cron this is worse than stale code: the API *does* reconcile on save, so a changed cron
expression takes effect while the changed handler does not.

## Solution

**The cron Worker owns cron, end to end.** The process that holds the job list becomes the process
that writes the Schedules and runs the handlers. The API stops touching cron entirely. A Schedule
that exists without a Worker able to run it stops being a deploy-ordering rule nobody wrote down and
becomes structurally impossible: the same import, in the same process, produces both.

**Reconciliation becomes total.** Create, update and *delete*, scoped to the `cron_` prefix: any
Schedule this code owns that the job list does not name is removed. Deletion is safe here precisely
because the sweeping process is the executing process — the list it sweeps against is the same list
that defines what can run. Deletion is also the right verb rather than pause, because run history
does not live in the Schedule: deleting one leaves every past run intact and queryable by the
`TemporalScheduledById` search attribute, bounded only by namespace retention. This was verified
against a real server — seven runs, schedule deleted, all seven still present with full history.

**Temporal keeps owning the clock.** Schedules stay. The alternatives were considered and rejected:
worker-side timers remove the Schedule but need a cron parser dependency, fire once per replica, and
lose any tick that falls during a restart; a long-running cron workflow per job is *more* server
state than a Schedule plus a determinism and versioning burden on code that is currently exempt from
both.

**Code is the only control plane for cron.** Pausing, backfilling or editing a Schedule from the
Temporal UI is not a supported operation — reconciliation overwrites the pause flag from the
definition in both directions, and under this decision that stops being a documented cost and becomes
the point. `pauseOnFailure` is removed, as the one server-side state change that contradicts it.

**The dev loop matches the workflow Worker's.** The cron and events Workers get watch-mode dev
entrypoints of their own, so editing a job or a subscriber changes behaviour the way editing a
workflow already does.

## User Stories

1. As a backend developer, I want adding a job to `src/jobs/` to create its Schedule and make its
   handler runnable in one step, so that I never have a Schedule the Worker cannot serve.
2. As a backend developer, I want deleting a job file to delete its Schedule, so that the Schedules
   tab reflects the source tree rather than the history of every job that ever existed.
3. As a backend developer, I want renaming a job to remove the old Schedule and create the new one,
   so that a rename is not silently a leak.
4. As a backend developer, I want editing a job's cron expression to take effect on the next deploy
   without a second command, so that the expression in the source file is the expression that fires.
5. As a backend developer, I want editing a job's handler locally to change what the next tick does,
   so that iterating on a job feels like iterating on a workflow.
6. As a backend developer, I want a brand-new job file to be picked up locally without restarting a
   pane, so that the dev loop does not depend on remembering which of my six processes is stale.
7. As a backend developer, I want editing a subscriber locally to change what the next delivery does,
   for the same reason.
8. As a backend developer, I want a brand-new subscriber file to be registered locally without a
   manual `subscribers:generate`, so that the events Worker behaves like the workflow Worker.
9. As a backend developer, I want the dev-loop change to leave the production entrypoints untouched,
   so that a watcher never ends up inside a container where filesystem events do not fire.
10. As a backend developer, I want `disabled: true` to be the only way to stop a job, so that there
    is exactly one answer to "does this job run" and it is in the diff.
11. As a backend developer, I want flipping `disabled` back to `false` to resume the job on deploy,
    so that enabling is as cheap as disabling.
12. As an operator, I want the Schedules tab to list exactly the jobs that this deploy can run, so
    that what I am looking at is the truth.
13. As an operator, I want a job that fails on every tick to keep failing visibly rather than pausing
    itself, so that a broken job is fixed in code rather than silenced by the server.
14. As an operator, I want a job's past runs to survive the deletion of its Schedule, so that
    removing a job does not destroy the evidence of what it did.
15. As an operator, I want to find a deleted job's runs by the Schedule that started them, so that a
    post-mortem does not depend on the Schedule still existing.
16. As an operator, I want to trigger a job by hand without that trigger being able to pause it, so
    that testing a job in production is not a way to break it.
17. As an operator, I want a run that fails because the Worker does not know the job to say so by
    name, so that a mid-rollout failure is diagnosable from the failure itself.
18. As an on-call engineer, I want cron to have one owning process, so that "is the schedule there"
    and "can anything run it" are one question with one answer.
19. As an on-call engineer, I want rolling a deploy back to remove the jobs that deploy added, so
    that a rollback returns cron to the state of the code that is actually running.
20. As an on-call engineer, I want the rollback behaviour written down, so that a Schedule
    disappearing after a rollback is recognised rather than investigated.
21. As a deploy pipeline, I want no ordering constraint between the API and the cron Worker, so that
    a rollout cannot produce a window where schedules exist for jobs nothing can run.
22. As a deploy pipeline, I want cron reconciliation to happen wherever the cron Worker happens to
    start, so that no deploy step can be skipped or run out of order.
23. As a reviewer, I want the reasoning about why Temporal still owns the clock recorded, so that
    the next person asking "why not just use timers" gets the measured answer.
24. As a reviewer, I want the measured cost of an orphaned Schedule recorded, so that the severity of
    the problem this spec solves is not overstated later.
25. As a reviewer, I want `JobDefinition` to be untouched, so that the workerd runtime keeps running
    the same job list under Cloudflare's triggers.
26. As a reviewer, I want the driver workflow, the activity and the heartbeat to be untouched, so
    that this change is about registration and nothing else.
27. As a reviewer, I want no new runtime dependency, so that the change does not reintroduce a
    scheduling library the previous migration removed.
28. As a test author, I want the existing server test to be the place every behaviour change is
    asserted, so that the suite substitutes behaviour rather than growing a second seam.
29. As a test author, I want a deleted job's Schedule removal asserted against a real server, so that
    the sweep is a tested property rather than a hopeful one.
30. As a test author, I want the sweep asserted to spare a Schedule it does not own, so that the
    prefix rule is proven rather than assumed.

## Implementation Decisions

### The cron Worker reconciles; the API does not

Reconciliation moves out of the API process and into the cron Worker's bootstrap, before it begins
polling. The API stops constructing, registering or calling the `CronScheduler` at all, and the
registration key it resolved is removed from the node container's composition root.

The cron Worker already imports the job list in order to build its activity. Reconciling from the
same import is what makes the two facts — "this Schedule exists" and "this process can run it" —
consequences of one thing.

Nothing else about the Worker changes: same queue, same driver, same activity, same heartbeat.

### Reconciliation is a total desired-state sync over the `cron_` prefix

`start(jobs)` gains a sweep. It lists the namespace's Schedules, keeps those whose id carries the
prefix `cronScheduleId()` writes, and deletes any the job list does not name. Schedules without that
prefix are not this code's and are never touched.

Deletion, not pause: a paused orphan is indistinguishable in the UI from a deliberately disabled job,
and run history does not live in the Schedule, so nothing is lost by removing it.

`remove()` keeps its current semantics — absent is the desired state, so a Schedule that is already
gone is not an error.

### The definition is authoritative, including the pause flag

Unchanged from today, and now coherent rather than costly: every reconcile writes `paused` from
`disabled`, so disabling pauses and enabling unpauses. The warning logged when reconciliation
overrules a server-side pause is kept — it is the trace of a UI action being undone — but it
documents an unsupported operation rather than an accepted cost.

### `pauseOnFailure` is removed

The Schedule is created without it. Two reasons: it is the only cron state that cannot be expressed
in the source tree, which this spec's control-plane decision rules out; and because reconciliation
runs only at boot, a pause applied after the last Worker of a rollout has started is never undone,
so a transient mid-rollout failure can stop a job indefinitely.

The behaviour it guarded — a job failing every minute filling up history — is bounded by namespace
retention and is now visible rather than silenced.

Measured detail worth keeping in mind and recording: `pauseOnFailure` only ever tripped on
*scheduled* runs. Three consecutive failures from manual `trigger()` calls paused nothing.

### Rolling back removes the jobs the rolled-back deploy added

A consequence of desired-state reconciliation, and correct: the jobs that exist are the jobs the
running code defines. It is called out because a Schedule vanishing after a rollback otherwise looks
like data loss.

The narrow race this leaves is two Worker versions reconciling concurrently during a rollout, which
self-heals on the next boot of the newer version. It is accepted rather than solved; solving it needs
leader election, which is a larger decision than this spec.

### The dev loop mirrors the workflow Worker's, asymmetrically

Two different shapes, because the two registries are different:

- **Events** needs a dev entrypoint *and* an include path. Its registry is generated, so a brand-new
  subscriber file is not in the module graph until the generator has run. The entrypoint regenerates
  the subscriber registry and then imports the production entrypoint, exactly as the workflow
  Worker's does, and the watcher is pointed at the subscriber source with the generated file
  excluded so it cannot loop.
- **Cron** needs only the watcher. Its job list is hand-written and already in the Worker's module
  graph, and registering a job *means* editing that file. An include path over the jobs directory is
  added anyway, so that a new file is picked up even before it is registered.

Both are **new** scripts rather than changes to the existing ones. The existing scripts are the
`command:` of the compose services, and a watcher inside a container silently never fires — the bind
mount carries writes but not filesystem events. The dev task definitions and the dev-stack
documentation move to the new scripts; the compose services do not.

### Rejected: removing Temporal from the clock

Recorded because it was the starting proposal. Worker-side timers would remove the Schedule and with
it the orphan question, but they need a cron parser dependency that left the tree with BullMQ, they
fire once per replica unless deduplicated by a per-tick workflow id, and they lose any tick during a
restart with no record that one was owed. A long-running workflow per job is more server state, not
less, and puts determinism and versioning constraints on code that is currently free of them.

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

ADR-0029 is amended rather than superseded — the decision it records, cron as a Temporal Schedule on
a Worker of its own, stands. What changes is the owning process, the completeness of reconciliation,
`pauseOnFailure`, and the status of its "pause survives only until the next boot" trade, which
becomes a stated non-goal. The measured orphan cost and the rejected alternatives above belong in it,
so the next reader gets the numbers rather than the argument.

## Testing Decisions

A good test here asserts what the scheduler and the server actually do, from outside: which Schedules
exist after reconciling a list, what state they are in, and whether a run reaches the handler. None of
it needs to know how the adapter is built, and most of it is the *server's* behaviour, so a double
would be asserting the test's own arithmetic.

**One seam, and it already exists: the `CronScheduler` port**, driven by the cron scheduler's server
test. It boots a full dev server rather than the time-skipping one, claims task queues of its own,
runs real Workers with the real payload converter, and observes runs through recording handlers. Every
behaviour change in this spec is observable there, so the suite gains assertions rather than a file.

What is added at that seam:

- Reconciling a list that no longer names a previously scheduled job removes that job's Schedule. The
  mutation that must fail it: keep the old `start()`, and the Schedule is still there.
- The sweep spares a Schedule whose id does not carry the prefix. A neighbouring Schedule created
  under another id must survive a reconcile that names neither — otherwise the test passes against a
  sweep that deletes everything.
- A Schedule is created without `pauseOnFailure`, and a job whose scheduled run fails is still
  unpaused afterwards. This is the one assertion that needs a real tick rather than a manual trigger,
  because a manual trigger never tripped the flag in the first place.
- The existing pause-direction test stays: disabled pauses, enabled unpauses, and reconciliation
  overrules a hand-applied pause.

What is deliberately not tested:

- **That the cron Worker reconciles at boot.** It is composition-root wiring, the same class of thing
  as the registration it replaces, and asserting it means asserting that a process starts. The port
  test covers what reconciliation *does*.
- **The watch-mode scripts.** Tooling, with no assertion that would fail for the right reason. It is
  verified by the repo's own practice for gates: make the change, add a job file, confirm the Worker
  reloads, then confirm it does not when the flag is removed — and say so in the PR.

The API's `start()` loses its call to the scheduler; no test covers that path today and this spec does
not add the infrastructure to give it one. Its removal is visible in the boot sequence and in the
node container no longer registering the key.

## Out of Scope

- **Any UI-driven control as a supported operation.** Pausing, backfilling or editing a Schedule from
  the Temporal UI stays possible and stays unsupported: reconciliation will overwrite it. Making UI
  state durable — a three-way merge against a last-applied marker in the Schedule's memo, or any
  similar scheme — is a separate decision.
- **Leader election among cron Workers.** The concurrent-reconcile race during a rollout is accepted.
- **Worker Versioning**, which remains the outstanding follow-up ADR-0022 and ADR-0029 already name.
- **Any change to the workerd runtime.** Cloudflare owns that clock through `wrangler.jsonc`, which
  stays hand-synced with the job list.
- **Cleanup for subscribers.** There is no server-side registration to clean up; a subscriber's only
  server state is per-delivery and expires on its own. Removing a subscriber is already complete.
- **Schedules in the namespace that this code did not create.** The sweep is scoped by prefix and
  will not touch them.
- **Namespace retention or Archival configuration.** Both are deployment concerns, and Archival is
  unavailable under Docker regardless.
- **`JobDefinition`, the driver workflow, the activity and the heartbeat.** Untouched.

## Further Notes

Everything asserted here was measured against a running dev stack during review, not inferred:

- A job added to `src/jobs/` produced a Schedule within seconds and then failed on every tick against
  a cron Worker started before it existed, while a pre-existing job on the same Worker completed on
  every tick.
- An orphaned Schedule fired once, failed, and was paused by the server after exactly one scheduled
  run; a reconcile whose list did not name it left it paused and untouched.
- `pauseOnFailure` did not trip on three consecutive manual triggers, only on a scheduled run.
- Deleting a Schedule left all seven of its past runs intact and queryable by `TemporalScheduledById`.
  Local namespace retention is three days.
- A brand-new workflow file was added to the generated registry unprompted and executed on a Worker
  that was never restarted; an edit to its body changed the result of the next invocation.

The dev-stack documentation in AGENTS.md and the two dev task definitions both currently state "no
watch" for the cron and events panes as a bare fact with no rationale. They are the reason this was
hard to see from inside the repo, and they change with the scripts.

*Tracker note:* published to `.scratch/`, which AGENTS.md names as this repo's issue tracker in place
of GitHub Issues. The skill's triage label vocabulary was not supplied to this session, so no
`ready-for-agent` label was applied — the house convention is the `**Status:**` line at the top.
