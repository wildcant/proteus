/**
 * Reading `createWorkflow` calls out of `src/workflows/` without running any of it.
 *
 * Two tools need the same answer to "which workflows exist, and where": `checks/replay-purity.ts`,
 * which analyses each handler body, and `generate-workflow-registry.ts`, which writes the import
 * list the Worker registers from. Extracted here so they cannot disagree — a generator that finds a
 * workflow the purity check does not, or the reverse, is a bug that would present as a workflow
 * silently exempt from one of them.
 *
 * Syntactic and single-file on purpose. No `ts.Program`, no type checker, no tsconfig: every
 * question asked here is answerable from one file's syntax, and a Program over this backend costs
 * seconds and a resolved module graph to answer none of them.
 *
 * ## Why the whole repo is still on TypeScript 6
 *
 * This import is the reason. Every workspace pins `^6.0.3` — the last release whose npm package is a
 * JS library — because this file needs `createSourceFile`, and 7.x does not have it.
 *
 * 7.x was evaluated properly, not assumed away. It does ship an API, under `typescript/unstable/*`,
 * with `SyntaxKind` and all 347 type guards. What it has no version of is *parsing*:
 * `createSourceFile` and `forEachChild` are both `undefined`, and the only `createSourceFile` in the
 * package is the node *factory*, which assembles a synthetic file out of statements you already
 * have. Its real compiler API (`unstable/sync`) is an LSP client that spawns the Go binary and
 * returns node *handles* over IPC — a tsconfig, a project graph and a child process, to answer
 * "which files call `createWorkflow`". That is the opposite of the paragraph above.
 *
 * The cost is real and was measured: typechecking the three apps takes ~13s on 6.x against ~4s on
 * the native 7.x compiler. It does not move `npm run verify`, where the type-check suite finishes
 * well inside the backend test suite it runs beside. Revisit when a stable standalone parser ships;
 * that is the single thing blocking the upgrade.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import * as ts from 'typescript'

export type SourceFileInput = { path: string; source: string }

/** Every `.ts` under `directory`, minus `__tests__` — those hold deliberately odd handlers. */
export function collect(directory: string, root: string): SourceFileInput[] {
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

/**
 * `setParentNodes` is the `true` in here and it is load-bearing, not a default: `exportedBindingOf`
 * walks *upwards* from a call to the statement that exports it, and without parent pointers that
 * walk has nothing to follow.
 */
export function parse(file: SourceFileInput): ts.SourceFile {
  return ts.createSourceFile(file.path, file.source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

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
