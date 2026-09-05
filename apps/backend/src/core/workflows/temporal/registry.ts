import { AppError, ErrorTypes } from '../core/errors/app-error.js'
import type { WorkflowDefinition } from '../core/workflows/types.js'
import { GENERATED_WORKFLOWS } from './registry.gen.js'

/**
 * Name → handler, so the replay Activity can find a workflow it was only handed the *name* of.
 *
 * This is the half of the bridge that cannot travel: the driver Workflow runs in a sandbox and
 * carries a name, and the handler it names is an ordinary closure living in this process. Every
 * workflow the Temporal engine can run has to be here — an unregistered name fails the execution
 * non-retryably rather than falling back to something, because "the deploy forgot a workflow" and
 * "the workflow legitimately does not exist" look identical from inside the Activity.
 *
 * The list itself lives in `registry.gen.ts` and is written by `npm run workflows:generate`, which
 * parses `src/workflows/` for `createWorkflow` calls. It is still an import list, and still a
 * committed file — that is the point. Static imports are what put the closures in this process at
 * all, what gives `tsx --watch` a module graph to reload the Worker from, and what lets `tsc` and
 * `check:deps` see the edge. What generating it removes is only the step where a human remembers to
 * add a line.
 *
 * Still not a runtime scan of the directory, for the reason that has not changed: a directory can
 * resolve differently in another environment, and nothing would say so. A generated artifact is
 * identical everywhere because it is in git, and `npm run verify` fails when it drifts from the
 * source tree rather than letting the difference reach a deploy.
 *
 * The duplicate check below survives that move. It now catches a generator bug rather than a typo,
 * which is a smaller risk but a worse failure — two workflows under one name is a lookup that
 * silently resolves to whichever was registered last.
 */
export type WorkflowRegistry = {
  get(name: string): WorkflowDefinition<unknown, unknown> | undefined
  names(): string[]
}

export function createWorkflowRegistry(definitions: WorkflowDefinition<never, unknown>[]): WorkflowRegistry {
  const byName = new Map<string, WorkflowDefinition<unknown, unknown>>()

  for (const definition of definitions) {
    if (byName.has(definition.name)) {
      throw new AppError({
        type: ErrorTypes.UNEXPECTED_STATE,
        message: `[temporal] Two workflows are registered as "${definition.name}"`,
      })
    }
    byName.set(definition.name, definition as WorkflowDefinition<unknown, unknown>)
  }

  return {
    get: (name) => byName.get(name),
    names: () => [...byName.keys()],
  }
}

export const workflowRegistry = createWorkflowRegistry(GENERATED_WORKFLOWS)
