// The component half of the snapshot: one `figcraft/components/<Set>.json` per exported component set,
// trimmed to what the build reads, so moving a variant on the canvas doesn't change the JSON.
import { execFileSync } from 'node:child_process'
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
  /** A grid's column count; tracks other than equal columns are not mapped. */
  gridColumns?: number
  columnTracks?: unknown[]
  rowTracks?: unknown[]
}

/** An effect as FigCraft reports it: a shadow, a blur. Colours are 0–1 channels. */
export type Effect = {
  type?: string
  visible?: boolean
  color?: { r: number; g: number; b: number; a: number }
  offset?: number[]
  radius?: number
  spread?: number
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
  effects?: Effect[]
  /** The effect style the layer's effects come from. */
  effectStyle?: string
  maxWidth?: number
  maxHeight?: number
  /** A grid child's cell, kept when it spans several columns. */
  gridCell?: { columnSpan?: number }
  /** A text layer's OpenType features (`tnum`: tabular figures), as the saved file holds them. */
  fontFeatures?: Record<string, boolean>
  /** Scrolling (prototype overflow): the axis the frame's content scrolls along. */
  overflow?: 'horizontal' | 'vertical' | 'both'
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
  if (isScreenSet(set)) return 'a screen set, composed in code'
  if (config.skippedPages.includes(set.page)) return `its page ${set.page} is never exported`
  if (!/^(components|entities|features)\/[^/]+$/.test(set.page)) return `its page ${set.page} is not in the page map`
  return undefined
}

/** A screen set is named like the feature component its route renders, so a set is known by its page and name. */
function isScreenSet(set: Pick<ComponentSet, 'page' | 'description'>) {
  return set.description?.startsWith('Screen set') || /^app\//.test(set.page) || set.page === 'flows'
}

/** Sets are identified by page and name: a screen set shares its name with the component its route renders. */
const setKey = (page: string | number, name: string) => `${page}\u0000${name}`

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
  const sets = setKeys(list)
  return list
    .filter(
      (c) =>
        c.type === 'COMPONENT_SET' || (c.type === 'COMPONENT' && !sets.has(setKey(c.page, c.folder?.at(-1) ?? ''))),
    )
    .map((c) => ({ ...c, page: pages.get(String(c.page)) ?? String(c.page) }))
}

/**
 * The candidates an export writes: with no names, every one the page map exports; with names, each named one. A name
 * never picks a screen set while a component of that name exists.
 * @internal exported for its test
 */
export function chooseExports<C extends Pick<ComponentSet, 'name' | 'page' | 'description'> & { type: string }>(
  candidates: C[],
  names: string[],
  config: ComponentsConfig,
): C[] {
  if (names.length === 0) return candidates.filter((c) => !notExportedBecause(c, config))
  return names.map((name) => {
    const named = candidates.filter((c) => c.name === name)
    const components = named.filter((c) => !isScreenSet(c))
    const pool = components.length ? components : named
    const sets = pool.filter((c) => c.type === 'COMPONENT_SET')
    const found = sets.length ? sets : pool
    const [only] = found
    if (!only || found.length > 1) {
      throw new Error(`expected one component or component set named "${name}", found ${found.length}`)
    }
    const reason = notExportedBecause(only, config)
    if (reason) throw new Error(`${name} is not exported: ${reason}`)
    return only
  })
}

/**
 * The component set each variant belongs to, by the variant's id: the set on its page its last folder names.
 * @internal exported for its test
 */
export function setOfComponents(list: ListedComponent[]) {
  const sets = setKeys(list)
  return new Map(
    list.flatMap((c) => {
      const folder = c.folder?.at(-1)
      return c.type === 'COMPONENT' && folder && sets.has(setKey(c.page, folder)) ? [[c.id, folder] as const] : []
    }),
  )
}

function setKeys(list: ListedComponent[]) {
  return new Set(list.filter((c) => c.type === 'COMPONENT_SET').map((c) => setKey(c.page, c.name)))
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
    const chosen = chooseExports(candidates, names, components)
    const setOf = setOfComponents(list)

    const saved = readSaved(config.figcraft.file)
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
        variants: variants.map((variant) => trim(variant, setOf, saved, undefined)),
      }
      writeFileSync(join(dir, `${component.name}.json`), `${JSON.stringify(doc, null, 2)}\n`)
    }
    console.info(`exported ${chosen.length} component set(s): ${chosen.map((c) => c.name).join(', ') || 'none'}`)
  })
}

/**
 * What node.get doesn't report, by node id, read from the saved file itself (a zip whose `document.json` holds every
 * node by id): a scrolling frame's axis, a text layer's OpenType features.
 */
function readSaved(file: string | undefined): Saved {
  const saved: Saved = { overflows: new Map(), features: new Map() }
  if (!file) return saved
  const document = JSON.parse(
    execFileSync('unzip', ['-p', file, 'document.json'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }),
  ) as { nodes?: Record<string, { overflow?: string; features?: Record<string, boolean> }> }
  for (const [id, node] of Object.entries(document.nodes ?? {})) {
    if (node.overflow && node.overflow !== 'none') saved.overflows.set(id, node.overflow as Layer['overflow'])
    if (node.features && Object.keys(node.features).length) saved.features.set(id, node.features)
  }
  return saved
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
  'maxWidth',
  'maxHeight',
  'slot',
  'effects',
] as const

type Saved = { overflows: Map<string, Layer['overflow']>; features: Map<string, Record<string, boolean>> }

function trim(node: FigCraftNode, setOf: Map<string, string>, saved: Saved, parent: FigCraftNode | undefined): Layer {
  const out = Object.fromEntries(KEPT.filter((key) => node[key] != null).map((key) => [key, node[key]])) as Layer
  const styles = node.styles as { text?: string; effect?: string } | undefined
  if (styles?.text) out.textStyle = styles.text
  if (styles?.effect) out.effectStyle = styles.effect
  const cell = node.gridCell as { columnSpan?: number } | undefined
  const inGrid = (parent?.layout as { mode?: string } | undefined)?.mode === 'grid'
  if (inGrid && (cell?.columnSpan ?? 1) > 1) out.gridCell = { columnSpan: cell?.columnSpan }
  const overflow = saved.overflows.get(String(node.id))
  if (overflow) out.overflow = overflow
  const features = saved.features.get(String(node.id))
  if (features) out.fontFeatures = features
  const layout = trimLayout(node.layout as (Layout & { mode: string }) | undefined)
  if (layout) out.layout = layout
  const sizing = node.sizing as Layer['sizing']
  if (sizing?.horizontal === 'fixed') out.width = node.width as number
  if (sizing?.vertical === 'fixed') out.height = node.height as number
  const mainSet = node.type === 'INSTANCE' ? setOf.get(node.mainComponent as string) : undefined
  if (mainSet) out.mainSet = mainSet
  // A layer placed outside the auto layout keeps its place: insets from its parent's edges, per constraint.
  if (node.absolute && parent) out.absolute = absolutePlacement(node, parent)
  const children = node.children ?? []
  if (children.length) out.children = children.map((child) => trim(child, setOf, saved, node))
  return out
}

// Only the auto layout fields the builder reads; a wrap's and a grid's extra fields only when they apply.
function trimLayout(layout: (Layout & { mode: string }) | undefined): Layout | undefined {
  if (!layout || layout.mode === 'none') return undefined
  const { mode, mainAlign, crossAlign, gap, padding, strokesIncluded } = layout
  const out: Layout = { mode, mainAlign, crossAlign, gap, padding, strokesIncluded }
  if (layout.wrap) Object.assign(out, { wrap: true, crossGap: layout.crossGap })
  if (mode === 'grid') {
    const { crossGap, gridColumns, columnTracks, rowTracks } = layout
    Object.assign(out, { crossGap, gridColumns, columnTracks, rowTracks })
  }
  return out
}

function absolutePlacement(node: FigCraftNode, parent: FigCraftNode): Layer['absolute'] {
  const { horizontal, vertical } = (node.constraints ?? {}) as { horizontal?: string; vertical?: string }
  const [x, y, width, height] = [node.x, node.y, node.width, node.height] as number[]
  const parentLayout = parent.layout as { mode?: string } | undefined
  return {
    horizontal,
    vertical,
    left: x ?? 0,
    top: y ?? 0,
    right: (parent.width as number) - (x ?? 0) - (width ?? 0),
    bottom: (parent.height as number) - (y ?? 0) - (height ?? 0),
    parentLayout: parentLayout?.mode,
  }
}
