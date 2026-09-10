/**
 * Turning a `.ts` file into a syntax tree, for the checks and generators that read this backend
 * without running it.
 *
 * Three tools need it: `replay-purity.ts` and `generate-workflow-registry.ts` over
 * `src/workflows/`, and `generate-subscriber-registry.ts` over `src/subscribers/`. It lives on its
 * own so none of them owns the `typescript` import, and so a fourth does not have to pick one of
 * them to borrow from.
 *
 * Syntactic and single-file on purpose. No `ts.Program`, no type checker, no tsconfig: every
 * question those tools ask is answerable from one file's syntax, and a Program over this backend
 * costs seconds and a resolved module graph to answer none of them.
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
