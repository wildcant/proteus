import type { Dirent } from 'node:fs'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { is } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import * as ts from 'typescript'
import { parse } from '../ts-source.js'
import type { Model } from './types.js'

export const BACKEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const MODULES_DIR = join(BACKEND_ROOT, 'src/modules')
const LINK_DEFINITIONS_DIR = join(BACKEND_ROOT, 'src/link-modules/definitions')
const LINK_MODULES = 'link-modules'

function typescriptFiles(directory: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(directory, { withFileTypes: true })
  } catch {
    return []
  }

  return entries.flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return typescriptFiles(path)
    return entry.name.endsWith('.ts') ? [path] : []
  })
}

/** The path a violation should name, relative to `apps/backend`. */
export function displayPath(file: string): string {
  return relative(BACKEND_ROOT, file)
}

/** One list of tables a cascade graph is built from, and where it is written. */
export type CascadeList = {
  /** Absolute path of the file holding the list. */
  file: string
  /** 1-based line of the list, so two lists in one file are distinguishable. */
  line: number
  /** The tables the list names. */
  tables: Set<PgTable>
}

/**
 * Every list a cascade graph is built from, found by searching for the two shapes that produce one
 * rather than by naming the files that do. A model missing from one of those lists is invisible to
 * that graph — the table keeps its foreign keys and quietly stops being reached by them, and a soft
 * delete leaves its rows readable.
 *
 * Searching rather than enumerating is the point. A hardcoded list of call sites covers the ones
 * whoever wrote it remembered, and the sites are spread across module definitions, the three
 * `sync-providers.ts` that run out-of-band for workerd, `link-modules/index.ts` and the tests that
 * reproduce a module's graph. Each is a separate list that can be incomplete on its own.
 *
 * Read from the syntax rather than by importing the file: five module definitions pull in
 * `provider-declarations.ts`, which validates env at import time, and this check runs without one.
 * Only the model files a list names are imported, and those are free of env.
 */
export async function collectCascadeLists(): Promise<CascadeList[]> {
  const lists: CascadeList[] = []

  for (const file of typescriptFiles(join(BACKEND_ROOT, 'src'))) {
    for (const found of cascadeListsIn(file)) {
      const tables = new Set<PgTable>()

      for (const modelFile of found.files) {
        const exports = await import(pathToFileURL(modelFile).href).catch(() => null)
        if (!exports) continue
        for (const value of Object.values(exports as Record<string, unknown>)) {
          if (is(value, PgTable)) tables.add(value)
        }
      }

      lists.push({ file, line: found.line, tables })
    }
  }

  return lists
}

/** `binding -> specifier` for every named import this file takes from a model directory. */
function modelImports(node: ts.Node, origin: Map<string, string>): void {
  if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return

  const specifier = node.moduleSpecifier.text
  if (!/(^|\/)(models|definitions)\//.test(specifier)) return

  const bindings = node.importClause?.namedBindings
  if (!bindings || !ts.isNamedImports(bindings)) return

  for (const element of bindings.elements) origin.set(element.name.text, specifier)
}

/** The identifiers in an object literal, whether shorthand or `key: value`. */
function objectIdentifiers(literal: ts.ObjectLiteralExpression): string[] {
  const names: string[] = []

  for (const property of literal.properties) {
    if (ts.isShorthandPropertyAssignment(property)) names.push(property.name.text)
    else if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer)) {
      names.push(property.initializer.text)
    }
  }

  return names
}

/**
 * The object literal a cascade list is written as, in either of the two shapes that produce one:
 * the `models` property of a `Module()` definition, which bootstrap passes on, and the argument
 * handed straight to `buildCascadeGraph`.
 *
 * A call that passes something other than a literal — `buildCascadeGraph(cartModule.models)` in a
 * module test — is not a list of its own. It reuses one already checked where it is written, which
 * is exactly why a test should be written that way.
 */
function cascadeLiteral(node: ts.Node): ts.ObjectLiteralExpression | undefined {
  if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === 'models') {
    return ts.isObjectLiteralExpression(node.initializer) ? node.initializer : undefined
  }

  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return undefined
  if (node.expression.text !== 'buildCascadeGraph') return undefined

  const [argument] = node.arguments
  return argument && ts.isObjectLiteralExpression(argument) ? argument : undefined
}

/**
 * Each cascade list in one file, as the model files its identifiers resolve back to.
 *
 * Importing a model file is not enough to be listed — these files import tables they hand to
 * repositories too — so this reads the list's identifiers and resolves each back to the import it
 * came from. A table imported and then left out of the list is exactly the mistake the check
 * exists to catch, so the two steps cannot be collapsed.
 */
function cascadeListsIn(sourcePath: string): { line: number; files: string[] }[] {
  let source: string
  try {
    source = readFileSync(sourcePath, 'utf8')
  } catch {
    return []
  }

  if (!source.includes('buildCascadeGraph') && !source.includes('models:')) return []

  const parsed = parse({ path: sourcePath, source })
  const origin = new Map<string, string>()
  const literals: ts.ObjectLiteralExpression[] = []

  const visit = (node: ts.Node) => {
    modelImports(node, origin)
    const literal = cascadeLiteral(node)
    if (literal) literals.push(literal)
    ts.forEachChild(node, visit)
  }

  visit(parsed)

  return literals.map((literal) => {
    const files = new Set<string>()
    for (const name of objectIdentifiers(literal)) {
      const specifier = origin.get(name)
      if (specifier) files.add(join(dirname(sourcePath), specifier.replace(/\.js$/, '.ts')))
    }

    return {
      line: parsed.getLineAndCharacterOfPosition(literal.getStart(parsed)).line + 1,
      files: [...files],
    }
  })
}

function modelDirectories(): { module: string; directory: string }[] {
  const modules = readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ module: entry.name, directory: join(MODULES_DIR, entry.name, 'models') }))

  return [...modules, { module: LINK_MODULES, directory: LINK_DEFINITIONS_DIR }]
}

/**
 * Every drizzle table in the codebase, discovered by walking the model directories rather than
 * read from a registry — a new module is covered the moment its files exist, with nothing to
 * remember to update.
 */
export async function collectModels(): Promise<Model[]> {
  const models: Model[] = []
  const seen = new Set<PgTable>()

  for (const { module, directory } of modelDirectories()) {
    for (const file of typescriptFiles(directory)) {
      const exports: Record<string, unknown> = await import(pathToFileURL(file).href)
      for (const value of Object.values(exports)) {
        if (!is(value, PgTable) || seen.has(value)) continue
        seen.add(value)
        models.push({ module, file: relative(BACKEND_ROOT, file), table: value })
      }
    }
  }

  return models
}
