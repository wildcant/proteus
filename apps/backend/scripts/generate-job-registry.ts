/**
 * Writes the import list the cron Worker reconciles and runs scheduled jobs from.
 *
 * Modelled on `generate-subscriber-registry.ts` and load-bearing for the same three reasons — the
 * list has to exist as real static imports rather than a directory scan:
 *
 * - **The handler closures have to be in the process that runs them.** A Schedule's action carries a
 *   job *name*; the function it names is a closure that exists only because something imported the
 *   module that built it.
 * - **`tsx --watch` reloads off that same graph.** Editing a job restarts the cron Worker because
 *   the graph reaches it.
 * - **`tsc` and `check:structure` can see it.** A dependency-cruiser rule cannot follow a directory
 *   scan, so `jobs: ['core']` — the row that keeps a job from reaching `framework/` — would have
 *   nothing to read.
 *
 * There is a fourth reason here that the other two generators do not have, and it is the sharpest
 * one. **This list is the desired state for the Temporal Schedules**, not merely the set of handlers
 * that can run: the cron Worker reconciles against it at boot and deletes every `cron_`-prefixed
 * Schedule the list does not name. So a job file this generator quietly skipped would not just be an
 * unrunnable job — it would be a *swept* one, its Schedule deleted by the process that failed to see
 * it. That is why an unreadable file in `src/jobs/` is rejected rather than passed over.
 *
 * The artifact is committed, so every environment runs the identical file, and `--check` fails the
 * verify gate when it drifts from the source tree.
 *
 * Parsing is `ts-source.ts`, shared with the workflow and subscriber tooling. What is here is what a
 * *job* file means: one `export const config`, carrying a name the generator can read without
 * running it.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as ts from 'typescript'
import { collect, parse } from './ts-source.js'

const RED = '\x1b[0;31m'
const GREEN = '\x1b[0;32m'
const YELLOW = '\x1b[0;33m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

type Discovered = {
  /** What the generated file imports `config` as. Derived from `name`, which is already unique. */
  alias: string
  /** The runtime name, which is also the suffix of the Schedule id `cron_${name}`. */
  name: string
  /** Module specifier relative to the generated file, `.js` as everything else in this backend. */
  module: string
  /** `file:line`, so a rejection prints a clickable location. */
  location: string
}

type Problem = { location: string; message: string; remedy: string }

/** Repo root, because `collect` yields repo-relative paths and the module specifiers derive from them. */
const root = fileURLToPath(new URL('../../../', import.meta.url))
const JOBS_DIR = `${root}apps/backend/src/jobs`
const OUTPUT = `${root}apps/backend/src/jobs/registry.gen.ts`
const OUTPUT_PATH = 'apps/backend/src/jobs/registry.gen.ts'

/** The `export const config = { … }` statement, or `undefined` if the file has no such export. */
function exportedConfig(source: ts.SourceFile): ts.ObjectLiteralExpression | undefined {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'config') continue
      if (declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer)) {
        return declaration.initializer
      }
    }
  }

  return undefined
}

/** `name: 'the-name'`, read as text. A computed name cannot be read without running the file. */
function jobNameOf(config: ts.ObjectLiteralExpression): string | undefined {
  for (const property of config.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    if (property.name.getText() !== 'name') continue
    if (ts.isStringLiteralLike(property.initializer)) return property.initializer.text
  }

  return undefined
}

/** `product-census` → `productCensus`. Unique because the name it derives from is. */
function aliasOf(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean)
  const [first = 'job', ...rest] = words
  return [first, ...rest.map((word) => word[0]?.toUpperCase() + word.slice(1))].join('')
}

function discover(): { jobs: Discovered[]; problems: Problem[] } {
  const jobs: Discovered[] = []
  const problems: Problem[] = []

  for (const file of collect(JOBS_DIR, root)) {
    if (file.path === OUTPUT_PATH) continue

    const source = parse(file)
    const config = exportedConfig(source)

    // Every file in this directory is a job. A helper module here would be scheduled from nowhere
    // and read as one, so it is rejected rather than skipped — the alternative is a file that looks
    // registered and never runs, which for cron also means a Schedule swept by the next reconcile.
    if (!config) {
      problems.push({
        location: file.path,
        message: 'no `export const config` object',
        remedy:
          'export the job as `export const config: JobDefinition = { name, schedule, handler }`, ' +
          'or move this file out of src/jobs/',
      })
      continue
    }

    const location = `${file.path}:${source.getLineAndCharacterOfPosition(config.getStart(source)).line + 1}`
    const name = jobNameOf(config)

    if (!name) {
      problems.push({
        location,
        message: 'the config does not name itself with a string literal',
        remedy: "write the name inline — name: 'the-name' — so it can be read without running the code",
      })
      continue
    }

    const module = file.path.replace('apps/backend/src/jobs/', './').replace(/\.ts$/, '.js')
    jobs.push({ alias: aliasOf(name), name, module, location })
  }

  return { jobs: jobs.sort((a, b) => a.module.localeCompare(b.module)), problems }
}

/**
 * A shared name is a shared Schedule: the id is `cron_${name}`, so the second job to be reconciled
 * overwrites the first's spec and action, and only one of the two handlers can ever be reached. A
 * shared alias is only an invalid generated file, but it comes from the same place and is worth
 * naming as itself.
 */
function collisions(jobs: Discovered[]): Problem[] {
  const byName = new Map<string, Discovered>()
  const byAlias = new Map<string, Discovered>()
  const problems: Problem[] = []

  for (const job of jobs) {
    const sameName = byName.get(job.name)
    if (sameName) {
      problems.push({
        location: job.location,
        message: `two jobs are named "${job.name}" — also at ${sameName.location}`,
        remedy: `rename one; both reconcile to the schedule id \`cron_${job.name}\` and cannot coexist`,
      })
      continue
    }

    const sameAlias = byAlias.get(job.alias)
    if (sameAlias) {
      problems.push({
        location: job.location,
        message: `"${job.name}" and "${sameAlias.name}" both import as \`${job.alias}\``,
        remedy: 'rename one so the two names differ by more than punctuation',
      })
      continue
    }

    byName.set(job.name, job)
    byAlias.set(job.alias, job)
  }

  return problems
}

function render(jobs: Discovered[]): string {
  const imports = jobs.map((job) => `import { config as ${job.alias} } from '${job.module}'`).join('\n')
  const entries = jobs.map((job) => `  ${job.alias},`).join('\n')

  return `// GENERATED by \`pnpm --filter backend run jobs:generate\`. Do not edit — your change will be overwritten.
//
// Every job \`src/jobs/\` defines, as static imports, so the handler closures exist in the cron
// Worker and \`tsx --watch\` has a module graph to reload from. \`pnpm verify\` fails when this file
// drifts from the source tree.
//
// It is also the *desired state* the cron Worker reconciles Temporal Schedules against: a job here
// gets a schedule, and a \`cron_\`-prefixed schedule no entry here names is deleted. Both runtimes
// read this one list — node through the cron Worker, workerd through its scheduled handler.

import type { JobDefinition } from '../core/types/scheduler.js'
${imports}

export const GENERATED_JOBS: JobDefinition[] = [
${entries}
]
`
}

function heading(title: string): void {
  console.info('')
  console.info(`${RED}${BOLD}${title}${RESET} ${DIM}${'━'.repeat(Math.max(0, 76 - title.length))}${RESET}`)
  console.info('')
}

function report(problems: Problem[]): void {
  heading('job-registry')
  for (const problem of problems) {
    console.info(`  ${DIM}${problem.location}${RESET}`)
    console.info(`    ${problem.message}`)
    console.info(`    ${YELLOW}→${RESET} ${problem.remedy}`)
    console.info('')
  }
}

const checking = process.argv.includes('--check')
const { jobs, problems } = discover()
const allProblems = [...problems, ...collisions(jobs)]

if (allProblems.length > 0) {
  report(allProblems)
  process.exit(1)
}

/** Absent on the first run, and an empty string then differs from any render, which is the right answer. */
function existingOutput(): string {
  try {
    return readFileSync(OUTPUT, 'utf8')
  } catch {
    return ''
  }
}

const rendered = render(jobs)
const existing = existingOutput()

if (checking) {
  if (existing !== rendered) {
    heading('job-registry')
    console.info(`  ${RED}✖${RESET} src/jobs/registry.gen.ts is out of date with src/jobs/.`)
    console.info(`    ${DIM}${jobs.length} jobs found in the source tree.${RESET}`)
    console.info(`    ${YELLOW}→${RESET} run \`pnpm --filter backend run jobs:generate\` and commit the result`)
    console.info('')
    process.exit(1)
  }
  console.info(`${GREEN}✔${RESET} job-registry — registry.gen.ts matches src/jobs/. ${DIM}${jobs.length} jobs.${RESET}`)
} else {
  // Only write on a real change: an unconditional write bumps the mtime and re-triggers every watcher
  // pointed at this file, which on a dev worker means a second restart for nothing.
  if (existing === rendered) {
    console.info(`${GREEN}✔${RESET} job-registry — already current. ${DIM}${jobs.length} jobs.${RESET}`)
  } else {
    writeFileSync(OUTPUT, rendered)
    console.info(`${GREEN}✔${RESET} job-registry — wrote registry.gen.ts. ${DIM}${jobs.length} jobs.${RESET}`)
  }
}
