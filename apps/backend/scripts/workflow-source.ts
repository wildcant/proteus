/**
 * Reading `createWorkflow` calls out of `src/workflows/` without running any of it.
 *
 * `generate-workflow-registry.ts` needs it, to write the import list the Worker registers from.
 * It was extracted when a second reader wanted the same answer — the replay-purity check, since
 * converted to rules under `standards/rules/backend/workflows/` — and it stays a file of its own
 * because the question it answers is not the generator's job: what counts as a workflow is a fact
 * about the source tree, and the registry is one thing built from it.
 *
 * Parsing itself is `ts-source.ts`, shared with the subscriber registry generator and carrying the
 * reason the repo is pinned to TypeScript 6. What is here is only what a *workflow* file means.
 */

import * as ts from 'typescript'

export function findCreateWorkflowCalls(source: ts.SourceFile): ts.CallExpression[] {
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
export function workflowNameOf(call: ts.CallExpression): string | undefined {
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

/**
 * The exported `const` a call is assigned to — `addToCartWorkflow` in
 * `export const addToCartWorkflow = createWorkflow(…)`.
 *
 * `undefined` means the workflow cannot be imported by name, and every caller treats that as an
 * error rather than skipping it: an unexported workflow can never reach the registry, so passing
 * over it quietly would reintroduce exactly the "registered nowhere, fails at runtime" bug the
 * generator exists to remove.
 */
export function exportedBindingOf(call: ts.CallExpression): string | undefined {
  const declaration = call.parent
  if (!declaration || !ts.isVariableDeclaration(declaration)) return undefined
  if (declaration.initializer !== call) return undefined
  if (!ts.isIdentifier(declaration.name)) return undefined

  const statement = declaration.parent?.parent
  if (!statement || !ts.isVariableStatement(statement)) return undefined
  if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) return undefined

  return declaration.name.text
}
