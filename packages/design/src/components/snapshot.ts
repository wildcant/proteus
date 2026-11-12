// The component half of the snapshot: one `figcraft/components/<Set>.json` per exported component set,
// trimmed to what the build reads, so moving a variant on the canvas doesn't change the JSON.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { ComponentsConfig, ResolvedConfig } from '../config.ts'
import { withFigCraft } from '../figcraft.ts'

type Sizing = 'fixed' | 'hug' | 'fill'

type Paint = { type: string; color?: string; opacity?: number; visible?: boolean }

export type Layout = {
  mode: 'horizontal' | 'vertical' | string
  mainAlign?: string
  crossAlign?: string
  gap?: number
  /** [top, right, bottom, left] */
  padding?: number[]
  strokesIncluded?: boolean
  wrap?: boolean
  crossGap?: number
}

/** A layer placed outside its parent's auto layout: its constraints and insets from the parent's edges. */
export type Absolute = {
  horizontal?: string
  vertical?: string
  left: number
  top: number
  right: number
  bottom: number
  parentLayout?: string
}

export type Layer = {
  name: string
  type: string
  visible?: boolean
  opacity?: number
  fills?: Paint[]
  strokes?: Paint[]
  strokeWeight?: number
  strokeAlign?: string
  cornerRadius?: number | number[]
  clip?: boolean
  sizing?: { horizontal?: Sizing; vertical?: Sizing }
  /** Field -> variable id. */
  boundVariables?: Record<string, string>
  textAlign?: string
  textStyle?: string
  mainComponentName?: string
  /** The component set a nested instance comes from. */
  mainSet?: string
  overrides?: string[]
  rotation?: number
  /** [top, right, bottom, left], 1 where the stroke is drawn. */
  strokeSides?: number[]
  dashes?: number[]
  minWidth?: number
  minHeight?: number
  slot?: boolean
  effects?: { visible?: boolean }[]
  layout?: Layout
  width?: number
  height?: number
  absolute?: Absolute
  children?: Layer[]
}

type ComponentProperty = {
  name: string
  type: string
  default?: unknown
  options?: string[]
}

export type ComponentSet = {
  name: string
  /** The page the set sits on; it decides the output folder. */
  page: string
  description?: string
  properties: ComponentProperty[]
  /** One per variant, named `prop=value, prop=value`; a component outside a set is its own single variant. */
  variants: Layer[]
}

const COMPONENTS_DIR = 'components'
const REFERENCE = /^Reference · /

/** Why a set never becomes a variants file, or undefined when it does. */
export function notExportedBecause(set: Pick<ComponentSet, 'name' | 'page' | 'description'>, config: ComponentsConfig) {
  const reason = config.notExported[set.name]
  if (reason) return reason
  if (REFERENCE.test(set.name)) return 'a reference frame, design only'
  if (set.description?.startsWith('Screen set') || /^app\//.test(set.page) || set.page === 'flows') {
    return 'a screen set, composed in code'
  }
  if (config.skippedPages.includes(set.page)) return `its page ${set.page} is never exported`
  if (!/^(components|entities|features)\/[^/]+$/.test(set.page)) return `its page ${set.page} is not in the page map`
  return undefined
}

export function readComponentSets(snapshot: string): ComponentSet[] {
  const dir = join(snapshot, COMPONENTS_DIR)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')) as ComponentSet)
}

type ListedComponent = {
  id: string
  name: string
  type: 'COMPONENT' | 'COMPONENT_SET' | string
  /** The page's id. */
  page: string | number
  folder?: string[]
  description?: string
}
/**
 * The sets, and the components outside any set, each with its page's name. component.list gives every component a
 * folder (page, section, and for a variant its set), so a component is in a set when its last folder names one.
 * @internal exported for its test
 */
export function exportCandidates(list: ListedComponent[], pages: Map<string, string>) {
  const setNames = new Set(list.filter((c) => c.type === 'COMPONENT_SET').map((c) => c.name))
  return list
    .filter((c) => c.type === 'COMPONENT_SET' || (c.type === 'COMPONENT' && !setNames.has(c.folder?.at(-1) ?? '')))
    .map((c) => ({ ...c, page: pages.get(String(c.page)) ?? String(c.page) }))
}

type FigCraftNode = Record<string, unknown> & {
  id: string
  name: string
  type: string
  childCount?: number
  children?: FigCraftNode[]
}

/**
 * Refreshes the component half of the snapshot. With no names, every set the page map exports, and the
 * JSON of sets no longer in the file is removed; with names, only those sets.
 */
export function exportComponentSnapshot(config: ResolvedConfig, names: string[]) {
  const components = config.components
  if (!components) throw new Error('design.json has no `components` section')
  const dir = join(config.snapshot, COMPONENTS_DIR)
  withFigCraft(config.figcraft, undefined, (run) => {
    const [list, pageList] = run([
      { command: 'component.list', params: {} },
      { command: 'page.list', params: {} },
    ]) as [ListedComponent[], { id: string | number; name: string }[]]
    const pages = new Map(pageList.map((page) => [String(page.id), page.name]))
    const candidates = exportCandidates(list, pages)
    const chosen =
      names.length === 0
        ? candidates.filter((c) => !notExportedBecause(c, components))
        : names.map((name) => {
            const sets = candidates.filter((c) => c.type === 'COMPONENT_SET' && c.name === name)
            const found = sets.length ? sets : candidates.filter((c) => c.name === name)
            const [only] = found
            if (!only || found.length > 1) {
              throw new Error(`expected one component or component set named "${name}", found ${found.length}`)
            }
            const reason = notExportedBecause(only, components)
            if (reason) throw new Error(`${name} is not exported: ${reason}`)
            return only
          })

    // The component set a nested instance comes from: the last folder of its main component.
    const setNames = new Set(list.filter((c) => c.type === 'COMPONENT_SET').map((c) => c.name))
    const setOf = new Map(
      list.flatMap((c) => {
        const folder = c.folder?.at(-1)
        return c.type === 'COMPONENT' && folder && setNames.has(folder) ? [[c.id, folder] as const] : []
      }),
    )

    if (names.length === 0) rmSync(dir, { recursive: true, force: true })
    if (chosen.length > 0) mkdirSync(dir, { recursive: true })
    for (const component of chosen) {
      const [set, props] = run([
        { command: 'node.get', params: { id: component.id } },
        { command: 'component.properties', params: { id: component.id } },
      ]) as [FigCraftNode, { properties: ComponentProperty[] }]
      // node.get returns one level, so the tree is read level by level.
      let level = set.type === 'COMPONENT_SET' ? (set.children ?? []) : [set]
      while (level.length) {
        const nodes = run(level.map((node) => ({ command: 'node.get', params: { id: node.id } }))) as FigCraftNode[]
        level.forEach((node, i) => {
          node.children = nodes[i]?.children ?? []
        })
        level = level.flatMap((node) => (node.children ?? []).filter((child) => child.childCount))
      }
      const variants = set.type === 'COMPONENT_SET' ? (set.children ?? []) : [set]
      const doc: ComponentSet = {
        name: component.name,
        page: component.page,
        ...(component.description ? { description: component.description } : {}),
        properties: props.properties,
        variants: variants.map((variant) => trim(variant, setOf, undefined)),
      }
      writeFileSync(join(dir, `${component.name}.json`), `${JSON.stringify(doc, null, 2)}\n`)
    }
    console.info(`exported ${chosen.length} component set(s): ${chosen.map((c) => c.name).join(', ') || 'none'}`)
  })
}

const KEPT = [
  'name',
  'type',
  'visible',
  'opacity',
  'fills',
  'strokes',
  'strokeWeight',
  'strokeAlign',
  'cornerRadius',
  'clip',
  'sizing',
  'boundVariables',
  'textAlign',
  'mainComponentName',
  'overrides',
  'rotation',
  'strokeSides',
  'dashes',
  'minWidth',
  'minHeight',
  'slot',
  'effects',
] as const

function trim(node: FigCraftNode, setOf: Map<string, string>, parent: FigCraftNode | undefined): Layer {
  const out = Object.fromEntries(KEPT.filter((key) => node[key] != null).map((key) => [key, node[key]])) as Layer
  const styles = node.styles as { text?: string } | undefined
  if (styles?.text) out.textStyle = styles.text
  const layout = node.layout as (Layout & { mode: string }) | undefined
  if (layout && layout.mode !== 'none') {
    const { mode, mainAlign, crossAlign, gap, padding, strokesIncluded } = layout
    out.layout = { mode, mainAlign, crossAlign, gap, padding, strokesIncluded }
    if (layout.wrap) Object.assign(out.layout, { wrap: true, crossGap: layout.crossGap })
  }
  const sizing = node.sizing as Layer['sizing']
  if (sizing?.horizontal === 'fixed') out.width = node.width as number
  if (sizing?.vertical === 'fixed') out.height = node.height as number
  const mainSet = node.type === 'INSTANCE' ? setOf.get(node.mainComponent as string) : undefined
  if (mainSet) out.mainSet = mainSet
  // A layer placed outside the auto layout keeps its place: insets from its parent's edges, per constraint.
  if (node.absolute && parent) {
    const { horizontal, vertical } = (node.constraints ?? {}) as { horizontal?: string; vertical?: string }
    const [x, y, width, height] = [node.x, node.y, node.width, node.height] as number[]
    const parentLayout = parent.layout as { mode?: string } | undefined
    out.absolute = {
      horizontal,
      vertical,
      left: x ?? 0,
      top: y ?? 0,
      right: (parent.width as number) - (x ?? 0) - (width ?? 0),
      bottom: (parent.height as number) - (y ?? 0) - (height ?? 0),
      parentLayout: parentLayout?.mode,
    }
  }
  const children = node.children ?? []
  if (children.length) out.children = children.map((child) => trim(child, setOf, node))
  return out
}
