import { type WorkflowRegistry, workflowRegistry } from './registry.js'

/**
 * Every `ctx.step` name a deployed workflow can ask for, read off the handlers themselves.
 *
 * The Temporal UI labels a timeline row with the Activity *type*, so a driver that always schedules
 * `advanceWorkflow` produces fourteen identical rows for `complete-cart`. Making the step name the
 * type is the only thing that moves that — and an Activity type has to be registered on the Worker
 * before it can be scheduled, because `Worker.create` reads the activity map into a `Map` once and
 * looks names up in it at dispatch. So the names have to be known at startup.
 *
 * This is deliberately **one constant rather than a per-caller set**. Registration and the lookahead
 * filter have to agree exactly — a name reported but not registered is an `ActivityNotFound`, a
 * deploy-shaped failure in the middle of a checkout — and two call sites computing "the names"
 * independently is precisely how they stop agreeing. There is one deployed registry, so there is one
 * answer, and every Worker in the process registers and filters by the same one.
 *
 * The consequence to know: a workflow that was not in `workflowRegistry` when the Worker booted gets
 * no labels. That is not a limitation of this module but of Activity registration — the parity
 * harness registers throwaway workflows per test, and nothing could have registered their step names
 * in advance. They fall back to `advanceWorkflow`, which is the row the UI showed before any of this.
 *
 * The names are found by regex over `handler.toString()` rather than by parsing the files. Two
 * reasons, and the second is why this is not the cheap option taken over the rigorous one:
 *
 * - **The source tree is not the subject here — the loaded closures are.** This has to answer for the
 *   workflows *this process actually registered*, synchronously at module load, because
 *   `Worker.create` reads the activity map once. `scripts/replay-purity.ts` can parse files because
 *   it runs over the repo at verify time; a Worker asking the filesystem what it is running would be
 *   answering from a different source than the one it registered from, and the two can disagree.
 * - **A miss costs a label, not a step.** `advanceWorkflow` reports a lookahead only for a name in
 *   this set, so a name this regex cannot see — one built from a template literal, say — is never
 *   scheduled as an Activity type and the driver falls back. The failure mode is the duller row, not
 *   a broken execution. That is what makes a regex an honest tool for this job and a dishonest one
 *   for replay purity, where a miss is silent corruption and the check has to fail closed.
 */

/**
 * Matches `.step('name'` and `.step("name"`. The receiver is deliberately unconstrained — a handler
 * names its own context parameter, and `ctx` is only a convention. Type arguments are matched
 * because they are legal to write, even though tsx has already erased them from what `toString()`
 * returns.
 */
const STEP_CALL = /\.step\s*(?:<[^>]*>)?\s*\(\s*['"`]([^'"`\\\n]+)['"`]/g

/** Names the Worker registers for itself. An alias may not take one over. */
const RESERVED = new Set(['ping', 'advanceWorkflow', 'compensateWorkflow'])

function collectStepNames(registry: WorkflowRegistry): ReadonlySet<string> {
  const names = new Set<string>()

  for (const workflow of registry.names()) {
    const definition = registry.get(workflow)
    if (!definition) continue

    for (const [, name] of definition.handler.toString().matchAll(STEP_CALL)) {
      if (name && !RESERVED.has(name)) names.add(name)
    }
  }

  return names
}

export const STEP_ACTIVITY_NAMES = collectStepNames(workflowRegistry)
