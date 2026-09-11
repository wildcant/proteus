/**
 * Writes the import list the event bus dispatches subscribers from.
 *
 * Modelled on `generate-workflow-registry.ts` and load-bearing for the same three reasons — the list
 * has to exist as real static imports rather than a directory scan:
 *
 * - **The handler closures have to be in the process that dispatches.** A transport carries a
 *   subscriber *name*; the function it names is a closure that exists only because something
 *   imported the module that built it.
 * - **`tsx --watch` reloads off that same graph.** Editing a subscriber restarts the worker because
 *   the graph reaches it.
 * - **`tsc` and `check:structure` can see it.** A dependency-cruiser rule cannot follow a directory scan,
 *   so the rules that keep queue vocabulary out of a subscriber would have nothing to read.
 *
 * The artifact is committed, so every environment runs the identical file, and `--check` fails the
 * verify gate when it drifts from the source tree.
 *
 * Parsing is `ts-source.ts`, shared with the workflow tooling. What is here is what a *subscriber*
 * file means: one `export const config`, carrying a name the generator can read without running it.
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
  /** The runtime name, and the subscriber half of every dispatch identity it will be handed. */
  name: string
  /** Module specifier relative to the generated file, `.js` as everything else in this backend. */
  module: string
  /** `file:line`, so a rejection prints a clickable location. */
  location: string
}

type Problem = { location: string; message: string; remedy: string }

/** Repo root, because `collect` yields repo-relative paths and the module specifiers derive from them. */
const root = fileURLToPath(new URL('../../../', import.meta.url))
const SUBSCRIBERS_DIR = `${root}apps/backend/src/subscribers`
const OUTPUT = `${root}apps/backend/src/subscribers/registry.gen.ts`
const OUTPUT_PATH = 'apps/backend/src/subscribers/registry.gen.ts'

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
function subscriberNameOf(config: ts.ObjectLiteralExpression): string | undefined {
  for (const property of config.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    if (property.name.getText() !== 'name') continue
    if (ts.isStringLiteralLike(property.initializer)) return property.initializer.text
  }

  return undefined
}

/** `send-order-confirmation` → `sendOrderConfirmation`. Unique because the name it derives from is. */
function aliasOf(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean)
  const [first = 'subscriber', ...rest] = words
  return [first, ...rest.map((word) => word[0]?.toUpperCase() + word.slice(1))].join('')
}

function discover(): { subscribers: Discovered[]; problems: Problem[] } {
  const subscribers: Discovered[] = []
  const problems: Problem[] = []

  for (const file of collect(SUBSCRIBERS_DIR, root)) {
    if (file.path === OUTPUT_PATH) continue

    const source = parse(file)
    const config = exportedConfig(source)

    // Every file in this directory is a subscriber. A helper module here would be dispatched from
    // nowhere and read as one, so it is rejected rather than skipped — the alternative is a file
    // that looks registered and never runs.
    if (!config) {
      problems.push({
        location: file.path,
        message: 'no `export const config` object',
        remedy:
          'export the subscriber as `export const config: SubscriberConfig<…> = { name, event, handler }`, ' +
          'or move this file out of src/subscribers/',
      })
      continue
    }

    const location = `${file.path}:${source.getLineAndCharacterOfPosition(config.getStart(source)).line + 1}`
    const name = subscriberNameOf(config)

    if (!name) {
      problems.push({
        location,
        message: 'the config does not name itself with a string literal',
        remedy: "write the name inline — name: 'the-name' — so it can be read without running the code",
      })
      continue
    }

    const module = file.path.replace('apps/backend/src/subscribers/', './').replace(/\.ts$/, '.js')
    subscribers.push({ alias: aliasOf(name), name, module, location })
  }

  return { subscribers: subscribers.sort((a, b) => a.module.localeCompare(b.module)), problems }
}

/**
 * A shared name is a shared dispatch identity: the transport reads two deliveries as one and only
 * whichever ran first is ever recorded. A shared alias is only an invalid generated file, but it
 * comes from the same place and is worth naming as itself.
 */
function collisions(subscribers: Discovered[]): Problem[] {
  const byName = new Map<string, Discovered>()
  const byAlias = new Map<string, Discovered>()
  const problems: Problem[] = []

  for (const subscriber of subscribers) {
    const sameName = byName.get(subscriber.name)
    if (sameName) {
      problems.push({
        location: subscriber.location,
        message: `two subscribers are named "${subscriber.name}" — also at ${sameName.location}`,
        remedy: 'rename one; the dispatch identity is derived from this name and cannot tell them apart',
      })
      continue
    }

    const sameAlias = byAlias.get(subscriber.alias)
    if (sameAlias) {
      problems.push({
        location: subscriber.location,
        message: `"${subscriber.name}" and "${sameAlias.name}" both import as \`${subscriber.alias}\``,
        remedy: 'rename one so the two names differ by more than punctuation',
      })
      continue
    }

    byName.set(subscriber.name, subscriber)
    byAlias.set(subscriber.alias, subscriber)
  }

  return problems
}

function render(subscribers: Discovered[]): string {
  const imports = subscribers
    .map((subscriber) => `import { config as ${subscriber.alias} } from '${subscriber.module}'`)
    .join('\n')
  const entries = subscribers.map((subscriber) => `  defineSubscriber(${subscriber.alias}),`).join('\n')

  return `// GENERATED by \`pnpm --filter backend run subscribers:generate\`. Do not edit — your change will be overwritten.
//
// Every subscriber \`src/subscribers/\` defines, as static imports, so the handler closures exist in
// the process that dispatches and \`tsx --watch\` has a module graph to reload from. \`pnpm verify\`
// fails when this file drifts from the source tree.
//
// \`defineSubscriber\` is called here rather than in each subscriber file: it is what erases the
// config's event type argument so subscribers of different event unions can share one list, and a
// subscriber file is meant to be a function plus a plain object, exactly like a job.

import { defineSubscriber, type SubscriberDefinition } from '../core/event-bus/types.js'
${imports}

export const GENERATED_SUBSCRIBERS: SubscriberDefinition[] = [
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
  heading('subscriber-registry')
  for (const problem of problems) {
    console.info(`  ${DIM}${problem.location}${RESET}`)
    console.info(`    ${problem.message}`)
    console.info(`    ${YELLOW}→${RESET} ${problem.remedy}`)
    console.info('')
  }
}

const checking = process.argv.includes('--check')
const { subscribers, problems } = discover()
const allProblems = [...problems, ...collisions(subscribers)]

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

const rendered = render(subscribers)
const existing = existingOutput()

if (checking) {
  if (existing !== rendered) {
    heading('subscriber-registry')
    console.info(`  ${RED}✖${RESET} src/subscribers/registry.gen.ts is out of date with src/subscribers/.`)
    console.info(`    ${DIM}${subscribers.length} subscribers found in the source tree.${RESET}`)
    console.info(`    ${YELLOW}→${RESET} run \`pnpm --filter backend run subscribers:generate\` and commit the result`)
    console.info('')
    process.exit(1)
  }
  console.info(
    `${GREEN}✔${RESET} subscriber-registry — registry.gen.ts matches src/subscribers/. ${DIM}${subscribers.length} subscribers.${RESET}`,
  )
} else {
  // Only write on a real change: an unconditional write bumps the mtime and re-triggers every watcher
  // pointed at this file, which on a dev worker means a second restart for nothing.
  if (existing === rendered) {
    console.info(
      `${GREEN}✔${RESET} subscriber-registry — already current. ${DIM}${subscribers.length} subscribers.${RESET}`,
    )
  } else {
    writeFileSync(OUTPUT, rendered)
    console.info(
      `${GREEN}✔${RESET} subscriber-registry — wrote registry.gen.ts. ${DIM}${subscribers.length} subscribers.${RESET}`,
    )
  }
}
