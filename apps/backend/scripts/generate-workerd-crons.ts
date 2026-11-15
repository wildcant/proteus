/**
 * Writes workerd's cron triggers into `wrangler.jsonc`, in place, from the job registry.
 *
 * On Node the cron Worker reconciles Temporal Schedules against the generated job list; on workerd
 * Cloudflare owns the clock, and it only fires a `scheduled` event for an expression listed under
 * `triggers.crons`. `src/index.workerd.ts` then runs every enabled job whose schedule is the one that
 * fired. So the list here is the set of distinct schedules the enabled jobs run on: a job whose
 * expression is missing never runs on workerd, and nothing at runtime says so.
 *
 * Only the `triggers` value is rewritten; every other field and comment in the file stays as it is.
 * Schedules are read statically, the way the job generator reads names: a string literal, or a
 * member of `CronExpression`, whose values are read from `src/core/types/cron-expression.ts`.
 *
 * `--check` fails when the file differs from what this would write, and `pnpm verify` runs it.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'
import { type DiscoveredJob, discover } from './generate-job-registry.js'
import {
  BACKEND,
  DIM,
  GREEN,
  heading,
  isEntryPoint,
  type Problem,
  RED,
  RESET,
  report,
  YELLOW,
} from './runtime-sources.js'
import { parse } from './ts-source.js'

/** One trigger: a schedule, and the enabled jobs that run on it. */
export type Cron = { schedule: string; jobs: string[] }

export function wranglerOf(backend: string): string {
  return join(backend, 'wrangler.jsonc')
}

/** `EVERY_10_MINUTES` → `*\/10 * * * *`, read from the enum's source. */
function cronExpressionValues(backend: string): Map<string, string> {
  const path = 'src/core/types/cron-expression.ts'
  const source = parse({ path, source: readFileSync(join(backend, path), 'utf8') })
  const values = new Map<string, string>()

  for (const statement of source.statements) {
    if (!ts.isEnumDeclaration(statement) || statement.name.text !== 'CronExpression') continue
    for (const member of statement.members) {
      if (member.initializer && ts.isStringLiteralLike(member.initializer)) {
        values.set(member.name.getText(source), member.initializer.text)
      }
    }
  }

  return values
}

function property(config: ts.ObjectLiteralExpression, name: string): ts.PropertyAssignment | undefined {
  return config.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) && candidate.name.getText() === name,
  )
}

function scheduleOf(job: DiscoveredJob, values: Map<string, string>): string | undefined {
  const initializer = property(job.config, 'schedule')?.initializer
  if (!initializer) return undefined
  if (ts.isStringLiteralLike(initializer)) return initializer.text
  if (
    ts.isPropertyAccessExpression(initializer) &&
    ts.isIdentifier(initializer.expression) &&
    initializer.expression.text === 'CronExpression'
  ) {
    return values.get(initializer.name.text)
  }
  return undefined
}

/** `true` or `false` when written as a literal or left out; `undefined` when it cannot be read. */
function disabledOf(job: DiscoveredJob): boolean | undefined {
  const initializer = property(job.config, 'disabled')?.initializer
  if (!initializer || initializer.kind === ts.SyntaxKind.FalseKeyword) return false
  if (initializer.kind === ts.SyntaxKind.TrueKeyword) return true
  return undefined
}

/** The distinct schedules of the enabled jobs, in registry order. */
function cronsOf(backend: string, jobs: DiscoveredJob[]): { crons: Cron[]; problems: Problem[] } {
  const values = cronExpressionValues(backend)
  const crons: Cron[] = []
  const problems: Problem[] = []

  for (const job of jobs) {
    const disabled = disabledOf(job)
    if (disabled === undefined) {
      problems.push({
        location: job.location,
        message: `"${job.name}" sets \`disabled\` to something other than a literal`,
        remedy: 'write `disabled: true` or leave it out, so workerd’s cron list can be read without running the code',
      })
      continue
    }
    if (disabled) continue

    const schedule = scheduleOf(job, values)
    if (!schedule) {
      problems.push({
        location: job.location,
        message: `the schedule of "${job.name}" cannot be read without running the code`,
        remedy: 'write it inline as a CronExpression member or a string — schedule: CronExpression.EVERY_HOUR',
      })
      continue
    }

    const existing = crons.find((cron) => cron.schedule === schedule)
    if (existing) existing.jobs.push(job.name)
    else crons.push({ schedule, jobs: [job.name] })
  }

  return { crons, problems }
}

function renderTriggers(crons: Cron[], indent: string): string {
  const inner = `${indent}  `
  const entries = crons
    .map(
      (cron, index) =>
        `${inner}  // ${cron.jobs.join(', ')}\n${inner}  ${JSON.stringify(cron.schedule)}${index < crons.length - 1 ? ',' : ''}`,
    )
    .join('\n')
  const list = crons.length === 0 ? '[]' : `[\n${entries}\n${inner}]`

  return [
    '{',
    `${inner}// GENERATED by \`pnpm --filter backend run jobs:generate\` from the job registry, one entry per`,
    `${inner}// schedule an enabled job runs on. Do not edit; \`pnpm verify\` fails when it drifts.`,
    `${inner}"crons": ${list}`,
    `${indent}}`,
  ].join('\n')
}

type Token = { kind: 'string' | 'punctuation'; value: string; start: number; end: number }

/** End of the comment starting at `index`, or `undefined` when no comment starts there. */
function commentEnd(text: string, index: number): number | undefined {
  if (text[index] !== '/') return undefined
  if (text[index + 1] === '/') {
    const newline = text.indexOf('\n', index)
    return newline === -1 ? text.length : newline
  }
  if (text[index + 1] === '*') {
    const close = text.indexOf('*/', index + 2)
    return close === -1 ? text.length : close + 2
  }
  return undefined
}

/** Strings and structural punctuation of JSONC text; comments, whitespace and other literals dropped. */
function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let index = 0

  while (index < text.length) {
    const char = text.charAt(index)
    const afterComment = commentEnd(text, index)
    if (afterComment !== undefined) {
      index = afterComment
      continue
    }
    if (char === '"') {
      let end = index + 1
      while (end < text.length && text[end] !== '"') end += text[end] === '\\' ? 2 : 1
      tokens.push({ kind: 'string', value: text.slice(index + 1, end), start: index, end: end + 1 })
      index = end + 1
      continue
    }
    if ('{}[]:,'.includes(char)) tokens.push({ kind: 'punctuation', value: char, start: index, end: index + 1 })
    index++
  }

  return tokens
}

/** The `[start, end)` of the top-level `"triggers"` object in JSONC text; `undefined` when there is none. */
function triggersSpan(text: string): { start: number; end: number } | undefined {
  const tokens = tokenize(text)
  let depth = 0

  for (const [index, token] of tokens.entries()) {
    const open = tokens[index + 2]
    if (
      depth === 1 &&
      token.kind === 'string' &&
      token.value === 'triggers' &&
      tokens[index + 1]?.value === ':' &&
      open?.value === '{'
    ) {
      return { start: open.start, end: closingOf(tokens, index + 2) }
    }
    if (token.kind === 'punctuation' && '{['.includes(token.value)) depth++
    if (token.kind === 'punctuation' && '}]'.includes(token.value)) depth--
  }

  return undefined
}

/** End offset of the bracket that closes the one at `tokens[open]`. */
function closingOf(tokens: Token[], open: number): number {
  let depth = 0
  for (const token of tokens.slice(open)) {
    if (token.kind !== 'punctuation') continue
    if ('{['.includes(token.value)) depth++
    if ('}]'.includes(token.value)) depth--
    if (depth === 0) return token.end
  }
  return tokens.at(-1)?.end ?? 0
}

/** `wrangler` with its `triggers` value replaced by the crons `backend`'s jobs need. Exported for the tests. */
export function generateWorkerdCrons(
  backend: string,
  wrangler: string,
): { rendered: string; crons: Cron[]; problems: Problem[] } {
  const { jobs, problems: jobProblems } = discover(backend)
  const { crons, problems } = cronsOf(backend, jobs)
  const span = triggersSpan(wrangler)

  if (!span) {
    return {
      rendered: wrangler,
      crons,
      problems: [
        ...jobProblems,
        ...problems,
        {
          location: 'apps/backend/wrangler.jsonc',
          message: 'no top-level "triggers" object to write the crons into',
          remedy: 'add `"triggers": { "crons": [] }` at the top level, then run this again',
        },
      ],
    }
  }

  const lineStart = wrangler.lastIndexOf('\n', span.start) + 1
  const indent = /^\s*/.exec(wrangler.slice(lineStart, span.start))?.[0] ?? ''
  const rendered = `${wrangler.slice(0, span.start)}${renderTriggers(crons, indent)}${wrangler.slice(span.end)}`

  return { rendered, crons, problems: [...jobProblems, ...problems] }
}

/** Writes, or with `checking` only compares, `backend`'s `wrangler.jsonc`. The exit code; exported for the tests. */
export function run(backend: string, { checking }: { checking: boolean }): 0 | 1 {
  const path = wranglerOf(backend)
  const existing = readFileSync(path, 'utf8')
  const { rendered, crons, problems } = generateWorkerdCrons(backend, existing)

  if (problems.length > 0) {
    report('workerd-crons', problems)
    return 1
  }

  if (checking) {
    if (existing !== rendered) {
      heading('workerd-crons')
      console.info(`  ${RED}✖${RESET} wrangler.jsonc's cron triggers are out of date with the job registry.`)
      console.info(`    ${DIM}${crons.length} schedules found in the enabled jobs.${RESET}`)
      console.info(`    ${YELLOW}→${RESET} run \`pnpm --filter backend run jobs:generate\` and commit the result`)
      console.info('')
      return 1
    }
    console.info(
      `${GREEN}✔${RESET} workerd-crons — wrangler.jsonc matches the job registry. ${DIM}${crons.length} schedules.${RESET}`,
    )
    return 0
  }

  if (existing === rendered) {
    console.info(`${GREEN}✔${RESET} workerd-crons — already current. ${DIM}${crons.length} schedules.${RESET}`)
    return 0
  }
  writeFileSync(path, rendered)
  console.info(`${GREEN}✔${RESET} workerd-crons — wrote wrangler.jsonc. ${DIM}${crons.length} schedules.${RESET}`)
  return 0
}

if (isEntryPoint(import.meta.url)) process.exit(run(BACKEND, { checking: process.argv.includes('--check') }))
