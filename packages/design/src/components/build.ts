// Component sets -> one `<name>.variants.ts` per set, with one cva() per styled layer. A port of Atope's
// components exporter to the web.
//
//   component set "Button"           -> <page folder>/button/button.variants.ts
//   the component itself             -> export const button = cva(…)
//   a layer named "label" inside it  -> export const buttonLabel = cva(…)
//   variant property / value         -> variants key / option key; the set's default variant -> defaultVariants
//   a class that depends on one property -> variants; on several -> compoundVariants; on none -> the base classes
//   the design-only `viewport` property (mobile, sm, md, lg) -> never a cva prop: the mobile variant gives the
//                                    classes, and each larger one only what differs from the next one down,
//                                    under its breakpoint prefix (`md:flex-row`)
//   the design-only `interaction` property (rest, hover, focus-visible, active, disabled, open) -> never a cva prop: rest
//                                    gives the classes, each other value only what differs from rest, under its
//                                    variant (`hover:bg-ink/80`; on a part, `group-hover/button:`, the root then
//                                    `group/button`). `open` is `aria-expanded:`. It composes with viewport: `md:hover:`
//   auto layout whose children all fill across it -> items-stretch, the children no self-stretch
//   a set on the inline list        -> its root is inline-flex
//   layer opacity                   -> opacity-*; a transparent stroke -> border-transparent
//   a text layer's tnum feature     -> tabular-nums; any other OpenType feature stops the build
//   a vector (a glyph in a slot, say) -> text-* on its layer or slot: the glyph draws in currentColor
//   a minimum width or height bound to space/* -> min-w-* / min-h-*
//   a wrapping auto layout          -> flex-wrap, with gap-x-* / gap-y-* from its gap and crossGap
//   a slot                          -> a cva for its frame; its content is the component's children in code. Its
//                                    default text named after a text property gets a cva too
//
// The page decides the folder: components/<slice> -> components/<slice>/<name>/, entities/<entity> ->
// entities/<entity>/ui/<name>/, features/<feature> -> features/<feature>/components/<name>/. Screen sets and
// the sets on the not-exported list are never exported.
//
// Only token-bound values become classes (Theme colours, space/*, radius/*, stroke/*, text styles). Anything else
// (a raw colour, a stacked fill, an unbound padding or fixed size) stops the build with the layer named, so the
// design is fixed in FigCraft instead of guessed here. Text, boolean and instance-swap properties are props in
// the hand-written component, not classes.
import { join } from 'node:path'

import type { ComponentsConfig } from '../config.ts'
import type { TextStyle, Variable } from '../tokens/snapshot.ts'
import {
  type Absolute,
  type ComponentSet,
  type Effect,
  type Layer,
  type Layout,
  notExportedBecause,
} from './snapshot.ts'

export type ComponentsContext = {
  config: ComponentsConfig
  /** The token snapshot's variables, by id. */
  variables: Record<string, Variable>
  textStyles: TextStyle[]
  /** The token snapshot's effect styles: a layer's `shadow/*` style is its `shadow-*` class. */
  effectStyles: { id: string; name: string }[]
  textStylePrefix: string
}

/** Tailwind's default breakpoints, in order. `mobile` is the base: no prefix. */
const BREAKPOINTS = ['mobile', 'sm', 'md', 'lg'] as const
const VIEWPORT = 'viewport'
/** `rest` is the base; each other value is the Tailwind variant of the same name unless the config maps it, or
 * `STATE_VARIANTS` names another. */
const STATES = ['rest', 'hover', 'focus-visible', 'active', 'disabled', 'open'] as const
/** `open` is a trigger whose popup is showing: Base UI (and every ARIA disclosure) marks it with `aria-expanded`. */
const STATE_VARIANTS: Record<string, string> = { open: 'aria-expanded' }
const INTERACTION = 'interaction'
/** `default` is the base; each other value is the Tailwind variant of the same name unless the config maps it. */
const POSITIONS = ['default', 'first', 'last', 'only', 'odd', 'even'] as const
const POSITION = 'position'

type Slots = Record<string, string>
type Props = Record<string, string>
type Compound = { when: Record<string, string | string[]>; class: string }

/** The generated variants files by absolute path, and notes on what was read loosely or skipped. */
export function buildComponents(sets: ComponentSet[], context: ComponentsContext) {
  const files = new Map<string, string>()
  const notes: string[] = []
  const problems: string[] = []
  for (const set of sets) {
    const reason = notExportedBecause(set, context.config)
    if (reason) {
      notes.push(`${set.name} is not exported: ${reason}`)
      continue
    }
    const result = generateSet(set, context)
    notes.push(...result.notes)
    if (result.problems.length) {
      problems.push(`${set.name} can't be generated:\n  ${result.problems.join('\n  ')}`)
      continue
    }
    files.set(outPathFor(set, context.config.root), result.source)
  }
  if (problems.length) throw new Error(problems.join('\n'))
  return { files, notes }
}

function generateSet(set: ComponentSet, context: ComponentsContext) {
  const designOnly = [VIEWPORT, INTERACTION, POSITION]
  const variantProps = set.properties.filter((p) => p.type === 'variant' && !designOnly.includes(p.name))
  const viewportProp = set.properties.find((p) => p.type === 'variant' && p.name === VIEWPORT)
  const interactionProp = set.properties.find((p) => p.type === 'variant' && p.name === INTERACTION)
  const positionProp = set.properties.find((p) => p.type === 'variant' && p.name === POSITION)
  const keys = variantProps.map((p) => p.name)
  const options = Object.fromEntries(variantProps.map((p) => [p.name, p.options ?? []]))
  const defaults = Object.fromEntries(variantProps.map((p) => [p.name, String(p.default)]))
  const problems: string[] = []
  const notes = new Set<string>()

  const statePrefixes = context.config.interactionPrefixes[set.name] ?? {}
  // Every state a variant can be drawn in, rest first: the interaction states, then the positions.
  const stateOrder = designOnlyStates(
    { viewport: viewportProp?.options, interaction: interactionProp?.options, position: positionProp?.options },
    statePrefixes,
    problems,
  )
  // The layers that own their states (each its own element); every other layer follows the nearest one above it,
  // the component itself by default.
  const owners = context.config.interactionParts[set.name] ?? []
  const groupOf = (owner: string) => (owner ? `${kebab(set.name)}-${kebab(owner)}` : kebab(set.name))
  // On the layer that owns the state, the state's own variant; below it, the owner's state through its named group.
  const stateVariant = (state: string, part: string, owner: string) => {
    const variant = statePrefixes[state] ?? STATE_VARIANTS[state] ?? state
    if (part === owner) return `${variant}:`
    return `${variant
      .split(':')
      .map((v) => `group-${v}/${groupOf(owner)}`)
      .join(':')}:`
  }
  const partOwner = new Map<string, string>()
  const groups = new Set<string>()

  const { variables } = context
  const token = (id: string | undefined, prefix: string) => {
    const name = id ? variables[id]?.name : undefined
    return name?.startsWith(prefix) ? name.slice(prefix.length).replaceAll('/', '-') : null
  }
  const byValue = (prefix: string) =>
    new Map(
      Object.values(variables)
        .filter((v) => v.name.startsWith(prefix))
        .map((v) => [Object.values(v.valuesByMode)[0], v.name.slice(prefix.length).replaceAll('/', '-')]),
    )
  const textStyleNames = Object.fromEntries(context.textStyles.map((s) => [s.id, s.name]))
  const effectStyleNames = Object.fromEntries(context.effectStyles.map((s) => [s.id, s.name]))
  const leading = Object.fromEntries(context.textStyles.map((s) => [s.id, lineHeightPx(s)]))

  const qualified = qualifiedNames(set.variants)
  const textProps = new Set(set.properties.filter((p) => p.type === 'text').map((p) => p.name))
  // A layer no variant shows is one a boolean property turns on (SavedCardRow's `hasDefault`, default off): the
  // code decides whether it renders, so its classes are the ones it has when shown, not `hidden`.
  const neverShown = set.properties.some((p) => p.type === 'boolean')
    ? layersNeverShown(set.variants)
    : new Set<string>()
  const ctx: SlotContext = {
    neverShown,
    token,
    spaceByValue: byValue('space/'),
    strokeByValue: byValue('stroke/'),
    textStyleNames,
    effectStyleNames,
    textStylesByName: Object.fromEntries(context.textStyles.map((s) => [s.name, s.id])),
    textStylePrefix: context.textStylePrefix,
    leading,
    config: context.config,
    setName: set.name,
    isRoot: true,
    parentStretches: false,
    note: (message) => notes.add(message),
    fail: () => '',
  }

  // Every variant -> its props, its viewport and, per part (layer name), its slots. The component itself is part "".
  const drawn: Drawn[] = set.variants.map((variant) => {
    const all: Props = Object.fromEntries(
      keys.length || viewportProp || interactionProp || positionProp
        ? variant.name.split(', ').map((pair) => pair.split('=') as [string, string])
        : [],
    )
    const {
      [VIEWPORT]: viewport = 'mobile',
      [INTERACTION]: interaction = 'rest',
      [POSITION]: position = 'default',
      ...props
    } = all
    const where = variant.name || set.name
    if (interaction !== 'rest' && position !== 'default') {
      problems.push(`${where}: an interaction state and a position at once are not mapped; draw each on its own`)
    }
    const state = interaction !== 'rest' ? interaction : position !== 'default' ? position : 'rest'
    const parts: Record<string, Slots> = {}
    // Per part, the names of its children in the auto layout, in the order drawn.
    const orders: Record<string, string[]> = {}
    const failAt = (node: Layer) => (message: string) => {
      problems.push(node.name === where ? `${where}: ${message}` : `${where} › ${node.name}: ${message}`)
      return ''
    }
    // Layers repeated under one name share a part when they look the same. Which component an instance
    // shows is a prop, so it doesn't count here.
    const looks = ({ component: _, ...rest }: Slots) => JSON.stringify(rest)
    const record = (part: string, node: Layer, own: Slots) => {
      const seen = parts[part]
      if (seen && looks(seen) !== looks(own)) {
        problems.push(`${where}: layers named "${node.name}" look different; give each its own name`)
      }
      parts[part] = own
    }
    const walk = (
      node: Layer,
      parentLayout: string | undefined,
      isRoot: boolean,
      parentName: string,
      parentStretches: boolean,
      owner: string,
    ) => {
      // A name used under several parents is qualified by its parent: `actionLabel`; one directly under the
      // component keeps its own name.
      const part = isRoot ? '' : partName(node, parentName)
      const ownerHere = !isRoot && owners.includes(node.name) ? part : owner
      partOwner.set(part, ownerHere)
      record(part, node, layerSlots(node, parentLayout, { ...ctx, isRoot, parentStretches, fail: failAt(node) }))
      if (node.type === 'INSTANCE') {
        walkCallerSlots(node, ownerHere)
        return
      }
      const stretches = stretchesChildren(node)
      const children = styledChildren(set.name, node, textProps, context.config)
      const childParent = isRoot ? '' : node.name
      orders[part] = children
        .filter((child) => !child.absolute && child.visible !== false)
        .map((child) => partName(child, childParent))
      for (const child of children) walk(child, node.layout?.mode, false, childParent, stretches, ownerHere)
    }
    // What the caller puts in the child's slot is the caller's own markup, passed as children (the list a
    // Panel holds): its layers are styled here. A glyph put there is the icon the child shows, not markup.
    const walkCallerSlots = (node: Layer, owner: string) => {
      for (const slot of callerSlots(node)) {
        const stretchesSlot = stretchesChildren(slot)
        const content = (slot.children ?? []).filter(
          (child) => child.type !== 'VECTOR' && !context.config.notStyledLayers[`${set.name} › ${child.name}`],
        )
        for (const child of content) walk(child, slot.layout?.mode, false, '', stretchesSlot, owner)
      }
    }
    const partName = (node: Layer, parentName: string) =>
      camel(qualified.has(node.name) ? `${parentName} ${node.name}` : node.name)
    walk(variant, undefined, true, '', false, '')
    return { props, viewport, state, parts, orders }
  })

  reverseReorderedStacks(drawn, keys, (message) => problems.push(`${set.name} › ${message}`))

  // One entry per combination of the cva props; the states and viewports drawn for it become prefixed classes.
  const comboKey = (props: Props) => keys.map((k) => props[k]).join('|')
  const combos = new Map<string, { props: Props; byState: Map<string, Map<string, Record<string, Slots>>> }>()
  for (const v of drawn) {
    const key = comboKey(v.props)
    const combo = combos.get(key) ?? { props: v.props, byState: new Map() }
    const byViewport = combo.byState.get(v.state) ?? new Map()
    byViewport.set(v.viewport, v.parts)
    combo.byState.set(v.state, byViewport)
    combos.set(key, combo)
  }
  const order = (props: Props) => keys.map((k) => (options[k] ?? []).indexOf(props[k] ?? ''))
  const variants = [...combos.values()].sort((a, b) => {
    const [x, y] = [order(a.props), order(b.props)]
    return x.reduce((d, n, i) => d || n - (y[i] ?? 0), 0)
  })
  for (const combo of variants) {
    if (!combo.byState.get('rest')?.has('mobile')) {
      problems.push(
        `${describeProps(combo.props)} has no ${interactionProp ? 'interaction=rest, ' : ''}viewport=mobile variant`,
      )
    }
  }

  // A combination the design leaves out is not designed: its classes are whatever the designed ones imply, so
  // the code must not render it.
  const combinations = keys.reduce((n, k) => n * (options[k]?.length ?? 1), 1)
  if (variants.length !== combinations) {
    notes.add(`${set.name}: ${variants.length} of ${combinations} combinations of ${keys.join(', ')} are designed`)
  }

  const partNames = [...new Set(drawn.flatMap((v) => Object.keys(v.parts)))]
  const exports = partNames.map((part) => {
    const slotNames = [...new Set(drawn.flatMap((v) => Object.keys(v.parts[part] ?? {})))]
    const base: string[] = []
    const vmap: Record<string, Record<string, string[]>> = {}
    const compounds: Compound[] = []
    for (const slot of slotNames) {
      if (slot === 'component') {
        // Which component a nested instance shows is code (an instance-swap prop), not a class.
        const shown = new Set(drawn.map((v) => v.parts[part]?.component).filter(Boolean))
        if (shown.size > 1) {
          problems.push(`${set.name} › ${part}: shows ${[...shown].join(', ')} in different variants; not mapped yet`)
        }
        continue
      }
      // A layer missing from a variant is hidden there.
      const at = (parts: Record<string, Slots>) => {
        const slots = parts[part]
        if (slots) return slots[slot] ?? ''
        return slot === 'display' ? 'hidden' : ''
      }
      const values = variants.map((combo) => {
        const series = (state: string) =>
          BREAKPOINTS.flatMap((viewport) => {
            const parts = combo.byState.get(state)?.get(viewport)
            return parts ? [[viewport, at(parts)] as const] : []
          })
        const fail = (message: string) =>
          problems.push(`${set.name} › ${part || set.name}, ${describeProps(combo.props)}: ${message}`)
        const rest = series('rest')
        const owner = partOwner.get(part) ?? ''
        const stateClasses = stateOrder
          .slice(1)
          .flatMap((state) =>
            stateful(rest, series(state), slot, stateVariant(state, part, owner), (message) =>
              fail(`${state}: ${message}`),
            ),
          )
        if (part !== owner && stateClasses.length) groups.add(owner)
        return { props: combo.props, cls: joinClasses(responsive(rest, slot, fail), ...stateClasses) }
      })
      const derived = derive(values, keys, options)
      base.push(...derived.base)
      for (const [k, byOption] of Object.entries(derived.vmap)) {
        for (const [option, cls] of Object.entries(byOption)) {
          vmap[k] ??= {}
          vmap[k][option] ??= []
          vmap[k][option].push(cls)
        }
      }
      compounds.push(...derived.compounds)
    }
    // Entries with the same conditions become one (padding x and y of the same variants, say).
    const merged: Compound[] = []
    const conditions = (c: Compound) =>
      keys
        .filter((k) => k in c.when)
        .map((k) => `${k}=${[c.when[k]].flat().join('|')}`)
        .join()
    for (const c of compounds) {
      const same = merged.find((m) => conditions(m) === conditions(c))
      if (same) same.class += ` ${c.class}`
      else merged.push({ when: { ...c.when }, class: c.class })
    }
    const used = keys.filter((k) => vmap[k] || merged.some((c) => k in c.when))
    return { name: camel(`${set.name}${part ? ` ${part}` : ''}`), base, vmap, compounds: merged, used }
  })

  // A layer that follows another's state names that one as its group.
  for (const owner of groups) {
    const named = exports.find((e) => e.name === camel(`${set.name}${owner ? ` ${owner}` : ''}`))
    named?.base.unshift(`group/${groupOf(owner)}`)
  }

  const isBool = (k: string) => (options[k] ?? []).every((o) => o === 'true' || o === 'false')
  const value = (k: string, v: string) => (isBool(k) ? v : `'${v}'`)
  const optionKey = (o: string) => (/^[A-Za-z_$][\w$]*$/.test(o) ? o : `'${o}'`)
  const condition = (k: string, v: string | string[]) =>
    Array.isArray(v) ? `[${v.map((x) => value(k, x)).join(', ')}]` : value(k, v)
  // A part with no classes in any variant (a nested component that keeps its own size) exports nothing.
  const body = exports
    .filter((e) => e.base.length || e.used.length)
    .map((e) => {
      // A part that looks the same in every variant needs no config.
      if (e.used.length === 0) return `export const ${e.name} = cva('${e.base.join(' ')}')`
      const lines = [`export const ${e.name} = cva('${e.base.join(' ')}', {`, '  variants: {']
      for (const k of e.used) {
        lines.push(`    ${k}: {`)
        for (const o of options[k] ?? []) lines.push(`      ${optionKey(o)}: '${(e.vmap[k]?.[o] ?? []).join(' ')}',`)
        lines.push('    },')
      }
      lines.push('  },')
      if (e.compounds.length) {
        lines.push('  compoundVariants: [')
        for (const c of e.compounds) {
          const conds = keys.filter((k) => k in c.when).map((k) => `${k}: ${condition(k, c.when[k] ?? '')}`)
          lines.push(`    { ${conds.join(', ')}, class: '${c.class}' },`)
        }
        lines.push('  ],')
      }
      lines.push(
        `  defaultVariants: { ${e.used.map((k) => `${k}: ${value(k, defaults[k] ?? '')}`).join(', ')} },`,
        '})',
      )
      return lines.join('\n')
    })
  const source = [
    `// Generated by @proteus/design from the FigCraft component set "${set.name}". Do not edit: change the design file, then run its components:export.`,
    "import { cva } from 'class-variance-authority'",
    '',
    body.join('\n\n'),
    '',
  ].join('\n')
  return { source, problems, notes: [...notes] }
}

/** Checks the design-only properties' values; returns the states a variant can be drawn in, rest first. */
function designOnlyStates(
  drawn: { viewport?: string[]; interaction?: string[]; position?: string[] },
  prefixes: Record<string, string>,
  problems: string[],
) {
  const viewports = drawn.viewport ?? ['mobile']
  const unknown = viewports.filter((v) => !(BREAKPOINTS as readonly string[]).includes(v))
  if (unknown.length) problems.push(`viewport values ${unknown.join(', ')}; use ${BREAKPOINTS.join(', ')}`)
  if (!viewports.includes('mobile')) problems.push('the viewport property needs a mobile value, the base classes')
  const states = drawn.interaction ?? ['rest']
  const unknownStates = states.filter((v) => !(STATES as readonly string[]).includes(v))
  if (unknownStates.length) problems.push(`interaction values ${unknownStates.join(', ')}; use ${STATES.join(', ')}`)
  if (!states.includes('rest')) problems.push('the interaction property needs a rest value, the base classes')
  const positions = drawn.position ?? ['default']
  const unknownPositions = positions.filter((v) => !(POSITIONS as readonly string[]).includes(v) && !prefixes[v])
  if (unknownPositions.length) {
    problems.push(
      `position values ${unknownPositions.join(', ')}; use ${POSITIONS.join(', ')} or map them in interactionPrefixes`,
    )
  }
  if (!positions.includes('default')) problems.push('the position property needs a default value, the base classes')
  return [
    'rest',
    ...STATES.slice(1).filter((state) => states.includes(state)),
    ...positions.filter((p) => p !== 'default'),
  ]
}

type Drawn = {
  props: Props
  viewport: string
  state: string
  parts: Record<string, Slots>
  orders: Record<string, string[]>
}

// The code has one DOM order, the one drawn at the largest viewport. A smaller viewport that draws a stack's
// children the other way round reverses the stack there (`flex-col-reverse sm:flex-row`).
function reverseReorderedStacks(drawn: Drawn[], keys: string[], fail: (message: string) => void) {
  const rank = (viewport: string) => (BREAKPOINTS as readonly string[]).indexOf(viewport)
  for (const v of drawn) {
    const peers = drawn.filter((o) => o.state === v.state && keys.every((k) => o.props[k] === v.props[k]))
    const top = peers.reduce((a, b) => (rank(b.viewport) > rank(a.viewport) ? b : a))
    if (top === v) continue
    for (const [part, drawnOrder] of Object.entries(v.orders)) {
      // Children shown at only one of the two viewports are hidden at the other; only the shared ones have an order.
      const dom = top.orders[part]?.filter((name) => drawnOrder.includes(name)) ?? []
      const order = drawnOrder.filter((name) => dom.includes(name))
      const slots = v.parts[part]
      if (order.join() === dom.join() || !slots) continue
      if (order.join() !== [...dom].reverse().join()) {
        fail(
          `${part || 'the component'}: children drawn ${order.join(', ')} at ${v.viewport} but ${dom.join(', ')} at ${top.viewport}; only a reversed order maps (flex-*-reverse)`,
        )
        continue
      }
      slots.direction = slots.direction === 'flex-col' ? 'flex-col-reverse' : 'flex-row-reverse'
    }
  }
}

function describeProps(props: Props) {
  return (
    Object.entries(props)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ') || 'the component'
  )
}

/** The class a slot takes when a larger viewport drops what the next one down had. */
const RESETS: Record<string, string> = {
  display: 'block',
  opacity: 'opacity-100',
  direction: 'flex-row',
  justify: 'justify-start',
  items: 'items-stretch',
  px: 'px-0',
  py: 'py-0',
  gap: 'gap-0',
  wrap: 'flex-nowrap',
  width: 'w-auto',
  height: 'h-auto',
  minWidth: 'min-w-0',
  minHeight: 'min-h-0',
  maxWidth: 'max-w-none',
  maxHeight: 'max-h-none',
  ring: 'ring-0',
  shadow: 'shadow-none',
  blur: 'backdrop-blur-none',
  rotate: 'rotate-0',
  position: 'static',
  bg: 'bg-transparent',
  borderWidth: 'border-0',
  borderStyle: 'border-solid',
  borderColor: '',
  rounded: 'rounded-none',
  overflow: 'overflow-visible',
  textAlign: 'text-start',
}

/** A fill along the parent's axis is `flex-1`, not a width: what undoes it is the CSS default. */
const FILL_RESETS: Record<string, string> = { 'flex-1': 'flex-initial' }

/**
 * One slot across the viewports drawn for a variant, smallest first -> the mobile classes, then for each larger
 * viewport only the classes that differ from the next one down, under its prefix.
 */
function responsive(values: (readonly [string, string])[], slot: string, fail: (message: string) => void) {
  const [first, ...later] = values
  if (!first) return ''
  const out = split(first[1])
  let previous = first[1]
  for (const [viewport, cls] of later) {
    if (cls === previous) continue
    const before = new Set(split(previous))
    const added = split(cls).filter((c) => !before.has(c))
    if (added.length === 0) {
      const reset = FILL_RESETS[previous] ?? RESETS[slot]
      if (reset === undefined || cls !== '') {
        fail(`${slot} changes from "${previous}" to "${cls}" at ${viewport}; no class undoes that`)
      } else if (reset) out.push(`${viewport}:${reset}`)
    }
    out.push(...added.map((c) => `${viewport}:${c}`))
    previous = cls
  }
  return out.join(' ')
}

/**
 * One slot in one interaction state, against rest: at each viewport the state is drawn at, the classes that differ
 * from what rest is there, under the breakpoint and the state's variant (`md:hover:`); a larger viewport only
 * when that changes.
 */
function stateful(
  rest: (readonly [string, string])[],
  drawn: (readonly [string, string])[],
  slot: string,
  variant: string,
  fail: (message: string) => void,
) {
  const order = (viewport: string) => (BREAKPOINTS as readonly string[]).indexOf(viewport)
  const out: string[] = []
  let previous = ''
  for (const [viewport, cls] of drawn) {
    const restHere = rest.filter(([v]) => order(v) <= order(viewport)).at(-1)?.[1] ?? ''
    const before = new Set(split(restHere))
    let differs = split(cls).filter((c) => !before.has(c))
    if (differs.length === 0 && cls !== restHere) {
      const reset = RESETS[slot]
      if (!reset || cls !== '') fail(`${slot} changes from "${restHere}" to "${cls}"; no class undoes that`)
      else differs = [reset]
    }
    const key = differs.join(' ')
    if (key === previous) continue
    // A larger viewport where the state matches rest again repeats rest's classes under the state.
    const classes = differs.length ? differs : split(restHere)
    const prefix = `${viewport === 'mobile' ? '' : `${viewport}:`}${variant}`
    out.push(...classes.map((c) => `${prefix}${c}`))
    previous = key
  }
  return out
}

function split(classes: string) {
  return classes.split(' ').filter(Boolean)
}

// One slot across every variant -> base class, per-property variants, or compound variants.
function derive(values: { props: Props; cls: string }[], keys: string[], options: Record<string, string[]>) {
  const classes = new Set(values.map((v) => v.cls))
  if (classes.size === 1) {
    const [cls] = classes
    return { base: cls ? [cls] : [], vmap: {}, compounds: [] }
  }
  // Try each property as the primary one and keep the smallest result (first property on a tie).
  let best: ReturnType<typeof planFor> | undefined
  for (const p of keys) {
    const plan = planFor(p, values, keys, options)
    if (!best || plan.size < best.size) best = plan
  }
  return { base: [], vmap: best?.vmap ?? {}, compounds: best?.compounds ?? [] }
}

// With `p` as the primary property: an option of it with one class goes to variants, the rest to compound
// variants keyed by the fewest other properties.
function planFor(
  p: string,
  values: { props: Props; cls: string }[],
  keys: string[],
  options: Record<string, string[]>,
) {
  const vmap: Record<string, Record<string, string>> = {}
  const compounds: Compound[] = []
  for (const option of options[p] ?? []) {
    const subset = values.filter((v) => v.props[p] === option)
    const own = new Set(subset.map((v) => v.cls))
    if (own.size !== 1) {
      compounds.push(...compoundsFor(p, option, subset, keys))
      continue
    }
    const [cls] = own
    if (cls) {
      vmap[p] ??= {}
      vmap[p][option] = cls
    }
  }
  const merged = mergeCompounds(compounds, options)
  const size = Object.values(vmap).reduce((n, o) => n + Object.keys(o).length, 0) + 2 * merged.length
  return { vmap, compounds: merged, size }
}

function compoundsFor(p: string, option: string, subset: { props: Props; cls: string }[], keys: string[]) {
  const others = keys.filter((k) => k !== p)
  let ks: string[] = others
  for (let n = 1; n <= others.length; n++) {
    const found = combinations(others, n).find((combo) => determines(combo, subset))
    if (found) {
      ks = found
      break
    }
  }
  const seen = new Set<string>()
  const out: Compound[] = []
  for (const v of subset) {
    const id = ks.map((k) => v.props[k]).join('|')
    if (seen.has(id)) continue
    seen.add(id)
    if (v.cls)
      out.push({ when: { [p]: option, ...Object.fromEntries(ks.map((k) => [k, v.props[k] ?? ''])) }, class: v.cls })
  }
  return out
}

// Whether the properties `ks` alone decide the class within `subset`.
function determines(ks: string[], subset: { props: Props; cls: string }[]) {
  const seen = new Map<string, string>()
  for (const v of subset) {
    const id = ks.map((k) => v.props[k]).join('|')
    if (seen.has(id) && seen.get(id) !== v.cls) return false
    seen.set(id, v.cls)
  }
  return true
}

function combinations(list: string[], n: number, start = 0, acc: string[] = []): string[][] {
  if (acc.length === n) return [acc]
  const out: string[][] = []
  for (let i = start; i < list.length; i++) out.push(...combinations(list, n, i + 1, [...acc, list[i] ?? '']))
  return out
}

// Same class, same keys, one key differs -> one entry with an array of options for that key.
function mergeCompounds(list: Compound[], options: Record<string, string[]>) {
  const conds = (c: Compound) => Object.keys(c.when).sort((x, y) => x.localeCompare(y))
  for (let merged = true; merged; ) {
    merged = false
    search: for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i], list[j]]
        if (!a || !b || a.class !== b.class || conds(a).join() !== conds(b).join()) continue
        const diff = conds(a).filter((k) => [a.when[k]].flat().join() !== [b.when[k]].flat().join())
        const [k] = diff
        if (diff.length !== 1 || !k) continue
        const all = options[k] ?? []
        const opts = [...new Set([...[a.when[k] ?? []].flat(), ...[b.when[k] ?? []].flat()])].sort(
          (x, y) => all.indexOf(x) - all.indexOf(y),
        )
        const when = { ...a.when, [k]: opts }
        if (opts.length === all.length) delete when[k]
        list.splice(j, 1)
        list[i] = { when, class: a.class }
        merged = true
        break search
      }
    }
  }
  return list
}

type SlotContext = {
  token: (id: string | undefined, prefix: string) => string | null
  spaceByValue: Map<unknown, string>
  strokeByValue: Map<unknown, string>
  textStyleNames: Record<string, string>
  effectStyleNames: Record<string, string>
  /** Text style ids by name (`type/body`). */
  textStylesByName: Record<string, string>
  textStylePrefix: string
  /** Each text style's line height in px, by style id. */
  leading: Record<string, number | undefined>
  config: ComponentsConfig
  setName: string
  /** Names of the layers hidden in every variant: a boolean property shows them. */
  neverShown: Set<string>
  /** The layer is the component itself. */
  isRoot: boolean
  /** The parent's auto layout stretches its children across (items-stretch). */
  parentStretches: boolean
  note: (message: string) => void
  fail: (message: string) => string
}

function layersNeverShown(variants: Layer[]) {
  const hidden = new Set<string>()
  const shown = new Set<string>()
  const visit = (node: Layer) => {
    ;(node.visible === false ? hidden : shown).add(node.name)
    for (const child of node.children ?? []) visit(child)
  }
  for (const variant of variants) visit(variant)
  return new Set([...hidden].filter((name) => !shown.has(name)))
}

// A slot's content is the caller's: only the slot frame itself is styled. Its default text, when named after a
// text property, is styled too: the component draws it.
function styledChildren(setName: string, node: Layer, textProps: Set<string>, config: ComponentsConfig) {
  const children = (node.children ?? []).filter((child) => !config.notStyledLayers[`${setName} › ${child.name}`])
  return node.slot ? children.filter((child) => child.type === 'TEXT' && textProps.has(child.name)) : children
}

// The slots of one layer. A slot holds one concern (display, padding x, fill…), so no two classes in a variant
// conflict, and a breakpoint can override exactly the concern that changes.
function layerSlots(node: Layer, parentLayout: string | undefined, ctx: SlotContext): Slots {
  const key = ctx.isRoot ? ctx.setName : `${ctx.setName} › ${node.name}`
  const flex = ctx.isRoot && ctx.config.inline.includes(ctx.setName) ? 'inline-flex' : 'flex'
  const display = node.layout?.mode === 'grid' ? 'grid' : node.layout ? flex : ''
  const s: Slots = { display: node.visible === false && !ctx.neverShown.has(node.name) ? 'hidden' : display }
  // A nested instance's opacity is its main's: the child's own look (a faded variant), not this layer's. An override of
  // it is caught with the other visual overrides.
  if (node.type !== 'INSTANCE' && node.opacity != null && node.opacity < 1)
    s.opacity = `opacity-${Math.round(node.opacity * 100)}`
  s.width =
    ctx.isRoot && ctx.config.fullWidth.includes(ctx.setName)
      ? 'w-full'
      : sizeClass(node, 'horizontal', parentLayout, ctx)
  s.height = sizeClass(node, 'vertical', parentLayout, ctx)
  s.minWidth = boundSizeClass(node, 'minWidth', 'min-w', ctx)
  s.minHeight = boundSizeClass(node, 'minHeight', 'min-h', ctx)
  s.maxWidth = boundSizeClass(node, 'maxWidth', 'max-w', ctx)
  s.maxHeight = boundSizeClass(node, 'maxHeight', 'max-h', ctx)
  s.rotate = rotateClass(node, ctx.fail)
  // A grid child spanning several columns.
  const span = parentLayout === 'grid' ? (node.gridCell?.columnSpan ?? 1) : 1
  s.span = span > 1 ? `col-span-${span}` : ''
  s.position = positionClass(node, key, ctx)
  const effects = effectSlots(node, ctx)
  if (node.type === 'TEXT') return { ...s, ...textSlots(node, ctx), ...effects }
  // A nested instance is a child component (an Icon, say): only its box is styled here, through className.
  if (node.type === 'INSTANCE') return { ...s, ...instanceSlots(node, ctx), ...effects }
  // A vector is a glyph the component draws as an <svg> in currentColor: its colour is the class, its shape code.
  if (node.type === 'VECTOR') return { ...s, width: '', height: '', textColor: glyphColor([node], ctx) }
  if (!['COMPONENT', 'FRAME', 'RECTANGLE'].includes(node.type)) {
    ctx.fail(`${node.type} layers are not mapped yet; extend packages/design/src/components/build.ts`)
    return s
  }
  const type = inheritedType(key, ctx)
  return { ...s, ...frameSlots(node, ctx), type, ...effects }
}

// On the web an absolute layer is placed against its nearest positioned ancestor, so its parent is `relative`.
// A layer placed at run time keeps only `absolute`: its insets are the code's.
// A layer placed against Base UI's positioner leaves its parent unpositioned.
function positionClass(node: Layer, key: string, ctx: SlotContext) {
  const anchoredToPositioner = (child: Layer) =>
    ctx.config.positionerAnchored.includes(`${ctx.setName} › ${child.name}`)
  if (node.absolute) {
    return ctx.config.runtimePositions.includes(key) || anchoredToPositioner(node)
      ? 'absolute'
      : absoluteClass(node.absolute, ctx)
  }
  return (node.children ?? []).some((child) => child.absolute && !anchoredToPositioner(child)) ? 'relative' : ''
}

// A text style the layer sets for the text inside it to inherit.
function inheritedType(key: string, ctx: SlotContext) {
  const inherited = ctx.config.inheritedText[key]
  if (!inherited) return ''
  return inherited.startsWith('type/') && ctx.textStylesByName[inherited]
    ? `${ctx.textStylePrefix}${inherited.slice('type/'.length).replaceAll('/', '-')}`
    : ctx.fail(`inheritedText ${inherited} is not a type/* text style`)
}

/** Tailwind's blur scale, in px. */
const BLURS: Record<number, string> = { 4: 'xs', 8: 'sm', 12: 'md', 16: 'lg', 24: 'xl', 40: '2xl', 64: '3xl' }

// A layer's visible effects. An effect style (`shadow/*`) is its `shadow-*` class; a drop shadow with no offset and
// no blur, only a spread, is a ring (`ring-3 ring-focus-ring`, its colour a Theme role; an inner one `ring-inset`); a background blur is
// `backdrop-blur-*`. Any other shadow is drawn through an effect style, so the token holds its numbers.
function effectSlots(node: Layer, ctx: SlotContext): Slots {
  const all = node.effects ?? []
  const shown = all.map((effect, index) => ({ effect, index })).filter(({ effect }) => effect.visible !== false)
  if (shown.length === 0) return {}
  if (node.effectStyle) return { shadow: effectStyleShadow(node.effectStyle, ctx) }
  const out: Slots = {}
  for (const { effect, index } of shown) {
    if (effect.type === 'backgroundBlur') {
      out.blur = blurClass(effect, ctx)
    } else if ((effect.type === 'dropShadow' || effect.type === 'innerShadow') && isRing(effect)) {
      if (out.ring) out.ring = ctx.fail('two rings; draw one')
      out.ring = ringClass(node, effect, index, ctx)
    } else {
      out.shadow = ctx.fail(`a shadow is an effect style (shadow/*); apply one`)
    }
  }
  return out
}

function effectStyleShadow(effectStyle: string, ctx: SlotContext) {
  const name = ctx.effectStyleNames[effectStyle]
  return name?.startsWith('shadow/')
    ? `shadow-${name.slice('shadow/'.length).replaceAll('/', '-')}`
    : ctx.fail(`effect style ${name ?? effectStyle} is not a shadow/* style`)
}

function blurClass(effect: Effect, ctx: SlotContext) {
  const size = BLURS[effect.radius ?? 0]
  return size ? `backdrop-blur-${size}` : ctx.fail(`background blur ${effect.radius} is off Tailwind's blur scale`)
}

// An inner shadow's ring is drawn inside the box: `ring-inset`.
function ringClass(node: Layer, effect: Effect, index: number, ctx: SlotContext) {
  const role = ctx.token(node.boundVariables?.[`effects/${index}/color`], 'color/')
  const inset = effect.type === 'innerShadow' ? ' ring-inset' : ''
  return role ? `ring-${effect.spread} ring-${role}${inset}` : ctx.fail('ring colour is not bound to a Theme colour')
}

function isRing(effect: Effect) {
  const [x = 0, y = 0] = effect.offset ?? []
  return x === 0 && y === 0 && !effect.radius && (effect.spread ?? 0) > 0
}

// Layer names that appear under more than one parent name in a variant (the component itself counts as '').
function qualifiedNames(variants: Layer[]) {
  const qualified = new Set<string>()
  for (const variant of variants) {
    const parentsOf = new Map<string, Set<string>>()
    const visit = (node: Layer, isRoot: boolean) => {
      if (node.type === 'INSTANCE') return
      for (const child of node.children ?? []) {
        const parents = parentsOf.get(child.name) ?? new Set()
        parents.add(isRoot ? '' : node.name)
        parentsOf.set(child.name, parents)
        visit(child, false)
      }
    }
    visit(variant, true)
    for (const [name, parents] of parentsOf) if (parents.size > 1) qualified.add(name)
  }
  return qualified
}

function colorClass(node: Layer, prefix: string, { token, fail }: SlotContext) {
  const fills = (node.fills ?? []).filter((f) => f.visible !== false)
  if (fills.length === 0) return ''
  if (fills.some((f) => f.type !== 'solid')) return fail(`${fills.map((f) => f.type).join(', ')} fills are not mapped`)
  if (fills.length > 1) return fail(`${fills.length} stacked fills; use one fill bound to a Theme colour`)
  const bound = node.boundVariables ?? {}
  const name = token(bound.fill ?? bound['fills/0/color'], 'color/')
  if (!name) return fail(`fill ${fills[0]?.color} is not bound to a Theme colour`)
  const alpha = fills[0]?.opacity
  const suffix = alpha != null && alpha < 1 ? `/${Math.round(alpha * 100)}` : ''
  return `${prefix}-${name}${suffix}`
}

// space/* sizes, or stroke/* for a rule as thick as a stroke. A rule drawn as a layer with no binding is read as
// the stroke of its thickness.
function sizeToken(node: Layer, horizontal: boolean, parentLayout: string | undefined, ctx: SlotContext) {
  const bound = node.boundVariables?.[horizontal ? 'width' : 'height']
  const named = ctx.token(bound, 'space/') ?? ctx.token(bound, 'stroke/')
  if (named) return named
  const value = horizontal ? node.width : node.height
  const asStroke = ctx.strokeByValue.get(value)
  if (!asStroke || !parentLayout) return null
  ctx.note(
    `${ctx.setName} › ${node.name}: ${horizontal ? 'width' : 'height'} ${value} is not bound; read as stroke/${asStroke}`,
  )
  return asStroke
}

// Along the axis the parent stacks its children, or across it, where a stretching parent already sizes it. A grid
// cell stretches its child.
function fillClass(axis: 'horizontal' | 'vertical', parentLayout: string | undefined, ctx: SlotContext) {
  if (!parentLayout) return ctx.fail(`fill ${axis} on the component itself; width is the caller's layout`)
  if (parentLayout === 'grid') return ''
  if (parentLayout === axis) return 'flex-1'
  return ctx.parentStretches ? '' : 'self-stretch'
}

function sizeClass(node: Layer, axis: 'horizontal' | 'vertical', parentLayout: string | undefined, ctx: SlotContext) {
  const sizing = node.sizing?.[axis]
  if (sizing === 'fill') return fillClass(axis, parentLayout, ctx)
  if (sizing !== 'fixed') return ''
  // A layer pinned to both edges takes its size from its insets.
  if (node.absolute?.[axis] === (axis === 'horizontal' ? 'leftRight' : 'topBottom')) return ''
  // A nested instance keeps its component's own size unless the instance resizes it.
  if (node.type === 'INSTANCE' && !node.overrides?.includes('size')) return ''
  if (ctx.config.runtimeSizes[`${ctx.setName} › ${node.name}`] === axis) return ''
  const horizontal = axis === 'horizontal'
  const value = horizontal ? node.width : node.height
  // A text one line tall (its height is its style's line height) sizes itself, as if it hugged.
  if (!horizontal && node.type === 'TEXT' && node.textStyle && value === ctx.leading[node.textStyle]) return ''
  const named = sizeToken(node, horizontal, parentLayout, ctx)
  if (named) return `${horizontal ? 'w' : 'h'}-${named}`
  // The component's own width or height, when no token sets it, only previews it in FigCraft: the caller sizes it.
  if (!parentLayout) {
    ctx.note(`${ctx.setName}: ${horizontal ? 'width' : 'height'} ${value} is not bound; it is left to the caller`)
    return ''
  }
  return ctx.fail(`fixed ${horizontal ? 'width' : 'height'} ${value} is not bound to a space token`)
}

// A minimum or maximum size bound to space/* keeps a layer within a token's size while it hugs content that grows
// with the text. A nested instance keeps its component's own; an unbound one is left out with a note.
function boundSizeClass(
  node: Layer,
  field: 'minWidth' | 'minHeight' | 'maxWidth' | 'maxHeight',
  prefix: string,
  ctx: SlotContext,
) {
  if (!node[field] || node.type === 'INSTANCE') return ''
  const named = ctx.token(node.boundVariables?.[field], 'space/')
  if (named) return `${prefix}-${named}`
  ctx.note(`${ctx.setName} › ${node.name}: ${field} ${node[field]} is not bound; it is left out`)
  return ''
}

// A layer outside the auto layout: `absolute` and an inset per pinned edge, each the space token of that distance
// (a negative one reaches past the edge: `-left-2`). Centred across the parent's auto layout it is `self-center`
// with no inset on that axis.
function absoluteClass(place: Absolute, { spaceByValue, fail }: SlotContext) {
  const edges = {
    horizontal: ({ left: ['left'], right: ['right'], leftRight: ['left', 'right'] } as const)[
      place.horizontal as 'left'
    ],
    vertical: ({ top: ['top'], bottom: ['bottom'], topBottom: ['top', 'bottom'] } as const)[place.vertical as 'top'],
  }
  const classes = ['absolute']
  for (const axis of ['horizontal', 'vertical'] as const) {
    const list = edges[axis]
    const across = place.parentLayout && place.parentLayout !== axis
    if (!list && place[axis] === 'center' && across) {
      const [start, end] = axis === 'horizontal' ? [place.left, place.right] : [place.top, place.bottom]
      if (Math.abs(start - end) > 1) return fail(`${axis} constraint center is off centre (${start} / ${end})`)
      classes.push('self-center')
      continue
    }
    if (!list) return fail(`${axis} constraint ${place[axis]} is not mapped yet`)
    for (const edge of list) {
      const value = place[edge]
      const named = spaceByValue.get(Math.abs(value))
      if (named == null) return fail(`${edge} inset ${value} is not a space token`)
      classes.push(`${value < 0 ? '-' : ''}${edge}-${named}`)
    }
  }
  return classes.join(' ')
}

// FigCraft turns counter-clockwise, CSS clockwise; Tailwind has classes for a few angles.
function rotateClass(node: Layer, fail: (message: string) => string) {
  const turn = (((-(node.rotation ?? 0) % 360) + 540) % 360) - 180 || 0
  if (!turn) return ''
  const degrees = Math.abs(Math.round(turn * 100) / 100)
  if (![1, 2, 3, 6, 12, 45, 90, 180].includes(degrees)) return fail(`rotation ${node.rotation} has no class`)
  return `${turn < 0 && degrees !== 180 ? '-' : ''}rotate-${degrees}`
}

function textSlots(node: Layer, ctx: SlotContext): Slots {
  const style = node.textStyle ? ctx.textStyleNames[node.textStyle] : undefined
  return {
    type: style?.startsWith('type/')
      ? `${ctx.textStylePrefix}${style.slice('type/'.length).replaceAll('/', '-')}`
      : ctx.fail('text has no type/* text style'),
    textColor: colorClass(node, 'text', ctx),
    textAlign:
      ({ center: 'text-center', right: 'text-right', justified: 'text-justify' } as Slots)[node.textAlign ?? ''] ?? '',
    numeric: Object.entries(node.fontFeatures ?? {})
      .map(([feature, on]) =>
        feature === 'tnum' && on
          ? 'tabular-nums'
          : ctx.fail(`OpenType feature ${feature} ${on ? 'on' : 'off'} has no class`),
      )
      .join(' '),
  }
}

function instanceSlots(node: Layer, ctx: SlotContext): Slots {
  const { token, fail, spaceByValue } = ctx
  // Which variant of its set it shows is the child's own prop, passed in code; only another set is a swap.
  const s: Slots = { component: node.mainSet ?? node.mainComponentName ?? '' }
  // Its box (size, position) is styled here and the instance-swap prop picks the component; any other override
  // (colours, text, nested props) changes the child's look, which is not mapped yet.
  const visual = (node.overrides ?? []).filter(
    (group) => !['size', 'resizing', 'position', 'name', 'component', 'visible', 'props'].includes(group),
  )
  if (visual.length) fail(`${visual.join(', ')} overridden inside a nested instance; not mapped yet`)
  const inside = descendants(node)
  if (node.mainSet === 'Icon') {
    // <Icon className> replaces its default size, so the class always carries one: the instance's token, else the
    // space token of its size.
    for (const [slot, prefix, value] of [
      ['width', 'w', node.width],
      ['height', 'h', node.height],
    ] as const) {
      const named = token(node.boundVariables?.[slot], 'space/') ?? spaceByValue.get(value)
      s[slot] = named ? `${prefix}-${named}` : fail(`icon ${slot} ${value} is not a space token`)
    }
    // An icon draws in one Theme colour: `text-*` on <Icon>, whether the main sets it or the instance overrides it.
    const colors = new Set(
      inside.flatMap((child) =>
        ['stroke', 'fill', 'strokes/0/color', 'fills/0/color']
          .map((k) => child.boundVariables?.[k])
          .filter((id): id is string => Boolean(id))
          .map((id) => token(id, 'color/') ?? `unbound ${id}`),
      ),
    )
    if (colors.size !== 1) fail(`icon colours ${[...colors].join(', ') || 'none'}; one Theme colour`)
    else s.textColor = `text-${[...colors][0]}`
    return s
  }
  // Text inside it is the child's text prop; an instance swapped inside it the child's instance-swap prop. The
  // colour of an icon inside it follows the child's own variant. Content put in one of its slots is the child's
  // children in code (the glyph a Button shows), not a change to its look. A layer whose fill comes from data at run
  // time (runtimeFills: a product photograph) may show another one: that is the child's data, not its look.
  const iconGlyphs = new Set(inside.filter((child) => child.mainSet === 'Icon').flatMap(descendants))
  // Each layer inside belongs to its nearest instance (a card inside a grid inside this one).
  const ownerOf = new Map<Layer, string | undefined>()
  const own = (parent: Layer, owner: string | undefined) => {
    for (const child of parent.children ?? []) {
      ownerOf.set(child, owner)
      own(child, child.type === 'INSTANCE' ? (child.mainSet ?? child.mainComponentName) : owner)
    }
  }
  own(node, node.mainSet ?? node.mainComponentName)
  const dataFills = ctx.config.runtimeFills.map((key) => key.split(' › '))
  const isDataFill = (child: Layer) =>
    dataFills.some(([set, layer]) => set === ownerOf.get(child) && layer === child.name)
  // The caller's own markup in the child's slots is styled as the caller's layers, not checked here.
  const callerOwned = new Set(callerSlots(node).flatMap(descendants))
  const changed = inside.filter(
    (child) =>
      !callerOwned.has(child) &&
      (child.overrides ?? []).some(
        (group) =>
          !['name', 'characters', 'component', 'visible', 'props', 'slot'].includes(group) &&
          !(iconGlyphs.has(child) && ['fills', 'strokes'].includes(group)) &&
          !(group === 'fills' && isDataFill(child)),
      ),
  )
  if (changed.length) {
    fail(
      `${changed.map((child) => child.name).join(', ')} overridden inside ${node.mainSet ?? 'a nested instance'}; not mapped yet`,
    )
  }
  return s
}

/** The slots inside a nested instance (not inside an instance nested in it) whose content the caller replaced. */
function callerSlots(node: Layer): Layer[] {
  return (node.children ?? []).flatMap((child) => {
    if (child.type === 'INSTANCE') return []
    if (child.slot && child.overrides?.includes('slot')) return [child]
    return callerSlots(child)
  })
}

function descendants(node: Layer): Layer[] {
  return (node.children ?? []).flatMap((child) => [child, ...descendants(child)])
}

/** Whether every child in the auto layout fills across it, so the layout stretches them (items-stretch). */
function stretchesChildren(node: Layer) {
  const mode = node.layout?.mode
  if (mode !== 'horizontal' && mode !== 'vertical') return false
  const across = mode === 'horizontal' ? 'vertical' : 'horizontal'
  const inFlow = (node.children ?? []).filter((child) => !child.absolute && child.visible !== false)
  // An empty slot holds the caller's content, which fills it as a block would.
  if (node.slot && inFlow.length === 0) return true
  return inFlow.length > 0 && inFlow.every((child) => child.sizing?.[across] === 'fill')
}

// The vectors of a layer, or of a slot's content, draw in one Theme colour: `text-*`, read through currentColor.
function glyphColor(vectors: Layer[], { token, fail }: SlotContext) {
  const colors = new Set(
    vectors.flatMap((vector) =>
      ['stroke', 'fill', 'strokes/0/color', 'fills/0/color']
        .map((k) => vector.boundVariables?.[k])
        .filter((id): id is string => Boolean(id))
        .map((id) => token(id, 'color/') ?? `unbound ${id}`),
    ),
  )
  if (colors.size === 0 && vectors.some((v) => v.fills?.length || v.strokes?.length)) {
    return fail('vector colour is not bound to a Theme colour')
  }
  if (colors.size > 1) return fail(`vector colours ${[...colors].join(', ')}; one Theme colour`)
  const [color] = colors
  return color ? `text-${color}` : ''
}

function frameSlots(node: Layer, ctx: SlotContext): Slots {
  const strokes = (node.strokes ?? []).filter((f) => f.visible !== false)
  const layout = node.layout
  // FigCraft draws an inside stroke over the padding unless the auto layout includes strokes; a CSS border takes
  // layout space. Padding minus the border width keeps the size and the content in place. Per side [top, right,
  // bottom, left]: a rule on some sides only takes space on those sides.
  const sides = node.strokeSides ?? [1, 1, 1, 1]
  const inset = sides.map((on) =>
    strokes.length && layout && !layout.strokesIncluded && on ? (node.strokeWeight ?? 0) : 0,
  )
  return {
    ...(layout ? layoutSlots(node, layout, inset, ctx) : {}),
    bg: ctx.config.runtimeFills.includes(`${ctx.setName} › ${node.name}`) ? '' : colorClass(node, 'bg', ctx),
    ...borderSlots(node, strokes.length, ctx),
    rounded: roundedClass(node, ctx),
    overflow: node.overflow
      ? { vertical: 'overflow-y-auto', horizontal: 'overflow-x-auto', both: 'overflow-auto' }[node.overflow]
      : node.clip
        ? 'overflow-hidden'
        : '',
    // A slot's glyph (not one inside a nested instance, which colours itself) takes the slot's text colour.
    ...(node.slot ? { textColor: glyphColor(ownVectors(node), ctx) } : {}),
  }
}

function ownVectors(node: Layer): Layer[] {
  if (node.type === 'INSTANCE') return []
  return (node.children ?? []).flatMap((child) => (child.type === 'VECTOR' ? [child] : ownVectors(child)))
}

// Column tracks: a hugging column is `auto`, a filling one its share of the rest (`1fr`); equal shares are a count.
function columnTemplate(tracks: unknown[], ctx: SlotContext) {
  const sizes = tracks.map((track) => {
    const { sizing, value } = (track ?? {}) as { sizing?: string; value?: number }
    if (sizing === 'hug') return 'auto'
    if (sizing === 'fill') return `${value || 1}fr`
    return ctx.fail(`a ${sizing ?? 'fixed'} grid column is not mapped yet; let it hug or fill`)
  })
  return sizes.every((size) => size === '1fr') ? `grid-cols-${sizes.length}` : `grid-cols-[${sizes.join('_')}]`
}

function layoutSlots(node: Layer, layout: Layout, inset: number[], ctx: SlotContext): Slots {
  const isGrid = layout.mode === 'grid'
  if (layout.mode !== 'horizontal' && layout.mode !== 'vertical' && !isGrid) {
    return { direction: ctx.fail(`${layout.mode} auto layout is not mapped yet`) }
  }
  const space = (fields: string[], value: number, prefix: string, less = 0) =>
    spaceClass(node, fields, value, prefix, less, ctx)
  const padding = paddingSlots(layout, inset, space)
  if (isGrid) return gridSlots(layout, padding, space, ctx)
  return {
    direction: layout.mode === 'vertical' ? 'flex-col' : '',
    justify:
      ({ center: 'justify-center', max: 'justify-end', spaceBetween: 'justify-between' } as Slots)[
        layout.mainAlign ?? ''
      ] ?? '',
    items: stretchesChildren(node)
      ? 'items-stretch'
      : (({ min: 'items-start', center: 'items-center', max: 'items-end', baseline: 'items-baseline' } as Slots)[
          layout.crossAlign ?? ''
        ] ?? ''),
    ...padding,
    ...gapSlots(layout, space),
  }
}

type Space = (fields: string[], value: number, prefix: string, less?: number) => string

// Sides that differ get a class each (pt-3 pb-8).
function paddingSlots(layout: Layout, inset: number[], space: Space): Slots {
  const [top = 0, right = 0, bottom = 0, left = 0] = layout.padding ?? []
  const [insetTop = 0, insetRight = 0, insetBottom = 0, insetLeft = 0] = inset
  return {
    px:
      right === left && insetRight === insetLeft
        ? space(['paddingHorizontal', 'paddingLeft'], right, 'px', insetRight)
        : joinClasses(
            space(['paddingLeft', 'paddingHorizontal'], left, 'pl', insetLeft),
            space(['paddingRight', 'paddingHorizontal'], right, 'pr', insetRight),
          ),
    py:
      top === bottom && insetTop === insetBottom
        ? space(['paddingVertical', 'paddingTop'], top, 'py', insetTop)
        : joinClasses(
            space(['paddingTop', 'paddingVertical'], top, 'pt', insetTop),
            space(['paddingBottom', 'paddingVertical'], bottom, 'pb', insetBottom),
          ),
  }
}

// A grid of equal columns, its cells stretched (the CSS default): the column count, the gaps between columns
// (gap) and rows (crossGap).
function gridSlots(layout: Layout, padding: Slots, space: Space, ctx: SlotContext): Slots {
  if (layout.rowTracks?.length) return { direction: ctx.fail('grid row tracks are not mapped yet') }
  const columns = layout.gridColumns ?? 1
  const [gap, crossGap] = [layout.gap ?? 0, layout.crossGap ?? 0]
  return {
    direction: layout.columnTracks?.length
      ? columnTemplate(layout.columnTracks, ctx)
      : columns > 1
        ? `grid-cols-${columns}`
        : '',
    ...padding,
    gap:
      gap === crossGap
        ? space(['gap'], gap, 'gap')
        : joinClasses(space(['gap'], gap, 'gap-x'), space(['crossGap'], crossGap, 'gap-y')),
  }
}

// One gap, or for a wrapping layout (`flex-wrap`) the gap along the line and the gap between lines, each bound to
// space/* (gap, crossGap).
function gapSlots(layout: Layout, space: (fields: string[], value: number, prefix: string) => string): Slots {
  if (!layout.wrap) return { gap: space(['gap'], layout.gap ?? 0, 'gap') }
  const [main, cross] = layout.mode === 'horizontal' ? ['gap-x', 'gap-y'] : ['gap-y', 'gap-x']
  return {
    wrap: 'flex-wrap',
    gap: joinClasses(space(['gap'], layout.gap ?? 0, main), space(['crossGap'], layout.crossGap ?? 0, cross)),
  }
}

// A padding or gap bound to space/* (either the axis or the side binding), less the border width.
function spaceClass(node: Layer, fields: string[], value: number, prefix: string, less: number, ctx: SlotContext) {
  const bound = node.boundVariables ?? {}
  const named = fields.map((f) => ctx.token(bound[f], 'space/')).find(Boolean)
  if (named) return less ? `${prefix}-[${value - less}px]` : `${prefix}-${named}`
  return value ? ctx.fail(`${fields[0]} ${value} is not bound to a space token`) : ''
}

function borderSlots(node: Layer, strokes: number, { token, fail }: SlotContext): Slots {
  if (strokes > 1) return { borderWidth: fail(`${strokes} stacked strokes`) }
  if (strokes === 0) return { borderWidth: '', borderStyle: '', borderColor: '' }
  const bound = node.boundVariables ?? {}
  const name = token(bound.stroke ?? bound['strokes/0/color'], 'color/')
  // A stroke drawn transparent keeps the box of a bordered variant without showing.
  const paint = (node.strokes ?? []).find((f) => f.visible !== false)
  // A paint's own opacity survives the binding (border-sale/40), as a fill's does.
  const alpha = paint?.opacity != null && paint.opacity < 1 ? `/${Math.round(paint.opacity * 100)}` : ''
  const borderColor = transparent(paint)
    ? 'border-transparent'
    : name
      ? `border-${name}${alpha}`
      : fail('stroke is not bound to a Theme colour')
  // strokeSides [top, right, bottom, left] when only some sides have the stroke.
  const sides = node.strokeSides ?? [1, 1, 1, 1]
  // A weight bound to stroke/* is its class (border-tick); 1 px is the default border.
  const named = token(bound.strokeWeight, 'stroke/')
  const width = node.strokeWeight === 1 ? '' : named ? `-${named}` : `-[${node.strokeWeight}px]`
  const borderWidth = sides.every(Boolean)
    ? `border${width}`
    : ['t', 'r', 'b', 'l']
        .filter((_, i) => sides[i])
        .map((side) => `border-${side}${width}`)
        .join(' ')
  // A CSS border sits inside the box (border-box), as an inside stroke does.
  if (node.strokeAlign && node.strokeAlign !== 'inside')
    fail(`${node.strokeAlign} stroke; CSS borders are drawn inside`)
  const borderStyle = node.dashes?.length ? 'border-dashed' : ''
  return { borderWidth, borderStyle, borderColor }
}

// Corners that differ ([top-left, top-right, bottom-right, bottom-left]) are bound one by one: rounded-t-lg, or
// rounded-tr-xs rounded-bl-sm.
function roundedClass(node: Layer, { token, fail }: SlotContext) {
  const radius = node.cornerRadius
  if (!radius) return ''
  if (Array.isArray(radius)) {
    const fields = ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius']
    const [tl, tr, br, bl] = fields.map((field, i) =>
      radius[i]
        ? (token(node.boundVariables?.[field], 'radius/') ??
          fail(`${field} ${radius[i]} is not bound to a radius token`))
        : null,
    )
    const pairs = [
      [tl, tr, 't', 'tl', 'tr'],
      [bl, br, 'b', 'bl', 'br'],
    ] as const
    return joinClasses(
      ...pairs.flatMap(([a, b, side, sideA, sideB]) =>
        a && a === b ? [`rounded-${side}-${a}`] : [a && `rounded-${sideA}-${a}`, b && `rounded-${sideB}-${b}`],
      ),
    )
  }
  const named = token(node.boundVariables?.cornerRadius, 'radius/')
  return named ? `rounded-${named}` : fail(`corner radius ${radius} is not bound to a radius token`)
}

function transparent(paint: { color?: string; opacity?: number } | undefined) {
  return paint?.opacity === 0 || /^#[0-9a-f]{6}00$/i.test(paint?.color ?? '')
}

function lineHeightPx(style: TextStyle) {
  const { lineHeight, fontSize } = style.style
  if (lineHeight.unit === 'pixels') return lineHeight.value
  if (lineHeight.unit === 'percent') return ((lineHeight.value ?? 100) / 100) * fontSize
  return undefined
}

function joinClasses(...classes: (string | null | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

function camel(name: string) {
  return name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word, i) => (i === 0 ? word.charAt(0).toLowerCase() : word.charAt(0).toUpperCase()) + word.slice(1))
    .join('')
}

export function kebab(name: string) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/** Each component has its own folder, holding the hand-written component and its generated variants file. */
function outPathFor(set: ComponentSet, root: string) {
  const [layer, slice] = set.page.split('/')
  const folder = {
    components: ['components', slice],
    entities: ['entities', slice, 'ui'],
    features: ['features', slice, 'components'],
  }[layer as 'components']
  if (!folder || !slice) throw new Error(`${set.name}: its page ${set.page} is not in the page map`)
  return join(root, ...(folder as string[]), kebab(set.name), `${kebab(set.name)}.variants.ts`)
}
