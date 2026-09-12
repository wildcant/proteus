/**
 * Schema convention checks.
 *
 * A rule about the *text* of a model file belongs in `standards/rules/backend/modules/` — that is
 * where "every table spreads ...timestamps" lives. These rules are not about the text: whether a
 * relationship cascades, which column an index leads with, whether a predicate excludes
 * soft-deleted rows, and what a cascade closure reaches are all facts that exist only once drizzle
 * has built the table. So this runner imports the models and reads their metadata. A new schema
 * rule belongs here only once it has been shown that a rule file cannot express it; standards/README.md
 * records the verdict for each of the ones below.
 *
 * A check is a `{ name, rule, run }` triple over the collected models. Add one to CHECKS below.
 */
import { cascadeRelationshipIndex } from './cascade-relationship-index.js'
import { destroyOnlyChildren } from './destroy-only-children.js'
import { guardOutsideItsClosure } from './guard-outside-its-closure.js'
import { modelReachesCascadeGraph } from './model-reaches-cascade-graph.js'
import { collectModels } from './models.js'
import { softDeleteIndexPredicate } from './soft-delete-index-predicate.js'
import type { Check } from './types.js'

const CHECKS: Check[] = [
  softDeleteIndexPredicate,
  cascadeRelationshipIndex,
  modelReachesCascadeGraph,
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
