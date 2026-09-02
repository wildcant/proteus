/**
 * Replay purity — the invariant the Temporal adapter's whole design rests on.
 *
 * `advanceWorkflow` re-executes a workflow handler from the top on every step, handing back stored
 * outputs for the steps already done and running exactly the next one. Everything *between*
 * `ctx.step` calls therefore runs once per remaining step — 91 times over `complete-cart`'s 14 —
 * and what it computes is never recorded anywhere. A `Date.now()` there does not fail; it produces
 * a different value on every replay and the workflow proceeds on it. That is corruption rather than
 * an error, which is why this is a check and not a paragraph in a readme.
 *
 *     Inside a `createWorkflow` handler, everything outside a `ctx.step` callback
 *     must be pure and synchronous.
 *
 * A second invariant rides along, for the same reason it is checked rather than written down. Once
 * the step it was replaying to is done, the handler is *abandoned*: `src/temporal/replay.ts` hands
 * back a promise that never settles, so the handler simply stops at its next `await`. A `try` the
 * handler wrapped around that `ctx.step` therefore never reaches its `catch` or its `finally` —
 * while the simple adapter rejects into the handler and both do run. Ordinary recovery code, two
 * behaviours, no error anywhere.
 *
 *     A handler must not wrap a `ctx.step` call in its own `try`.
 *
 * A `try` *inside* a step action is the legal form and stays legal: it runs Worker-local, once, on
 * both engines, which is where a recovery path belongs.
 *
 * Scope is single-file and syntactic. Helpers under `src/workflows/*∕utils/` are pure by convention
 * and are trusted (ADR-0021, D11); what this owns is the handler body. Step *concurrency* is not
 * here either — `src/temporal/replay.ts` asserts that at runtime, where it can see two `ctx.step`
 * calls actually overlap, and `Promise.all` inside a step action stays legal.
 *
 * ## Why here, and not a Biome plugin
 *
 * D11 asked for a Biome 2 GritQL plugin to be priced before defaulting to an AST check. It was, and
 * it lost on a property that matters more than its line count: Grit patterns fail *open*. A working
 * prototype reported all 61 workflow files clean while matching nothing at all, because
 * `createWorkflow($_, $_)` does not match `createWorkflow<In, Out>(…)` — a call with type arguments
 * needs a separately written `createWorkflow<$...>($...)` twin, and so does `ctx.step<T>(…)`. Every
 * pattern needs that twin, nothing tells you when one is missing, and the symptom is a green check.
 * For an invariant whose violation is silent corruption, a checker that goes quiet the same way is
 * the wrong trade. A plugin's diagnostics are also one fixed sentence each, where the checks in this
 * repo print what is wrong *and* what to do instead.
 *
 * ## Why at the repo root, and not `apps/backend/scripts/checks/`
 *
 * Where D11 expected it, `typescript` resolves to `apps/backend/node_modules/typescript`, which is
 * 7.x — the native compiler, shipping no JS API: no `createSourceFile`, no `SyntaxKind`. A check
 * there would have to bring its own parser as a new dependency. At the repo root `typescript`
 * resolves to the 6.x that `apps/admin` and `apps/store` already build with, so the check costs
 * nothing but a declaration in the root `package.json` — and it sits beside `check-env-usage.sh`
 * and the other two convention checks `verify.sh` already runs, which is the same job it joins.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ts from 'typescript'

/** Stable ids, so the fixture pass can assert every rule still fires rather than just "something did". */
type PurityRule =
  | 'await-outside-step'
  | 'try-around-step'
  | 'wall-clock'
  | 'randomness'
  | 'crypto'
  | 'process-env'
  | 'container-access'
  | 'unreadable-handler'

type Violation = {
  rule: PurityRule
  /** `file:line`, so a violation prints as a clickable location. */
  location: string
  message: string
  /** What the author should do about it. */
  remedy: string
}

type SourceFileInput = { path: string; source: string }

type Report = {
  /** Workflow names found, in file order. The count is the check's own coverage claim. */
  workflows: string[]
  violations: Violation[]
}

/** Every rule the fixture is written to trip. A rule missing from here is how this check would rot. */
const EXPECTED_IN_FIXTURE: PurityRule[] = [
  'await-outside-step',
  'try-around-step',
  'wall-clock',
  'randomness',
  'crypto',
  'process-env',
  'container-access',
  'unreadable-handler',
]

const RULE = 'inside a createWorkflow handler, everything outside a ctx.step callback is pure and synchronous'

const RED = '\x1b[0;31m'
const GREEN = '\x1b[0;32m'
const YELLOW = '\x1b[0;33m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

/**
 * Each file is parsed on its own — no `ts.Program`, no type checker, no `tsconfig`.
 *
 * Every rule below is answerable from syntax, and a `Program` over this backend costs seconds and a
 * resolved module graph to answer questions this check does not ask.
 */
function analyze(files: SourceFileInput[]): Report {
  const workflows: string[] = []
  const violations: Violation[] = []

  for (const file of files) {
    const source = ts.createSourceFile(file.path, file.source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

    for (const call of findCreateWorkflowCalls(source)) {
      workflows.push(workflowNameOf(call) ?? '(unnamed)')
      violations.push(...analyzeHandler(call, workflowNameOf(call) ?? '(unnamed)', source, file.path))
    }
  }

  return { workflows, violations }
}

function findCreateWorkflowCalls(source: ts.SourceFile): ts.CallExpression[] {
  const found: ts.CallExpression[] = []

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createWorkflow') {
      found.push(node)
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return found
}

/** `createWorkflow('name', …)` or `createWorkflow({ name: 'name', idempotent: true }, …)`. */
function workflowNameOf(call: ts.CallExpression): string | undefined {
  const first = call.arguments[0]
  if (!first) return undefined
  if (ts.isStringLiteralLike(first)) return first.text
  if (!ts.isObjectLiteralExpression(first)) return undefined

  for (const property of first.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    if (property.name.getText() !== 'name') continue
    if (ts.isStringLiteralLike(property.initializer)) return property.initializer.text
  }

  return undefined
}

function analyzeHandler(call: ts.CallExpression, name: string, source: ts.SourceFile, path: string): Violation[] {
  const at = (node: ts.Node) => `${path}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`

  const handler = call.arguments[1]
  if (!handler || (!ts.isArrowFunction(handler) && !ts.isFunctionExpression(handler))) {
    return [
      {
        rule: 'unreadable-handler',
        location: at(call),
        message: `workflow "${name}" does not pass its handler inline, so nothing about its body is visible here`,
        remedy: 'write the handler as an inline `async (ctx, input) => { … }` argument to createWorkflow',
      },
    ]
  }

  const first = handler.parameters[0]
  if (!first || !ts.isIdentifier(first.name)) {
    return [
      {
        rule: 'unreadable-handler',
        location: at(handler),
        message: `workflow "${name}" does not name its context parameter, so its \`step\` calls cannot be identified`,
        remedy: 'take the context as a plain named parameter — `async (ctx, input) => { … }`',
      },
    ]
  }

  const ctx = first.name.text
  const violations: Violation[] = []

  /**
   * The pure region is the handler body minus the action and compensation callbacks of every
   * `ctx.step` call. The step *name* argument stays in the region on purpose: it is rebuilt on every
   * replay like the rest of the glue, so a step name computed from the clock is the same bug.
   */
  const walk = (node: ts.Node) => {
    if (asStepCall(node, ctx)) {
      const nameArgument = (node as ts.CallExpression).arguments[0]
      if (nameArgument) walk(nameArgument)
      return
    }

    violations.push(...inspect(node, ctx, name, at))
    ts.forEachChild(node, walk)
  }

  walk(handler.body)
  return violations
}

/** `ctx.step(…)`, with or without an explicit type argument. */
function asStepCall(node: ts.Node, ctx: string): ts.CallExpression | undefined {
  if (!ts.isCallExpression(node)) return undefined
  const callee = node.expression
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'step') return undefined
  if (!ts.isIdentifier(callee.expression) || callee.expression.text !== ctx) return undefined
  return node
}

function inspect(node: ts.Node, ctx: string, name: string, at: (node: ts.Node) => string): Violation[] {
  const found: Violation[] = []
  const report = (rule: PurityRule, message: string, remedy: string) =>
    found.push({ rule, location: at(node), message: `workflow "${name}" ${message}`, remedy })

  const clockRemedy = `take the timestamp inside a \`${ctx}.step(…)\` action, where it is recorded once and replayed`

  if (ts.isAwaitExpression(node) && !isAllowedAwait(node.expression, ctx)) {
    report(
      'await-outside-step',
      `awaits something other than \`${ctx}.step(…)\` between steps`,
      `move the work inside a \`${ctx}.step(…)\` action, or into a helper that takes \`${ctx}\` and calls \`${ctx}.step\` itself`,
    )
  }

  // Not a purity rule but the same failure shape: silent, and only on one of the two engines. The
  // `try` is reported, rather than the `ctx.step` inside it, because the `try` is the part to move.
  if (ts.isTryStatement(node) && containsStepCall(node.tryBlock, ctx)) {
    const guards = [node.catchClause ? 'catch' : '', node.finallyBlock ? 'finally' : '']
      .filter(Boolean)
      .map((clause) => `\`${clause}\``)
      .join(' and its ')

    report(
      'try-around-step',
      `wraps a \`${ctx}.step(…)\` call in its own \`try\`, whose ${guards} runs under the simple adapter ` +
        'and never under Temporal',
      `handle the failure inside the \`${ctx}.step(…)\` action, where it runs on both engines — or let the ` +
        'step throw and let the workflow compensate',
    )
  }

  if (ts.isForOfStatement(node) && node.awaitModifier) {
    report(
      'await-outside-step',
      'uses `for await` between steps',
      `collect the values inside a \`${ctx}.step(…)\` action and iterate the result synchronously`,
    )
  }

  // `new Date(iso)` is a parse and stays. `new Date()` reads the clock, and every replay reads a
  // different one.
  if (ts.isNewExpression(node) && node.expression.getText() === 'Date' && (node.arguments?.length ?? 0) === 0) {
    report('wall-clock', 'reads the wall clock with `new Date()` between steps', clockRemedy)
  }

  if (isMemberOf(node, 'Date', 'now')) {
    report('wall-clock', 'reads the wall clock with `Date.now()` between steps', clockRemedy)
  }

  if (isMemberOf(node, 'Math', 'random')) {
    report(
      'randomness',
      'calls `Math.random()` between steps',
      `generate the value inside a \`${ctx}.step(…)\` action so every replay sees the same one`,
    )
  }

  if (isMemberOf(node, 'crypto')) {
    report(
      'crypto',
      `reaches \`crypto.${propertyName(node)}\` between steps`,
      `generate ids and digests inside a \`${ctx}.step(…)\` action — a fresh one per replay is a different workflow`,
    )
  }

  if (isMemberOf(node, 'process', 'env')) {
    report(
      'process-env',
      'reads `process.env` between steps',
      'import the validated `env` object from `src/env.ts`, which is read once at startup',
    )
  }

  if (isMemberOf(node, 'container')) {
    report(
      'container-access',
      `reaches \`container.${propertyName(node)}\` between steps`,
      `resolve services inside a \`${ctx}.step(…)\` action, which is handed the container it should use`,
    )
  }

  return found
}

/**
 * Whether a step is reached anywhere under `block` — at any depth, including inside another step's
 * action, because a `try` in the pure region wraps everything below it regardless of nesting.
 *
 * A shared `…Step(ctx, …)` helper counts as well as a literal `ctx.step(…)`. The helper calls
 * `ctx.step` itself, so wrapping one in a `try` abandons the handler at exactly the same await, and
 * this check is single-file and cannot see that by following the import.
 */
function containsStepCall(block: ts.Block, ctx: string): boolean {
  let found = false

  const visit = (node: ts.Node) => {
    if (found) return
    if (ts.isCallExpression(node) && isAllowedAwait(node, ctx)) {
      found = true
      return
    }
    ts.forEachChild(node, visit)
  }

  visit(block)
  return found
}

/**
 * `await ctx.step(…)` is the point of the handler, and `await someStep(ctx, …)` is the documented way
 * to share one — `notifyOnFailureStep`, `findOrCreateCustomerStep` and `setAuthAppMetadataStep` all
 * take the context and call `ctx.step` themselves. Anything else awaited in the pure region is I/O
 * the replay would repeat.
 *
 * The callee has to be *named* like a step helper as well as be handed the context. Taking "`ctx`
 * appears somewhere in the argument list" as the whole test let `await db.query(ctx)` and
 * `await loadCart(ctx, input.id)` through — raw I/O in the pure region, admitted by the shape of an
 * argument list rather than by anything about the callee, which is precisely what this rule exists
 * to catch. The naming convention is what separates the two, all three real helpers follow it, and a
 * new helper that does not is a rename away from passing rather than a hole.
 */
function isAllowedAwait(expression: ts.Expression, ctx: string): boolean {
  if (!ts.isCallExpression(expression)) return false
  if (asStepCall(expression, ctx)) return true

  const takesContext = expression.arguments.some((argument) => ts.isIdentifier(argument) && argument.text === ctx)
  return takesContext && STEP_HELPER.test(calleeName(expression) ?? '')
}

/** What a shared `ctx.step` wrapper is called: `notifyOnFailureStep`, `findOrCreateCustomerStep`, … */
const STEP_HELPER = /Step$/

/** The name a call is made through — `helper(…)` or `helpers.named(…)`. */
function calleeName(call: ts.CallExpression): string | undefined {
  if (ts.isIdentifier(call.expression)) return call.expression.text
  if (ts.isPropertyAccessExpression(call.expression)) return call.expression.name.text
  return undefined
}

/** `object.property`, or any property of `object` when `property` is omitted. */
function isMemberOf(node: ts.Node, object: string, property?: string): boolean {
  if (!ts.isPropertyAccessExpression(node)) return false
  if (!ts.isIdentifier(node.expression) || node.expression.text !== object) return false
  return property === undefined || node.name.text === property
}

function propertyName(node: ts.Node): string {
  return ts.isPropertyAccessExpression(node) ? node.name.text : '?'
}

/** Every `.ts` under `directory`, minus `__tests__` — those hold deliberately odd handlers. */
function collect(directory: string, root: string): SourceFileInput[] {
  const files: SourceFileInput[] = []

  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(path)
      } else if (entry.name.endsWith('.ts')) {
        files.push({ path: relative(root, path), source: readFileSync(path, 'utf8') })
      }
    }
  }

  walk(resolve(directory))
  return files
}

function heading(title: string): void {
  console.info('')
  console.info(`${RED}${BOLD}${title}${RESET} ${DIM}${'━'.repeat(Math.max(0, 76 - title.length))}${RESET}`)
  console.info('')
}

function print(violation: Violation): void {
  console.info(`  ${DIM}${violation.location}${RESET}`)
  console.info(`    ${violation.message}`)
  console.info(`    ${YELLOW}→${RESET} ${violation.remedy}`)
  console.info('')
}

/*
 * Two passes, in this order and deliberately.
 *
 * 1. The fixture, which breaks the rule in every way this file knows about. If one of them stops
 *    being reported, the run fails — a check that has silently stopped matching produces exactly the
 *    output of a codebase with nothing wrong in it, and this is what tells the two apart.
 * 2. The workflows. The count is printed on success, so "it passed" also says how much it read.
 */
const root = fileURLToPath(new URL('../..', import.meta.url))

const fixture = analyze(collect(`${root}/scripts/checks/fixtures`, root))
const missing = EXPECTED_IN_FIXTURE.filter((rule) => !fixture.violations.some((found) => found.rule === rule))

const workflows = analyze(collect(`${root}/apps/backend/src/workflows`, root))

if (missing.length > 0) {
  heading('replay-purity — the check itself')
  console.info(`  ${RED}✖${RESET} The impure fixture no longer trips every rule, so this check proves nothing.`)
  console.info('')
  console.info(`  ${DIM}scripts/checks/fixtures/impure-workflow.ts${RESET}`)
  console.info(`    nothing was reported for: ${missing.join(', ')}`)
  console.info(
    `    ${YELLOW}→${RESET} restore the fixture case, or drop the rule from EXPECTED_IN_FIXTURE if it went on purpose`,
  )
  console.info('')
}

if (workflows.violations.length > 0) {
  heading('replay-purity')
  console.info(`  ${RED}✖${RESET} Rule: ${RULE}.`)
  console.info(`    ${DIM}A handler body re-runs once per remaining step and what it computes is never recorded,`)
  console.info(`    so impurity there corrupts a run rather than failing it.${RESET}`)
  console.info('')
  for (const violation of workflows.violations) print(violation)
  console.info(`  Found ${RED}${workflows.violations.length}${RESET} violation(s).`)
  console.info('')
}

if (missing.length > 0 || workflows.violations.length > 0) process.exit(1)

console.info(
  `${GREEN}✔${RESET} replay-purity — ${RULE}. ` +
    `${DIM}${workflows.workflows.length} workflows checked; the impure fixture still trips all ${EXPECTED_IN_FIXTURE.length} rules.${RESET}`,
)
