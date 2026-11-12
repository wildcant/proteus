// The flow half of the snapshot: `figcraft/flows.json`, the screen sets and the transitions drawn on the `flows`
// page. A port of Atope's flow export (see the FigCraft ops doc, "Flows: arrows and events").
//
// Each section of the `flows` page is one flow. Each of its groups whose pluginData.kind is "flowEvent" is one
// transition: an event (SCREAMING_SNAKE_CASE) from `Screen/state` to `Screen/state`, with a condition in plain words.
// A group drawn by hand without pluginData is read from its name (`EVENT · From/state → To/state`) and the text
// `condition` in its `label` frame. The states of each screen are the `state` values of its screen set's variants,
// on the `app/*` pages or, for the `Root` pseudo-screen, on the `flows` page itself. A variant is named
// `state=…, viewport=…` in any order; only `state` is read.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { ResolvedConfig } from '../config.ts'
import { withFigCraft } from '../figcraft.ts'

export type FlowTransition = {
  event: string
  from: string
  fromState: string
  to: string
  toState: string
  condition: string
}

export type FlowSnapshot = {
  screens: Record<string, { page: string; states: string[] }>
  flows: { name: string; transitions: FlowTransition[] }[]
}

const FLOWS_FILE = 'flows.json'
const PAGE = 'flows'
const NAME = /^([A-Z_]+) · (\w+)\/(\w+) → (\w+)\/(\w+)$/
// Design-only frames: never read as screens or transitions.
const REFERENCE = /^Reference · /

export function readFlowSnapshot(snapshot: string): FlowSnapshot {
  const path = join(snapshot, FLOWS_FILE)
  if (!existsSync(path)) return { screens: {}, flows: [] }
  return JSON.parse(readFileSync(path, 'utf8')) as FlowSnapshot
}

type ListedComponent = { id: string; name: string; type: string; page: string | number; folder?: string[] }
type FigCraftNode = {
  id: string
  name: string
  type: string
  characters?: string
  pluginData?: Record<string, string>
  children?: FigCraftNode[]
}

type Run = (steps: { command: string; params: Record<string, unknown> }[]) => unknown[]

/** Refreshes `flows.json` from the design file. Without a `flows` page there is no map yet: no flows. */
export function exportFlowSnapshot(config: ResolvedConfig) {
  withFigCraft(config.figcraft, undefined, (run) => {
    const [pages, list] = run([
      { command: 'page.list', params: {} },
      { command: 'component.list', params: {} },
    ]) as [{ id: string | number; name: string }[], ListedComponent[]]
    const pageNames = new Map(pages.map((page) => [String(page.id), page.name]))
    const screens = readScreens(list, (component) => pageNames.get(String(component.page)) ?? '')
    const page = pages.find((p) => p.name === PAGE)
    const flows = page ? readFlows(run, page.id) : []
    const doc: FlowSnapshot = { screens, flows }
    writeFileSync(join(config.snapshot, FLOWS_FILE), `${JSON.stringify(doc, null, 2)}\n`)
    console.info(
      page
        ? `exported ${flows.length} flow(s) and ${Object.keys(screens).length} screen set(s)`
        : `no page "${PAGE}" in the design file: exported ${Object.keys(screens).length} screen set(s) and no flows`,
    )
  })
}

/** The screen sets (on `app/*` pages, and `Root` on the `flows` page) and the states of their variants. */
function readScreens(list: ListedComponent[], pageOf: (component: ListedComponent) => string) {
  const isScreenSet = (c: ListedComponent) =>
    c.type === 'COMPONENT_SET' && (pageOf(c).startsWith('app/') || pageOf(c) === PAGE) && !REFERENCE.test(c.name)
  return Object.fromEntries(
    list.filter(isScreenSet).map((set) => {
      const variants = list.filter(
        (c) => c.type === 'COMPONENT' && c.folder?.at(-1) === set.name && c.page === set.page,
      )
      const states = variants.map((variant) => stateOf(set.name, variant.name))
      return [set.name, { page: pageOf(set), states: [...new Set(states)] }]
    }),
  )
}

/** One flow per section of the `flows` page; one transition per group drawn as an arrow. */
function readFlows(run: Run, pageId: string | number): FlowSnapshot['flows'] {
  const [pageNode] = run([{ command: 'node.get', params: { id: pageId } }]) as [FigCraftNode]
  const sections = (pageNode.children ?? []).filter((c) => c.type === 'SECTION' && !REFERENCE.test(c.name))
  const sectionNodes = run(sections.map((s) => ({ command: 'node.get', params: { id: s.id } }))) as FigCraftNode[]
  return sectionNodes.map((section) => ({
    name: section.name,
    transitions: (section.children ?? [])
      .filter((c) => c.type === 'GROUP' && !REFERENCE.test(c.name))
      .flatMap((group) => readTransition(run, group)),
  }))
}

/** From the group's pluginData, else from its name and the `condition` text drawn in it; not an arrow otherwise. */
function readTransition(run: Run, group: FigCraftNode): FlowTransition[] {
  const data = group.pluginData ?? {}
  if (data.kind === 'flowEvent') {
    return [transition(data.event ?? '', data.from ?? '', data.to ?? '', data.condition ?? '', group.name)]
  }
  const match = NAME.exec(group.name)
  if (!match) return []
  const [, event = '', fromScreen, fromState, toScreen, toState] = match
  const condition = conditionText(run, group.id)
  return [transition(event, `${fromScreen}/${fromState}`, `${toScreen}/${toState}`, condition, group.name)]
}

/** `state=cart, viewport=mobile` (any order) -> `cart`. */
function stateOf(set: string, variant: string) {
  const values = Object.fromEntries(
    variant.split(',').map((pair) => pair.split('=').map((part) => part.trim()) as [string, string]),
  )
  const state = values.state
  if (!state || !/^\w+$/.test(state)) throw new Error(`${set}: variant "${variant}" has no state=<state>`)
  return state
}

// The `condition` text inside the `label` frame of a group drawn by hand.
function conditionText(run: Run, id: string) {
  const [group] = run([{ command: 'node.get', params: { id } }]) as [FigCraftNode]
  const label = group.children?.find((c) => c.name === 'label')
  if (!label) return ''
  const [frame] = run([{ command: 'node.get', params: { id: label.id } }]) as [FigCraftNode]
  return frame.children?.find((c) => c.name === 'condition')?.characters ?? ''
}

function transition(event: string, from: string, to: string, condition: string, where: string): FlowTransition {
  if (!/^[A-Z][A-Z_]*$/.test(event)) throw new Error(`${where}: event "${event}" is not SCREAMING_SNAKE_CASE`)
  const [fromScreen = '', fromState] = from.split('/')
  const [toScreen = '', toState] = to.split('/')
  if (!fromState || !toState) throw new Error(`${where}: from and to must be Screen/state`)
  return { event, from: fromScreen, fromState, to: toScreen, toState, condition }
}
