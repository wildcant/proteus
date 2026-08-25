/**
 * Schema convention checks.
 *
 * The other convention checks in `scripts/` are bash and grep, which is enough when the rule is
 * about the text of a file. These rules are not: whether a relationship cascades, which column an
 * index leads with, and whether a predicate excludes soft-deleted rows are all facts that only
 * exist once drizzle has built the table. So this runner imports the models and reads their
 * metadata, and every schema rule that follows belongs here rather than in a new bash script.
 *
 * A check is a `{ name, rule, run }` triple over the collected models. Add one to CHECKS below.
 */
import { cascadeRelationshipIndex } from './cascade-relationship-index.js'
import { destroyOnlyChildren } from './destroy-only-children.js'
import { guardOutsideItsClosure } from './guard-outside-its-closure.js'
import { modelBarrelReachable } from './model-barrel-reachable.js'
import { collectModels } from './models.js'
import { softDeleteIndexPredicate } from './soft-delete-index-predicate.js'
import { standardTimestamps } from './standard-timestamps.js'
import type { Check } from './types.js'

const CHECKS: Check[] = [
  softDeleteIndexPredicate,
  cascadeRelationshipIndex,
  modelBarrelReachable,
  standardTimestamps,
  destroyOnlyChildren,
  guardOutsideItsClosure,
]

const RED = '\x1b[0;31m'
const GREEN = '\x1b[0;32m'
const YELLOW = '\x1b[0;33m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const models = await collectModels()
let failed = false

// Every check runs even after one fails, so a single run reports every violation at once.
for (const check of CHECKS) {
  const violations = await check.run(models)

  if (violations.length === 0) {
    console.info(`${GREEN}✔${RESET} ${check.name} — ${check.rule}.`)
    continue
  }

  const warning = check.severity === 'warning'
  const colour = warning ? YELLOW : RED
  failed ||= !warning

  console.info('')
  console.info(`${colour}${BOLD}${check.name}${RESET} ${DIM}${'━'.repeat(76 - check.name.length)}${RESET}`)
  console.info('')
  console.info(`  ${colour}${warning ? '!' : '✖'}${RESET} Rule: ${check.rule}.`)
  console.info('')

  for (const violation of violations) {
    console.info(`  ${DIM}${violation.location}${RESET}`)
    console.info(`    ${violation.message}`)
    console.info(`    ${YELLOW}→${RESET} ${violation.remedy}`)
    console.info('')
  }

  console.info(`  Found ${colour}${violations.length}${RESET} ${warning ? 'warning(s)' : 'violation(s)'}.`)
  console.info('')
}

if (failed) process.exit(1)
