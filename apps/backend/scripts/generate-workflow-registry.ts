/**
 * Writes the import list the Temporal Worker registers workflows from.
 *
 * The list has to exist as real static imports, and generating it is the only part that changes.
 * Three things depend on those imports being in the module graph rather than discovered at runtime:
 *
 * - **The handler closures have to be in the Worker process.** The sandboxed driver carries a
 *   workflow *name*; `advanceWorkflow` looks that name up in a map of closures which exist only
 *   because something imported the module that built them.
 * - **`tsx --watch` reloads the Worker off that same graph.** Editing a step action restarts the
 *   Worker because `worker.ts` → `registry.ts` → `registry.gen.ts` → the file just edited.
 * - **`tsc` and `check:structure` can see it.** A dependency-cruiser rule cannot follow a directory scan.
 *
 * So this is deliberately *not* the runtime scan the old hand-written list warned against. The
 * artifact is committed, so every environment runs the identical file, and `--check` fails the
 * verify gate when it drifts from the source tree.
 *
 * It reads core's `src/workflows/` and each extension's `workflows/` folder (`runtime-sources.ts`), and
 * an extension's workflow names must start with its runtime prefix (`<ext>.`).
 *
 * Reading a workflow file lives in `workflow-source.ts`; turning source text into a tree lives in
 * `ts-source.ts`, which owns the `typescript` import and explains why the repo is pinned to 6.x.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BACKEND,
  byOwnerThenModule,
  collectRuntimeSources,
  DIM,
  GREEN,
  heading,
  isEntryPoint,
  moduleSpecifier,
  type Problem,
  RED,
  RESET,
  report,
  unprefixedName,
  YELLOW,
} from './runtime-sources.js'
import { parse } from './ts-source.js'
import { exportedBindingOf, findCreateWorkflowCalls, workflowNameOf } from './workflow-source.js'

type Discovered = {
  /** The `export const` the definition is bound to, i.e. what the generated file imports. */
  binding: string
  /** The runtime name the driver looks up. Only used to reject duplicates before they reach the Map. */
  name: string
  /** Module specifier relative to the generated file, `.js` as everything else in this backend. */
  module: string
  /** `file:line`, so a rejection prints a clickable location. */
  location: string
  /** The extension the workflow belongs to; `undefined` for core. */
  extension: string | undefined
}

export function outputOf(backend: string): string {
  return join(backend, 'src/framework/workflows/temporal/registry.gen.ts')
}

function discover(backend: string): { workflows: Discovered[]; problems: Problem[] } {
  const workflows: Discovered[] = []
  const problems: Problem[] = []

  for (const file of collectRuntimeSources(backend, 'workflows')) {
    const source = parse(file)

    for (const call of findCreateWorkflowCalls(source)) {
      const location = `${file.path}:${source.getLineAndCharacterOfPosition(call.getStart(source)).line + 1}`
      const binding = exportedBindingOf(call)
      const name = workflowNameOf(call)

      if (!binding) {
        problems.push({
          location,
          message: 'a createWorkflow(…) call that is not assigned to an exported top-level const',
          remedy: 'export it as `export const nameWorkflow = createWorkflow(…)`, or it can never be registered',
        })
        continue
      }

      if (!name) {
        problems.push({
          location,
          message: `${binding} does not name itself with a string literal`,
          remedy: "pass the name inline — createWorkflow('the-name', …) — so it can be read without running the code",
        })
        continue
      }

      const module = moduleSpecifier(backend, outputOf(backend), file.path)
      workflows.push({ binding, name, module, location, extension: file.extension })
    }
  }

  return { workflows: workflows.sort(byOwnerThenModule), problems }
}

/**
 * Two workflows answering to one name is a lookup that silently resolves to whichever was registered
 * last. Two sharing a binding is only an invalid generated file, but core and an extension can pick
 * the same one without either seeing the other.
 */
function duplicates(workflows: Discovered[]): Problem[] {
  const byName = new Map<string, Discovered>()
  const byBinding = new Map<string, Discovered>()
  const problems: Problem[] = []

  for (const workflow of workflows) {
    const sameName = byName.get(workflow.name)
    if (sameName) {
      problems.push({
        location: workflow.location,
        message: `two workflows are named "${workflow.name}" — also at ${sameName.location}`,
        remedy: 'rename one; the driver looks workflows up by this name and cannot tell them apart',
      })
      continue
    }

    const sameBinding = byBinding.get(workflow.binding)
    if (sameBinding) {
      problems.push({
        location: workflow.location,
        message: `two workflows are exported as \`${workflow.binding}\` — also at ${sameBinding.location}`,
        remedy: 'rename one export; the generated registry imports both by that name',
      })
      continue
    }

    byName.set(workflow.name, workflow)
    byBinding.set(workflow.binding, workflow)
  }

  return problems
}

function render(workflows: Discovered[]): string {
  const imports = workflows.map((workflow) => `import { ${workflow.binding} } from '${workflow.module}'`).join('\n')
  const entries = workflows.map((workflow) => `  ${workflow.binding},`).join('\n')

  return `// GENERATED by \`pnpm --filter backend run workflows:generate\`. Do not edit — your change will be overwritten.
//
// Every workflow \`src/workflows/\` defines, as static imports, so the handler closures exist in the
// Worker process and \`tsx --watch\` has a module graph to reload from. \`pnpm verify\` fails when
// this file drifts from the source tree.

import type { WorkflowDefinition } from '../../../core/workflows/types.js'
${imports}

export const GENERATED_WORKFLOWS: WorkflowDefinition<never, unknown>[] = [
${entries}
]
`
}

/** The registry `backend`'s sources produce, or what is wrong with them. Exported for the tests. */
export function generateWorkflowRegistry(backend: string): { rendered: string; count: number; problems: Problem[] } {
  const { workflows, problems } = discover(backend)
  const prefixes = workflows.flatMap((workflow) => unprefixedName('workflow', workflow) ?? [])
  return {
    rendered: render(workflows),
    count: workflows.length,
    problems: [...problems, ...prefixes, ...duplicates(workflows)],
  }
}

/** Absent on the first run, and an empty string then differs from any render, which is the right answer. */
function existingOutput(output: string): string {
  try {
    return readFileSync(output, 'utf8')
  } catch {
    return ''
  }
}

function main(): void {
  const checking = process.argv.includes('--check')
  const output = outputOf(BACKEND)
  const { rendered, count, problems } = generateWorkflowRegistry(BACKEND)

  if (problems.length > 0) {
    report('workflow-registry', problems)
    process.exit(1)
  }

  const existing = existingOutput(output)

  if (checking) {
    if (existing !== rendered) {
      heading('workflow-registry')
      console.info(
        `  ${RED}✖${RESET} src/framework/workflows/temporal/registry.gen.ts is out of date with the workflow sources.`,
      )
      console.info(`    ${DIM}${count} workflows found in the source tree.${RESET}`)
      console.info(`    ${YELLOW}→${RESET} run \`pnpm --filter backend run workflows:generate\` and commit the result`)
      console.info('')
      process.exit(1)
    }
    console.info(
      `${GREEN}✔${RESET} workflow-registry — registry.gen.ts matches the workflow sources. ${DIM}${count} workflows.${RESET}`,
    )
    return
  }

  // Only write on a real change: an unconditional write bumps the mtime and re-triggers every watcher
  // pointed at this file, which on the dev Worker means a second restart for nothing.
  if (existing === rendered) {
    console.info(`${GREEN}✔${RESET} workflow-registry — already current. ${DIM}${count} workflows.${RESET}`)
    return
  }
  writeFileSync(output, rendered)
  console.info(`${GREEN}✔${RESET} workflow-registry — wrote registry.gen.ts. ${DIM}${count} workflows.${RESET}`)
}

if (isEntryPoint(import.meta.url)) main()
