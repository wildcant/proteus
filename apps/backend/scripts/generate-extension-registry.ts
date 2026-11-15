/**
 * Writes the extension registries: `src/extensions/registry.gen.ts`, what the runtime roots read
 * (modules, store and webhook routes, hook handlers, compiled catalogs, manifests), and
 * `src/extensions/seeds.gen.ts`, the dev seed's steps, which only `scripts/seed-dev.ts` imports.
 *
 * Static imports rather than a directory scan, for the reasons the workflow, subscriber and job
 * registries have the same shape: workerd has no file system at runtime, the Temporal Worker runs
 * steps in its own process, `tsx --watch` reloads off the module graph, and `tsc` and
 * `check:structure` can only see an import. The files are committed, and `--check` fails the verify
 * gate when they drift from the source tree.
 *
 * Extensions add, never replace, so this is also where a collision with core is refused before it
 * could reach a container or a router:
 *
 * - every name an extension adds to a shared namespace carries its prefix (`extension-names.ts`):
 *   module keys and event names `<ext>.`, operation ids `<ext camel>…`, OpenAPI component names
 *   `<Ext Pascal>…`, the names a module's model files export `<ext camel>…` or `<Ext Pascal>…`;
 * - a module key, event name, operation id or component name core already has, or another
 *   extension has, fails;
 * - a route outside `/store/` or `/hooks/`, an admin route, a route core already serves (same
 *   method, same pattern whatever the parameter names), and a static path in front of a core
 *   parameter route that `RoutesSorter` would let shadow it, all fail;
 * - a second handler for one hook fails;
 * - two catalogs translating one message differently fail (`extension-catalogs.ts`).
 *
 * Workflows, subscribers and jobs are not here: their own generators scan extension folders too.
 *
 * `--fixture` writes the test registry of the fixture extension instead
 * (`tests/extension-fixture/registry.gen.ts` and `seeds.gen.ts`), adding its subscribers, which the
 * test container dispatches to in-process.
 *
 * Parsing is `ts-source.ts`, syntactic and single-file: every name checked here is a string literal
 * the generator reads without running the code.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import * as ts from 'typescript'
import { catalogConflicts, httpSchemasLocales, readCoreCatalog, readExtensionCatalogs } from './extension-catalogs.js'
import { camelPrefix, hasPrefix, isExtensionName, pascalPrefix, runtimePrefix } from './extension-names.js'
import {
  BACKEND,
  DIM,
  directoriesIn,
  GREEN,
  heading,
  isEntryPoint,
  moduleSpecifier,
  type Problem,
  RED,
  RESET,
  repoRootOf,
  report,
  YELLOW,
} from './runtime-sources.js'
import { collect, parse, type SourceFileInput } from './ts-source.js'

export type { Problem }

/** A name read out of code, and where, so a rejection prints a clickable location. */
type Named = { name: string; location: string }

type Route = { method: string; matcher: string; operationId: string | undefined; location: string }

type RouteFile = { alias: string; file: string; scope: string; routes: Route[] }

type ImportedFile = { alias: string; file: string }

type HookHandlerFile = ImportedFile & { hook: string; location: string }

type CatalogFile = ImportedFile & { language: string }

export type DiscoveredExtension = {
  name: string
  /** Absolute folder. */
  directory: string
  /** Repo-relative folder, for messages. */
  folder: string
  manifest: Named | undefined
  modules: ImportedFile[]
  moduleKeys: Named[]
  events: Named[]
  routeFiles: RouteFile[]
  componentNames: Named[]
  /** Every name a model file exports, which `src/schema.gen.ts` re-exports beside core's. */
  modelNames: Named[]
  hookHandlers: HookHandlerFile[]
  seeds: (ImportedFile & { seed: string })[]
  subscribers: ImportedFile[]
  /** Its HTTP schemas' catalog (`packages/http-schemas/src/extensions/<ext>/locales/`), then its own (`locales/`), the order the translator merges them. */
  catalogs: { directory: string; files: CatalogFile[] }[]
}

/** What core already holds in each namespace an extension writes into. */
export type CoreNames = {
  moduleKeys: Set<string>
  events: Set<string>
  operationIds: Set<string>
  componentNames: Set<string>
  routes: Route[]
}

export type GenerateOptions = {
  backend: string
  /** The folder holding one folder per extension, where both registries are written. */
  root: string
  /** Renders the extensions' subscribers too, for the test container. */
  subscribers: boolean
  /** The command that rewrites the output, for its header and the stale message. */
  command: string
}

export type GeneratedFile = { path: string; content: string }

// ---- Reading code ----------------------------------------------------------------------------

function lineOf(source: ts.SourceFile, node: ts.Node): string {
  return `${source.fileName}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`
}

/** Calls `visitor` on `node` and every node below it, depth first. */
function forEachNode(node: ts.Node, visitor: (node: ts.Node) => void): void {
  visitor(node)
  ts.forEachChild(node, (child) => forEachNode(child, visitor))
}

/** Calls to `name(...)` anywhere in the file. */
function callsTo(source: ts.SourceFile, name: string): ts.CallExpression[] {
  const calls: ts.CallExpression[] = []
  forEachNode(source, (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name) {
      calls.push(node)
    }
  })
  return calls
}

function propertyOf(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const property of object.properties) {
    if (ts.isPropertyAssignment(property) && property.name.getText() === name) return property.initializer
  }
  return undefined
}

function literalProperty(object: ts.ObjectLiteralExpression, name: string): string | undefined {
  const value = propertyOf(object, name)
  return value && ts.isStringLiteralLike(value) ? value.text : undefined
}

function defaultExport(source: ts.SourceFile): ts.Expression | ts.Node | undefined {
  for (const statement of source.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) return statement.expression
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined
    const exported = modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    const isDefault = modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
    if (exported && isDefault) return statement
  }
  return undefined
}

/** The initializer of `export const <name> = …`, or `undefined`. */
function exportedConst(source: ts.SourceFile, name: string): ts.Expression | undefined {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) return declaration.initializer
    }
  }
  return undefined
}

/** The names one top-level statement exports: `export { … }`, `export const`, `export type`, … */
function namesExportedBy(statement: ts.Statement): ts.ModuleExportName[] {
  if (ts.isExportDeclaration(statement)) {
    const clause = statement.exportClause
    return clause && ts.isNamedExports(clause) ? clause.elements.map((element) => element.name) : []
  }
  const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined
  if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) return []
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name) ? [declaration.name] : [],
    )
  }
  const declared =
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement)
  return declared && statement.name ? [statement.name] : []
}

/** Every name the file exports, values and types alike. */
function exportedNames(source: ts.SourceFile): Named[] {
  return source.statements.flatMap((statement) =>
    namesExportedBy(statement).map((name) => ({ name: name.text, location: lineOf(source, name) })),
  )
}

/** Unwraps `[…] satisfies T` and `[…] as const`. */
function unwrap(expression: ts.Expression): ts.Expression {
  if (
    ts.isSatisfiesExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  ) {
    return unwrap(expression.expression)
  }
  return expression
}

/** Every `{ method, matcher, operationId }` object literal in a definitions file. */
function routesIn(source: ts.SourceFile): Route[] {
  const routes: Route[] = []
  forEachNode(source, (node) => {
    if (!ts.isObjectLiteralExpression(node)) return
    const method = literalProperty(node, 'method')
    const matcher = literalProperty(node, 'matcher')
    if (!method || !matcher) return
    routes.push({ method, matcher, operationId: literalProperty(node, 'operationId'), location: lineOf(source, node) })
  })
  return routes
}

/** Every `.openapi('Name')` — a schema registered as an OpenAPI component under that name. */
function componentNamesIn(source: ts.SourceFile): Named[] {
  const names: Named[] = []
  forEachNode(source, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return
    if (node.expression.name.text !== 'openapi') return
    const [first] = node.arguments
    if (first && ts.isStringLiteralLike(first)) names.push({ name: first.text, location: lineOf(source, node) })
  })
  return names
}

/** `pisos-dj` + `api/store/shipping-cities` → `pisosDjApiStoreShippingCities`. */
function aliasOf(extension: string, ...parts: string[]): string {
  const words = parts.flatMap((part) => part.split(/[^A-Za-z0-9]+/)).filter(Boolean)
  return camelPrefix(extension) + words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('')
}

/** `.ts` files directly in `directory`, sorted, as repo-relative inputs. */
function filesIn(directory: string, repoRoot: string): SourceFileInput[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      path: relative(repoRoot, join(directory, name)),
      source: readFileSync(join(directory, name), 'utf8'),
    }))
}

/**
 * Which hook a handler file registers for: the first argument of `defineHookHandler(…)`, traced
 * through the file's imports to the module and export that define it. Two handlers naming the same
 * hook value from two files therefore compare equal, however each imported it.
 */
function hookIdentity(source: ts.SourceFile, call: ts.CallExpression, backend: string, repoRoot: string): string {
  const [hook] = call.arguments
  if (!hook) return ''
  const text = hook.getText(source)
  const root = text.split('.')[0] ?? text

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    const binding = bindings.elements.find((element) => element.name.text === root)
    if (!binding) continue

    const imported = (binding.propertyName ?? binding.name).text
    const specifier = statement.moduleSpecifier.text
    const aliased = specifier.match(/^@(core|framework|workflows)\/(.*)$/)
    const target = aliased
      ? join(backend, 'src', aliased[1] ?? '', aliased[2] ?? '')
      : resolve(dirname(join(repoRoot, source.fileName)), specifier)
    const module = relative(repoRoot, target).replace(/\.js$/, '')
    return `${module}#${[imported, ...text.split('.').slice(1)].join('.')}`
  }

  return `${source.fileName}#${text}`
}

// ---- Discovery -------------------------------------------------------------------------------

/** One extension folder being read: where it is, and where its problems go. */
type ExtensionFolder = { name: string; directory: string; backend: string; repoRoot: string; problems: Problem[] }

/** A path inside the extension folder. */
function pathIn(folder: ExtensionFolder, ...parts: string[]): string {
  return join(folder.directory, ...parts)
}

function readManifest(folder: ExtensionFolder): Named | undefined {
  const path = pathIn(folder, 'extension.ts')
  if (!existsSync(path)) return undefined

  const source = parse({ path: relative(folder.repoRoot, path), source: readFileSync(path, 'utf8') })
  const [call] = callsTo(source, 'defineExtension')
  const config = call?.arguments[0]
  const manifestName = config && ts.isObjectLiteralExpression(config) ? literalProperty(config, 'name') : undefined
  if (call && manifestName) return { name: manifestName, location: lineOf(source, call) }

  folder.problems.push({
    location: source.fileName,
    message: 'the manifest does not name the extension with a string literal',
    remedy: `export default defineExtension({ name: '${folder.name}' })`,
  })
  return undefined
}

function readModules(folder: ExtensionFolder): ImportedFile[] {
  return directoriesIn(pathIn(folder, 'modules'))
    .filter((module) => existsSync(pathIn(folder, 'modules', module, 'index.ts')))
    .map((module) => ({
      alias: aliasOf(folder.name, module, 'module'),
      file: relative(folder.repoRoot, pathIn(folder, 'modules', module, 'index.ts')),
    }))
}

/**
 * The string literal each `callee(…)` call in `source` names, read by `nameOf` from its first argument;
 * a call it cannot read is a problem, since its name could not be checked.
 */
function literalNames(
  folder: ExtensionFolder,
  source: ts.SourceFile,
  callee: string,
  nameOf: (argument: ts.Expression) => string | undefined,
  remedy: string,
): Named[] {
  return callsTo(source, callee).flatMap((call) => {
    const [argument] = call.arguments
    const name = argument ? nameOf(argument) : undefined
    if (name) return [{ name, location: lineOf(source, call) }]
    folder.problems.push({
      location: lineOf(source, call),
      message: `a ${callee}(…) whose name is not a string literal`,
      remedy,
    })
    return []
  })
}

function readModuleKeys(folder: ExtensionFolder): Named[] {
  const path = pathIn(folder, 'keys.ts')
  if (!existsSync(path)) return []
  const source = parse({ path: relative(folder.repoRoot, path), source: readFileSync(path, 'utf8') })
  return literalNames(
    folder,
    source,
    'defineModuleKey',
    (argument) => (ts.isStringLiteralLike(argument) ? argument.text : undefined),
    `write the key inline — defineModuleKey<IService>('${runtimePrefix(folder.name)}module') — so it can be checked`,
  )
}

/** Events and OpenAPI component names may be declared anywhere in the extension, so every file is read. */
function readDeclaredNames(folder: ExtensionFolder): { events: Named[]; componentNames: Named[] } {
  const events: Named[] = []
  const componentNames: Named[] = []
  for (const file of existsSync(folder.directory) ? collect(folder.directory, folder.repoRoot) : []) {
    const source = parse(file)
    events.push(
      ...literalNames(
        folder,
        source,
        'defineEvent',
        (argument) => (ts.isObjectLiteralExpression(argument) ? literalProperty(argument, 'name') : undefined),
        `write the name inline — defineEvent<Payload>({ name: '${runtimePrefix(folder.name)}something_happened' })`,
      ),
    )
    componentNames.push(...componentNamesIn(source))
  }
  return { events, componentNames }
}

/**
 * The names each module's model files export. `src/schema.gen.ts` re-exports every model file of
 * core and the extensions with `export *`, so an unprefixed name would only clash there, after a
 * later core release adds the same one.
 */
function readModelNames(folder: ExtensionFolder): Named[] {
  return directoriesIn(pathIn(folder, 'modules')).flatMap((module) => {
    const models = pathIn(folder, 'modules', module, 'models')
    if (!existsSync(models)) return []
    return collect(models, folder.repoRoot).flatMap((file) => exportedNames(parse(file)))
  })
}

function readRouteFiles(folder: ExtensionFolder): RouteFile[] {
  const api = pathIn(folder, 'api')
  if (!existsSync(api)) return []
  return collect(api, folder.repoRoot)
    .filter((file) => basename(file.path) === 'definitions.ts')
    .map((file) => {
      const path = relative(api, join(folder.repoRoot, file.path))
      return {
        alias: aliasOf(folder.name, dirname(path), 'routes'),
        file: file.path,
        scope: path.split('/')[0] ?? '',
        routes: routesIn(parse(file)),
      }
    })
}

function readHookHandlers(folder: ExtensionFolder): HookHandlerFile[] {
  return filesIn(pathIn(folder, 'hooks'), folder.repoRoot).flatMap((file) => {
    const source = parse(file)
    const handler = exportedConst(source, 'handler')
    const call = handler ? unwrap(handler) : undefined
    if (!call || !ts.isCallExpression(call)) {
      folder.problems.push({
        location: file.path,
        message: 'no `export const handler = defineHookHandler(…)`',
        remedy:
          'export the handler as `export const handler = defineHookHandler(theHook, { run })`, or move this file out of hooks/',
      })
      return []
    }
    return [
      {
        alias: aliasOf(folder.name, basename(file.path, '.ts'), 'hook handler'),
        file: file.path,
        hook: hookIdentity(source, call, folder.backend, folder.repoRoot),
        location: lineOf(source, call),
      },
    ]
  })
}

function readSeeds(folder: ExtensionFolder): DiscoveredExtension['seeds'] {
  return filesIn(pathIn(folder, 'seeds'), folder.repoRoot).flatMap((file) => {
    if (!defaultExport(parse(file))) {
      folder.problems.push({
        location: file.path,
        message: 'a seed file with no default export',
        remedy: 'export the step as `export default seedSomething`, typed `ExtensionSeedStep`',
      })
      return []
    }
    const seed = basename(file.path, '.ts')
    return [{ alias: aliasOf(folder.name, seed, 'seed'), file: file.path, seed }]
  })
}

function readSubscribers(folder: ExtensionFolder): ImportedFile[] {
  return filesIn(pathIn(folder, 'subscribers'), folder.repoRoot)
    .filter((file) => exportedConst(parse(file), 'config'))
    .map((file) => ({ alias: aliasOf(folder.name, basename(file.path, '.ts'), 'subscriber'), file: file.path }))
}

function readCatalogFiles(folder: ExtensionFolder): DiscoveredExtension['catalogs'] {
  const directories = [
    { directory: httpSchemasLocales(folder.name), label: 'schema messages' },
    { directory: pathIn(folder, 'locales'), label: 'messages' },
  ]
  return directories.flatMap(({ directory, label }) => {
    const files = filesIn(directory, folder.repoRoot).map((file) => {
      const language = basename(file.path, '.ts')
      return { alias: aliasOf(folder.name, label, language), file: file.path, language }
    })
    return files.length > 0 ? [{ directory, files }] : []
  })
}

function discoverExtension(name: string, options: GenerateOptions, problems: Problem[]): DiscoveredExtension {
  const repoRoot = repoRootOf(options.backend)
  const directory = join(options.root, name)
  const folder: ExtensionFolder = { name, directory, backend: options.backend, repoRoot, problems }

  return {
    name,
    directory,
    folder: relative(repoRoot, directory),
    manifest: readManifest(folder),
    modules: readModules(folder),
    moduleKeys: readModuleKeys(folder),
    ...readDeclaredNames(folder),
    modelNames: readModelNames(folder),
    routeFiles: readRouteFiles(folder),
    hookHandlers: readHookHandlers(folder),
    seeds: readSeeds(folder),
    subscribers: options.subscribers ? readSubscribers(folder) : [],
    catalogs: readCatalogFiles(folder),
  }
}

/** Every extension folder under `root`, with the problems folder them raised. */
export function discoverExtensions(options: GenerateOptions): {
  extensions: DiscoveredExtension[]
  problems: Problem[]
} {
  const problems: Problem[] = []
  // `__tests__` beside the extensions holds tests about them, as everywhere else in this backend.
  const extensions = directoriesIn(options.root)
    .filter((name) => name !== '__tests__')
    .map((name) => discoverExtension(name, options, problems))
  return { extensions, problems }
}

/** What core holds in each namespace an extension may collide with, read from core's own files. */
export function readCoreNames(backend: string): CoreNames {
  const repoRoot = repoRootOf(backend)
  const sourceOf = (path: string) => parse({ path: relative(repoRoot, path), source: readFileSync(path, 'utf8') })

  const moduleKeys = new Set<string>()
  forEachNode(sourceOf(join(backend, 'src/core/utils/modules-definition.ts')), (node) => {
    if (ts.isPropertyAssignment(node) && ts.isStringLiteralLike(node.initializer)) moduleKeys.add(node.initializer.text)
  })

  const events = new Set<string>()
  forEachNode(sourceOf(join(backend, 'src/core/event-bus/events.ts')), (node) => {
    if (!ts.isTypeAliasDeclaration(node) || node.name.text !== 'EventPayloads' || !ts.isTypeLiteralNode(node.type))
      return
    for (const member of node.type.members) {
      if (member.name && ts.isStringLiteralLike(member.name)) events.add(member.name.text)
    }
  })

  const routes: Route[] = []
  const operationIds = new Set<string>()
  for (const file of collect(join(backend, 'src/api'), repoRoot)) {
    if (basename(file.path) !== 'definitions.ts') continue
    for (const route of routesIn(parse(file))) {
      routes.push(route)
      if (route.operationId) operationIds.add(route.operationId)
    }
  }

  const componentNames = new Set<string>()
  const schemaRoots = [join(repoRoot, 'packages/http-schemas/src'), join(backend, 'src')]
  for (const schemaRoot of schemaRoots) {
    for (const file of collect(schemaRoot, repoRoot)) {
      if (file.path.includes('/extensions/')) continue
      for (const { name } of componentNamesIn(parse(file))) componentNames.add(name)
    }
  }

  return { moduleKeys, events, operationIds, componentNames, routes }
}

// ---- Checks ----------------------------------------------------------------------------------

function segmentsOf(matcher: string): string[] {
  return matcher.split('/').filter(Boolean)
}

/** The pattern with every parameter's name dropped: `/store/carts/:id` → `/store/carts/:`. */
function normalized(matcher: string): string {
  return `/${segmentsOf(matcher)
    .map((segment) => (segment.startsWith(':') ? ':' : segment))
    .join('/')}`
}

/**
 * Whether an extension route would take requests a core route of the same method answers.
 *
 * `RoutesSorter` orders a static segment before a parameter at the first position where two
 * patterns differ in kind, so an extension path that is static where core's has a parameter, and
 * matches it everywhere else, is tried first and takes every request that segment names. The other
 * way round core wins, so the extension route only misses requests core answers anyway.
 */
export function routeConflict(extension: Route, core: Route): 'collision' | 'shadow' | undefined {
  if (extension.method !== core.method) return undefined
  const ours = segmentsOf(extension.matcher)
  const theirs = segmentsOf(core.matcher)
  if (ours.length !== theirs.length) return undefined

  let firstDifference: 'ours-static' | 'theirs-static' | undefined
  for (const [index, segment] of ours.entries()) {
    const other = theirs[index] ?? ''
    const oursIsParam = segment.startsWith(':')
    const theirsIsParam = other.startsWith(':')
    if (!oursIsParam && !theirsIsParam && segment !== other) return undefined
    if (firstDifference === undefined && oursIsParam !== theirsIsParam) {
      firstDifference = oursIsParam ? 'theirs-static' : 'ours-static'
    }
  }

  if (firstDifference === undefined) return 'collision'
  return firstDifference === 'ours-static' ? 'shadow' : undefined
}

const ROUTE_PREFIXES: Record<string, string> = { store: '/store/', hooks: '/hooks/' }

function routeProblems(extension: DiscoveredExtension, core: CoreNames): Problem[] {
  const problems: Problem[] = []

  for (const routeFile of extension.routeFiles) {
    for (const route of routeFile.routes) {
      const label = `${route.method} ${route.matcher}`

      if (routeFile.scope === 'admin' || route.matcher.startsWith('/admin')) {
        problems.push({
          location: route.location,
          message: `extension "${extension.name}" declares the admin route ${label}`,
          remedy:
            'extensions have no admin routes yet: an admin route needs permission keys, a closed core list, and extension permissions do not exist. Serve it under /store/ or /hooks/, or keep it out of the extension until they do',
        })
        continue
      }

      const prefix = ROUTE_PREFIXES[routeFile.scope]
      if (!prefix) {
        problems.push({
          location: route.location,
          message: `${label} is in api/${routeFile.scope}/, which is neither api/store/ nor api/hooks/`,
          remedy: 'move it under api/store/ or api/hooks/; namespace auth decides who may call a route from its prefix',
        })
        continue
      }
      if (!route.matcher.startsWith(prefix)) {
        problems.push({
          location: route.location,
          message: `${label} is in api/${routeFile.scope}/ but does not start with ${prefix}`,
          remedy: `start the matcher with ${prefix}; a route outside it would run without the auth its folder promises`,
        })
        continue
      }

      for (const coreRoute of core.routes) {
        const conflict = routeConflict(route, coreRoute)
        if (conflict === 'collision') {
          problems.push({
            location: route.location,
            message: `${label} is the core route ${coreRoute.method} ${coreRoute.matcher} (${coreRoute.location})`,
            remedy: 'choose another path; an extension adds routes and never replaces core’s',
          })
        } else if (conflict === 'shadow') {
          problems.push({
            location: route.location,
            message: `${label} would shadow the core route ${coreRoute.method} ${coreRoute.matcher} (${coreRoute.location})`,
            remedy:
              'a static segment sorts before a parameter, so this route would take every request that names it from core. Choose a path core has no parameter route under',
          })
        }
      }
    }
  }

  return problems
}

function prefixProblems(extension: DiscoveredExtension): Problem[] {
  const checks: { kind: string; names: Named[]; prefix: string; alsoAccepted?: string }[] = [
    { kind: 'module key', names: extension.moduleKeys, prefix: runtimePrefix(extension.name) },
    { kind: 'event', names: extension.events, prefix: runtimePrefix(extension.name) },
    {
      kind: 'operation id',
      names: extension.routeFiles.flatMap((file) =>
        file.routes.flatMap((route) =>
          route.operationId ? [{ name: route.operationId, location: route.location }] : [],
        ),
      ),
      prefix: camelPrefix(extension.name),
    },
    { kind: 'OpenAPI component', names: extension.componentNames, prefix: pascalPrefix(extension.name) },
    // A model file exports values in camel case and types in Pascal case: `pisosDjNoteTable`, `PisosDjNote`.
    {
      kind: 'exported model identifier',
      names: extension.modelNames,
      prefix: camelPrefix(extension.name),
      alsoAccepted: pascalPrefix(extension.name),
    },
  ]

  return checks.flatMap(({ kind, names, prefix, alsoAccepted }) =>
    names
      .filter(({ name }) => !hasPrefix(name, prefix) && !(alsoAccepted && hasPrefix(name, alsoAccepted)))
      .map(({ name, location }) => ({
        location,
        message: `the ${kind} "${name}" in extension "${extension.name}" does not start with "${prefix}"${alsoAccepted ? ` or "${alsoAccepted}"` : ''}`,
        remedy: `name it with the prefix, e.g. "${prefix}${prefix.endsWith('.') ? name : name.charAt(0).toUpperCase() + name.slice(1)}"; a later core name cannot collide with a prefixed one`,
      })),
  )
}

/** A name core already has, or a second extension declares, in one namespace. */
function duplicateProblems(extensions: DiscoveredExtension[], core: CoreNames): Problem[] {
  const namespaces: { kind: string; core: Set<string>; names: (extension: DiscoveredExtension) => Named[] }[] = [
    { kind: 'module key', core: core.moduleKeys, names: (extension) => extension.moduleKeys },
    { kind: 'event', core: core.events, names: (extension) => extension.events },
    {
      kind: 'operation id',
      core: core.operationIds,
      names: (extension) =>
        extension.routeFiles.flatMap((file) =>
          file.routes.flatMap((route) =>
            route.operationId ? [{ name: route.operationId, location: route.location }] : [],
          ),
        ),
    },
    { kind: 'OpenAPI component', core: core.componentNames, names: (extension) => extension.componentNames },
  ]

  const problems: Problem[] = []
  for (const namespace of namespaces) {
    const seen = new Map<string, Named>()
    for (const extension of extensions) {
      for (const named of namespace.names(extension)) {
        if (namespace.core.has(named.name)) {
          problems.push({
            location: named.location,
            message: `the ${namespace.kind} "${named.name}" is already core's`,
            remedy: 'rename it; an extension adds to a namespace and never replaces a core name',
          })
          continue
        }
        const earlier = seen.get(named.name)
        // A component reused within one file is one registration; only a second declaration is a clash.
        if (earlier && earlier.location !== named.location) {
          problems.push({
            location: named.location,
            message: `the ${namespace.kind} "${named.name}" is declared twice — also at ${earlier.location}`,
            remedy: 'rename one; names are unique across the backend',
          })
          continue
        }
        seen.set(named.name, named)
      }
    }
  }

  const routes = new Map<string, Route>()
  for (const extension of extensions) {
    for (const route of extension.routeFiles.flatMap((file) => file.routes)) {
      const key = `${route.method} ${normalized(route.matcher)}`
      const earlier = routes.get(key)
      if (earlier) {
        problems.push({
          location: route.location,
          message: `${route.method} ${route.matcher} is declared twice — also at ${earlier.location}`,
          remedy: 'choose another path for one; two routes on one pattern leave one unreachable',
        })
        continue
      }
      routes.set(key, route)
    }
  }

  return problems
}

function hookHandlerProblems(extensions: DiscoveredExtension[]): Problem[] {
  const problems: Problem[] = []
  const seen = new Map<string, HookHandlerFile>()
  for (const handler of extensions.flatMap((extension) => extension.hookHandlers)) {
    const earlier = seen.get(handler.hook)
    if (earlier) {
      problems.push({
        location: handler.location,
        message: `a second handler for the hook ${handler.hook.split('#')[1] ?? handler.hook} — the first is at ${earlier.location}`,
        remedy: 'a hook takes exactly one handler, so which code runs is never ambiguous. Delete one',
      })
      continue
    }
    seen.set(handler.hook, handler)
  }
  return problems
}

function manifestProblems(extension: DiscoveredExtension): Problem[] {
  if (!isExtensionName(extension.name)) {
    return [
      {
        location: extension.folder,
        message: `"${extension.name}" is not an extension name`,
        remedy: 'name the folder in lowercase words joined by hyphens, e.g. pisos-dj',
      },
    ]
  }
  if (extension.manifest && extension.manifest.name !== extension.name) {
    return [
      {
        location: extension.manifest.location,
        message: `the manifest names the extension "${extension.manifest.name}" but its folder is "${extension.name}"`,
        remedy: `make them the same: defineExtension({ name: '${extension.name}' })`,
      },
    ]
  }
  return []
}

/** Every rule an extension set breaks against core and against itself. Catalogs are checked separately. */
export function checkExtensions(extensions: DiscoveredExtension[], core: CoreNames): Problem[] {
  return [
    ...extensions.flatMap(manifestProblems),
    ...extensions.flatMap(prefixProblems),
    ...extensions.flatMap((extension) => routeProblems(extension, core)),
    ...duplicateProblems(extensions, core),
    ...hookHandlerProblems(extensions),
  ]
}

/** Two catalogs translating one message differently, core's first. */
async function catalogProblems(extensions: DiscoveredExtension[]): Promise<Problem[]> {
  const [core, extensionCatalogs] = await Promise.all([
    readCoreCatalog(),
    readExtensionCatalogs(extensions.map((extension) => ({ name: extension.name, directory: extension.directory }))),
  ])
  return catalogConflicts([core, ...extensionCatalogs]).map((message) => ({
    location: 'locales',
    message,
    remedy: 'translate the message alike in both catalogs, or give one of them its own wording',
  }))
}

// ---- Rendering -------------------------------------------------------------------------------

function renderRegistry(extensions: DiscoveredExtension[], options: GenerateOptions, output: string): string {
  const { backend } = options
  const repoRoot = repoRootOf(backend)
  const specifier = (file: string) => moduleSpecifier(backend, output, file)
  const typesFile = relative(repoRoot, join(backend, 'src/framework/extensions/types.ts'))

  const imports: string[] = [`import type { ExtensionRegistry } from '${specifier(typesFile)}'`]
  if (options.subscribers) {
    imports.push(
      `import { defineSubscriber, type SubscriberDefinition } from '${specifier(relative(repoRoot, join(backend, 'src/core/event-bus/types.ts')))}'`,
    )
  }
  for (const extension of extensions) {
    for (const module of extension.modules) imports.push(`import ${module.alias} from '${specifier(module.file)}'`)
    for (const routeFile of extension.routeFiles) {
      if (ROUTE_PREFIXES[routeFile.scope]) imports.push(`import ${routeFile.alias} from '${specifier(routeFile.file)}'`)
    }
    for (const handler of extension.hookHandlers) {
      imports.push(`import { handler as ${handler.alias} } from '${specifier(handler.file)}'`)
    }
    for (const file of extension.catalogs.flatMap((catalog) => catalog.files)) {
      imports.push(`import { messages as ${file.alias} } from '${specifier(file.file)}'`)
    }
    for (const subscriber of extension.subscribers) {
      imports.push(`import { config as ${subscriber.alias} } from '${specifier(subscriber.file)}'`)
    }
  }

  const list = (items: string[], indent: string) =>
    items.length === 0 ? '[]' : `[\n${items.map((item) => `${indent}  ${item},`).join('\n')}\n${indent}]`
  const routesOf = (scope: string) =>
    extensions.flatMap((extension) =>
      extension.routeFiles.filter((file) => file.scope === scope).map((file) => `...${file.alias}`),
    )
  const catalogs = extensions.flatMap((extension) =>
    extension.catalogs.map(
      (catalog) =>
        `{ extension: '${extension.name}', messages: { ${catalog.files.map((file) => `${file.language}: ${file.alias}`).join(', ')} } }`,
    ),
  )

  const subscriberBlock = options.subscribers
    ? `
/** The extensions' subscribers, which the test container's in-process bus dispatches to. */
export const extensionSubscribers: SubscriberDefinition[] = ${list(
        extensions.flatMap((extension) =>
          extension.subscribers.map((subscriber) => `defineSubscriber(${subscriber.alias})`),
        ),
        '',
      )}
`
    : ''

  return `// GENERATED by \`${options.command}\`. Do not edit — your change will be overwritten.
//
// Every extension's modules, store and webhook routes, hook handlers and compiled catalogs, as static
// imports, so workerd and the Temporal Worker have them without a file system. The container
// bootstrap, route preparation and the translator take this registry as a dependency. \`pnpm verify\`
// fails when this file drifts from the extension folders.

${imports.join('\n')}

export const extensionRegistry: ExtensionRegistry = {
  extensions: ${list(
    extensions.map((extension) => `{ name: '${extension.name}' }`),
    '  ',
  )},
  modules: ${list(
    extensions.flatMap((extension) => extension.modules.map((module) => module.alias)),
    '  ',
  )},
  routes: {
    store: ${list(routesOf('store'), '    ')},
    hooks: ${list(routesOf('hooks'), '    ')},
  },
  hookHandlers: ${list(
    extensions.flatMap((extension) =>
      extension.hookHandlers.map((handler) => `{ ...${handler.alias}, extension: '${extension.name}' }`),
    ),
    '  ',
  )},
  catalogs: ${list(catalogs, '  ')},
}
${subscriberBlock}`
}

function renderSeeds(extensions: DiscoveredExtension[], options: GenerateOptions, output: string): string {
  const { backend } = options
  const repoRoot = repoRootOf(backend)
  const specifier = (file: string) => moduleSpecifier(backend, output, file)
  const typesFile = relative(repoRoot, join(backend, 'src/framework/extensions/types.ts'))
  const seeds = extensions.flatMap((extension) =>
    extension.seeds.map((seed) => ({ ...seed, extension: extension.name })),
  )

  const imports = [
    `import type { ExtensionSeed } from '${specifier(typesFile)}'`,
    ...seeds.map((seed) => `import ${seed.alias} from '${specifier(seed.file)}'`),
  ]
  const entries = seeds.map((seed) => `  { extension: '${seed.extension}', name: '${seed.seed}', run: ${seed.alias} },`)

  return `// GENERATED by \`${options.command}\`. Do not edit — your change will be overwritten.
//
// Every extension's dev seed steps, in extension-name then file order. Imported only by the dev seed
// script, never by a runtime root, so a step may read files without reaching workerd.

${imports.join('\n')}

export const EXTENSION_SEEDS: ExtensionSeed[] = ${entries.length === 0 ? '[]' : `[\n${entries.join('\n')}\n]`}
`
}

/** Both registries as they would be written, and every problem standing in the way of writing them. */
export async function generateExtensionRegistry(
  options: GenerateOptions,
): Promise<{ files: GeneratedFile[]; problems: Problem[]; count: number }> {
  const { extensions, problems } = discoverExtensions(options)
  const allProblems = [
    ...problems,
    ...checkExtensions(extensions, readCoreNames(options.backend)),
    ...(await catalogProblems(extensions)),
  ]

  const registry = join(options.root, 'registry.gen.ts')
  const seeds = join(options.root, 'seeds.gen.ts')
  return {
    files: [
      { path: registry, content: renderRegistry(extensions, options, registry) },
      { path: seeds, content: renderSeeds(extensions, options, seeds) },
    ],
    problems: allProblems,
    count: extensions.length,
  }
}

/** Absent on the first run, and an empty string then differs from any render, which is the right answer. */
function committedContent(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

/** The generated files whose committed copy differs from what the generator would write. */
export function staleFiles(files: GeneratedFile[]): GeneratedFile[] {
  return files.filter((file) => committedContent(file.path) !== file.content)
}

/** Writes only what changed: an unconditional write re-triggers every watcher pointed at the file. */
export function writeFiles(files: GeneratedFile[]): GeneratedFile[] {
  const stale = staleFiles(files)
  for (const file of stale) writeFileSync(file.path, file.content)
  return stale
}

// ---- CLI -------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const fixture = process.argv.includes('--fixture')
  const checking = process.argv.includes('--check')
  const options: GenerateOptions = fixture
    ? {
        backend: BACKEND,
        root: join(BACKEND, 'tests/extension-fixture'),
        subscribers: true,
        command: 'pnpm --filter backend run extensions:generate:fixture',
      }
    : {
        backend: BACKEND,
        root: join(BACKEND, 'src/extensions'),
        subscribers: false,
        command: 'pnpm --filter backend run extensions:generate',
      }
  const where = relative(BACKEND, options.root)

  const { files, problems, count } = await generateExtensionRegistry(options)
  if (problems.length > 0) {
    report('extension-registry', problems)
    process.exit(1)
  }

  if (checking) {
    const stale = staleFiles(files)
    if (stale.length > 0) {
      heading('extension-registry')
      for (const file of stale) {
        console.info(`  ${RED}✖${RESET} ${relative(BACKEND, file.path)} is out of date with ${where}/.`)
      }
      console.info(`    ${DIM}${count} extensions found.${RESET}`)
      console.info(`    ${YELLOW}→${RESET} run \`${options.command}\` and commit the result`)
      console.info('')
      process.exit(1)
    }
    console.info(
      `${GREEN}✔${RESET} extension-registry — ${where} registries are current. ${DIM}${count} extensions.${RESET}`,
    )
    return
  }

  const written = writeFiles(files)
  const verb =
    written.length === 0 ? 'already current' : `wrote ${written.map((file) => basename(file.path)).join(', ')}`
  console.info(`${GREEN}✔${RESET} extension-registry — ${where}: ${verb}. ${DIM}${count} extensions.${RESET}`)
}

if (isEntryPoint(import.meta.url)) await main()
