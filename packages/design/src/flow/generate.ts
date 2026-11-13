import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { ResolvedConfig } from '../config.ts'
import { buildFlow, type RouteNode, routeProblems, type ScreenTable } from './build.ts'
import { readFlowSnapshot } from './snapshot.ts'

/** The flow map from the committed snapshot, and check:flow's findings against the store's routes. */
export async function generateFlow(config: ResolvedConfig) {
  const flow = config.flow
  if (!flow) throw new Error('design.json has no `flow` section')
  const snapshot = readFlowSnapshot(config.snapshot)
  const files = new Map([[flow.output, buildFlow(snapshot)]])
  if (snapshot.flows.length === 0)
    return { files, notes: ['the design file has no flows yet: nothing to check'], problems: [] }
  // The screen table is TypeScript with type-only imports, so Node runs it as is.
  const { screens } = (await import(pathToFileURL(flow.screens).href)) as { screens: ScreenTable }
  return { files, notes: [], problems: routeProblems(snapshot, screens, readRoutes(flow.routeTree)) }
}

/**
 * The routes of a TanStack Router `routeTree.gen.ts`: each `const X = XImport.update({ id, …, getParentRoute })`
 * gives the route's id relative to its parent, and the import gives its file.
 */
function readRoutes(routeTree: string): RouteNode[] {
  const source = readFileSync(routeTree, 'utf8')
  const root = dirname(routeTree)
  const files = new Map(
    [...source.matchAll(/^import \{ Route as (\w+) \} from '(\.\/routes\/[^']+)'/gm)].map(
      ([, name = '', path = '']) => [name, path],
    ),
  )
  const fileOf = (importName: string) => {
    const path = files.get(importName)
    if (!path) throw new Error(`${routeTree}: no import for ${importName}`)
    const file = ['.tsx', '.ts'].map((extension) => join(root, `${path}${extension}`)).find(existsSync)
    if (!file) throw new Error(`${routeTree}: ${path} has no file`)
    return file
  }
  const updates = new Map(
    [
      ...source.matchAll(/^const (\w+) =\s+(\w+)\.update\(\{\s+id: '([^']*)',[\s\S]*?getParentRoute: \(\) => (\w+),/gm),
    ].map(([, name = '', importName = '', id = '', parent = '']) => [name, { importName, id, parent }]),
  )
  const Root = 'rootRouteImport'
  const fullId = (name: string): string => {
    if (name === Root) return '__root__'
    const update = updates.get(name)
    if (!update) throw new Error(`${routeTree}: no route ${name}`)
    return update.parent === Root ? update.id : `${fullId(update.parent)}${update.id}`
  }
  const read = (file: string) => ({ file: relative(join(root, '..'), file), source: readFileSync(file, 'utf8') })
  return [
    { id: '__root__', parent: undefined, ...read(fileOf(Root)) },
    ...[...updates].map(([name, update]) => ({
      id: fullId(name),
      parent: fullId(update.parent),
      ...read(fileOf(update.importName)),
    })),
  ]
}
