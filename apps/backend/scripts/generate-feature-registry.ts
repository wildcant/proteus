import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ts from 'typescript'
import { parse } from './ts-source.js'

const RED = '\x1b[0;31m'
const GREEN = '\x1b[0;32m'
const YELLOW = '\x1b[0;33m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

type FeatureEntry = { id: string; title: string; module: string }
type Problem = { location: string; message: string; remedy: string }

const root = fileURLToPath(new URL('../../../', import.meta.url))
const MODULES_DIR = `${root}apps/backend/src/modules`
const OUTPUT = `${root}apps/backend/src/core/access-control/features.gen.ts`

function extractStringLiteral(node: ts.Node): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }
  return undefined
}

function extractFeatures(source: ts.SourceFile, modulePath: string): { features: FeatureEntry[]; problems: Problem[] } {
  const features: FeatureEntry[] = []
  const problems: Problem[] = []
  let moduleKey: string | undefined

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Module' &&
      node.arguments.length >= 2
    ) {
      const keyArg = node.arguments[0] as ts.Expression
      if (ts.isStringLiteral(keyArg)) {
        moduleKey = keyArg.text
      } else if (ts.isPropertyAccessExpression(keyArg)) {
        const propName = keyArg.name.text
        const moduleKeyMap: Record<string, string> = {
          AUTH: 'auth',
          USER: 'user',
          CUSTOMER: 'customer',
          CART: 'cart',
          ORDER: 'order',
          PAYMENT: 'payment',
          PROMOTION: 'promotion',
          INVENTORY: 'inventory',
          PRICING: 'pricing',
          PRODUCT: 'product',
          FULFILLMENT: 'fulfillment',
          NOTIFICATION: 'notification',
          FILE: 'file',
          REGION: 'region',
          STOCK_LOCATION: 'stockLocation',
          STORE: 'store',
          ACCESS_CONTROL: 'access-control',
        }
        moduleKey = moduleKeyMap[propName]
      }

      const configArg = node.arguments[1] as ts.Expression
      if (ts.isObjectLiteralExpression(configArg)) {
        for (const prop of configArg.properties) {
          if (
            ts.isPropertyAssignment(prop) &&
            ts.isIdentifier(prop.name) &&
            prop.name.text === 'features' &&
            ts.isArrayLiteralExpression(prop.initializer)
          ) {
            for (const element of prop.initializer.elements) {
              if (ts.isObjectLiteralExpression(element)) {
                let id: string | undefined
                let title: string | undefined

                for (const featureProp of element.properties) {
                  if (ts.isPropertyAssignment(featureProp) && ts.isIdentifier(featureProp.name)) {
                    if (featureProp.name.text === 'id') {
                      id = extractStringLiteral(featureProp.initializer)
                    } else if (featureProp.name.text === 'title') {
                      title = extractStringLiteral(featureProp.initializer)
                    }
                  }
                }

                const location = `${modulePath}:${source.getLineAndCharacterOfPosition(element.getStart(source)).line + 1}`

                if (!id || !title) {
                  problems.push({
                    location,
                    message: 'feature entry missing string-literal id or title',
                    remedy: 'both id and title must be inline string literals',
                  })
                  continue
                }

                features.push({ id, title, module: moduleKey ?? '' })
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  ts.forEachChild(source, visit)

  if (features.length > 0 && !moduleKey) {
    problems.push({
      location: modulePath,
      message: 'features found but Module() key could not be extracted',
      remedy: 'pass the module key as a string literal to Module()',
    })
  }

  return { features, problems }
}

function discover(): { features: FeatureEntry[]; problems: Problem[] } {
  const allFeatures: FeatureEntry[] = []
  const allProblems: Problem[] = []

  const moduleDirs = readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))

  for (const dir of moduleDirs) {
    const indexPath = join(MODULES_DIR, dir.name, 'index.ts')
    let source: string
    try {
      source = readFileSync(indexPath, 'utf8')
    } catch {
      continue
    }

    const relPath = relative(root, indexPath)
    const parsed = parse({ path: relPath, source })
    const { features, problems } = extractFeatures(parsed, relPath)
    allFeatures.push(...features)
    allProblems.push(...problems)
  }

  return { features: allFeatures, problems: allProblems }
}

function duplicates(features: FeatureEntry[]): Problem[] {
  const seen = new Map<string, FeatureEntry>()
  const problems: Problem[] = []

  for (const feature of features) {
    const first = seen.get(feature.id)
    if (first) {
      problems.push({
        location: `module "${feature.module}"`,
        message: `duplicate feature id "${feature.id}" — also declared in module "${first.module}"`,
        remedy: 'each feature id must be unique across all modules',
      })
      continue
    }
    seen.set(feature.id, feature)
  }

  return problems
}

function render(features: FeatureEntry[]): string {
  const entries = features.map((f) => `  { id: '${f.id}', title: '${f.title}', module: '${f.module}' },`).join('\n')

  return `// GENERATED by \`pnpm --filter backend run features:generate\`. Do not edit — your change will be overwritten.

import type { ModuleId, PermissionKey } from '@core/types/access-control/common.js'

export type GeneratedFeature = { id: PermissionKey; title: string; module: ModuleId }

export const GENERATED_FEATURES: GeneratedFeature[] = [
${entries}
] as const satisfies GeneratedFeature[]
`
}

function heading(title: string): void {
  console.info('')
  console.info(`${RED}${BOLD}${title}${RESET} ${DIM}${'━'.repeat(Math.max(0, 76 - title.length))}${RESET}`)
  console.info('')
}

function report(problems: Problem[]): void {
  heading('feature-registry')
  for (const problem of problems) {
    console.info(`  ${DIM}${problem.location}${RESET}`)
    console.info(`    ${problem.message}`)
    console.info(`    ${YELLOW}→${RESET} ${problem.remedy}`)
    console.info('')
  }
}

const checking = process.argv.includes('--check')
const { features, problems } = discover()
const allProblems = [...problems, ...duplicates(features)]

if (allProblems.length > 0) {
  report(allProblems)
  process.exit(1)
}

function existingOutput(): string {
  try {
    return readFileSync(OUTPUT, 'utf8')
  } catch {
    return ''
  }
}

const rendered = render(features)
const existing = existingOutput()

if (checking) {
  if (existing !== rendered) {
    heading('feature-registry')
    console.info(`  ${RED}✖${RESET} features.gen.ts is out of date with src/modules/.`)
    console.info(`    ${DIM}${features.length} features found in the source tree.${RESET}`)
    console.info(`    ${YELLOW}→${RESET} run \`pnpm --filter backend run features:generate\` and commit the result`)
    console.info('')
    process.exit(1)
  }
  console.info(
    `${GREEN}✔${RESET} feature-registry — features.gen.ts matches src/modules/. ${DIM}${features.length} features.${RESET}`,
  )
} else {
  if (existing === rendered) {
    console.info(`${GREEN}✔${RESET} feature-registry — already current. ${DIM}${features.length} features.${RESET}`)
  } else {
    writeFileSync(OUTPUT, rendered)
    console.info(
      `${GREEN}✔${RESET} feature-registry — wrote features.gen.ts. ${DIM}${features.length} features.${RESET}`,
    )
  }
}
