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
import { type Absolute, type ComponentSet, type Layer, type Layout, notExportedBecause } from './snapshot.ts'

export type ComponentsContext = {
  config: ComponentsConfig
  /** The token snapshot's variables, by id. */
  variables: Record<string, Variable>
  textStyles: TextStyle[]
  textStylePrefix: string
  /** Whether a text style class takes a breakpoint prefix (`md:type-x`); doubled text style selectors don't. */
  textStyleVariants: boolean
}

/** Tailwind's default breakpoints, in order. `mobile` is the base: no prefix. */
const BREAKPOINTS = ['mobile', 'sm', 'md', 'lg'] as const
const VIEWPORT = 'viewport'

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
  const variantProps = set.properties.filter((p) => p.type === 'variant' && p.name !== VIEWPORT)
  const viewportProp = set.properties.find((p) => p.type === 'variant' && p.name === VIEWPORT)
  const keys = variantProps.map((p) => p.name)
  const options = Object.fromEntries(variantProps.map((p) => [p.name, p.options ?? []]))
  const defaults = Object.fromEntries(variantProps.map((p) => [p.name, String(p.default)]))
  const problems: string[] = []
  const notes = new Set<string>()

  const viewports = viewportProp?.options ?? ['mobile']
  const unknown = viewports.filter((v) => !(BREAKPOINTS as readonly string[]).includes(v))
  if (unknown.length) problems.push(`viewport values ${unknown.join(', ')}; use ${BREAKPOINTS.join(', ')}`)
  if (!viewports.includes('mobile')) problems.push('the viewport property needs a mobile value, the base classes')

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
  const leading = Object.fromEntries(context.textStyles.map((s) => [s.id, lineHeightPx(s)]))

  const qualified = qualifiedNames(set.variants)
  const textProps = new Set(set.properties.filter((p) => p.type === 'text').map((p) => p.name))
  const ctx: SlotContext = {
    token,
    spaceByValue: byValue('space/'),
    strokeByValue: byValue('stroke/'),
    textStyleNames,
    textStylePrefix: context.textStylePrefix,
    leading,
    config: context.config,
    setName: set.name,
    note: (message) => notes.add(message),
    fail: () => '',
  }

  // Every variant -> its props, its viewport and, per part (layer name), its slots. The component itself is part "".
  const drawn = set.variants.map((variant) => {
    const all: Props = Object.fromEntries(
      keys.length || viewportProp ? variant.name.split(', ').map((pair) => pair.split('=') as [string, string]) : [],
    )
    const { [VIEWPORT]: viewport = 'mobile', ...props } = all
    const parts: Record<string, Slots> = {}
    const where = variant.name || set.name
    const walk = (node: Layer, parentLayout: string | undefined, isRoot: boolean, parentName: string) => {
      // A name used under several parents is qualified by its parent: `actionLabel`; one directly under the
      // component keeps its own name.
      const part = isRoot ? '' : camel(qualified.has(node.name) ? `${parentName} ${node.name}` : node.name)
      const own = layerSlots(node, parentLayout, {
        ...ctx,
        fail: (message) => {
          problems.push(node.name === where ? `${where}: ${message}` : `${where} › ${node.name}: ${message}`)
          return ''
        },
      })
      // Layers repeated under one name share a part when they look the same. Which component an instance
      // shows is a prop, so it doesn't count here.
      const looks = ({ component: _, ...rest }: Slots) => JSON.stringify(rest)
      const seen = parts[part]
      if (seen && looks(seen) !== looks(own)) {
        problems.push(`${where}: layers named "${node.name}" look different; give each its own name`)
      }
      parts[part] = own
      if (node.type === 'INSTANCE') return
      for (const child of styledChildren(set.name, node, textProps, context.config)) {
        walk(child, node.layout?.mode, false, isRoot ? '' : node.name)
      }
    }
    walk(variant, undefined, true, '')
    return { props, viewport, parts }
  })

  // One entry per combination of the cva props; the viewports drawn for it become prefixed classes.
  const comboKey = (props: Props) => keys.map((k) => props[k]).join('|')
  const combos = new Map<string, { props: Props; byViewport: Map<string, Record<string, Slots>> }>()
  for (const v of drawn) {
    const key = comboKey(v.props)
    const combo = combos.get(key) ?? { props: v.props, byViewport: new Map() }
    combo.byViewport.set(v.viewport, v.parts)
    combos.set(key, combo)
  }
  const order = (props: Props) => keys.map((k) => (options[k] ?? []).indexOf(props[k] ?? ''))
  const variants = [...combos.values()].sort((a, b) => {
    const [x, y] = [order(a.props), order(b.props)]
    return x.reduce((d, n, i) => d || n - (y[i] ?? 0), 0)
  })
  for (const combo of variants) {
    if (!combo.byViewport.has('mobile')) problems.push(`${describeProps(combo.props)} has no viewport=mobile variant`)
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
      const values = variants.map((combo) => ({
        props: combo.props,
        cls: responsive(
          BREAKPOINTS.flatMap((viewport) => {
            const parts = combo.byViewport.get(viewport)
            return parts ? [[viewport, at(parts)] as const] : []
          }),
          slot,
          context.textStyleVariants,
          (message) => problems.push(`${set.name} › ${part || set.name}, ${describeProps(combo.props)}: ${message}`),
        ),
      }))
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

/**
 * One slot across the viewports drawn for a variant, smallest first -> the mobile classes, then for each larger
 * viewport only the classes that differ from the next one down, under its prefix.
 */
function responsive(
  values: (readonly [string, string])[],
  slot: string,
  textStyleVariants: boolean,
  fail: (message: string) => void,
) {
  const [first, ...later] = values
  if (!first) return ''
  const out = split(first[1])
  let previous = first[1]
  for (const [viewport, cls] of later) {
    if (cls === previous) continue
    if (slot === 'type' && !textStyleVariants) {
      fail(
        `the text style changes at ${viewport}, but the text style classes are doubled selectors, which take no breakpoint prefix`,
      )
    }
    const before = new Set(split(previous))
    const added = split(cls).filter((c) => !before.has(c))
    if (added.length === 0) {
      const reset = RESETS[slot]
      if (reset === undefined || cls !== '') {
        fail(`${slot} changes from "${previous}" to "${cls}" at ${viewport}; no class undoes that`)
      } else if (reset) out.push(`${viewport}:${reset}`)
    }
    out.push(...added.map((c) => `${viewport}:${c}`))
    previous = cls
  }
  return out.join(' ')
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
  textStylePrefix: string
  /** Each text style's line height in px, by style id. */
  leading: Record<string, number | undefined>
  config: ComponentsConfig
  setName: string
  note: (message: string) => void
  fail: (message: string) => string
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
  const s: Slots = { display: node.visible === false ? 'hidden' : node.layout ? 'flex' : '' }
  if (node.opacity != null && node.opacity < 1) s.opacity = ctx.fail(`opacity ${node.opacity}`)
  if ((node.effects ?? []).some((e) => e.visible !== false))
    s.effects = ctx.fail('effects (shadows, blurs) are not mapped')
  s.width = sizeClass(node, 'horizontal', parentLayout, ctx)
  s.height = sizeClass(node, 'vertical', parentLayout, ctx)
  s.minWidth = minSizeClass(node, 'minWidth', 'min-w', ctx)
  s.minHeight = minSizeClass(node, 'minHeight', 'min-h', ctx)
  s.rotate = rotateClass(node, ctx.fail)
  // On the web an absolute layer is placed against its nearest positioned ancestor, so its parent is `relative`.
  s.position = node.absolute
    ? absoluteClass(node.absolute, ctx)
    : (node.children ?? []).some((child) => child.absolute)
      ? 'relative'
      : ''
  if (node.type === 'TEXT') return { ...s, ...textSlots(node, ctx) }
  // A nested instance is a child component (an Icon, say): only its box is styled here, through className.
  if (node.type === 'INSTANCE') return { ...s, ...instanceSlots(node, ctx) }
  if (!['COMPONENT', 'FRAME', 'RECTANGLE'].includes(node.type)) {
    ctx.fail(`${node.type} layers are not mapped yet; extend packages/design/src/components/build.ts`)
    return s
  }
  return { ...s, ...frameSlots(node, ctx) }
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

function sizeClass(node: Layer, axis: 'horizontal' | 'vertical', parentLayout: string | undefined, ctx: SlotContext) {
  const sizing = node.sizing?.[axis]
  if (sizing === 'fill') {
    if (!parentLayout) return ctx.fail(`fill ${axis} on the component itself; width is the caller's layout`)
    // Along the axis the parent stacks its children, or across it.
    return parentLayout === axis ? 'flex-1' : 'self-stretch'
  }
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

// A minimum size bound to space/* keeps a layer at least a token's size while it hugs content that grows with the
// text. A nested instance keeps its component's own minimum; an unbound minimum is left out with a note.
function minSizeClass(node: Layer, field: 'minWidth' | 'minHeight', prefix: string, ctx: SlotContext) {
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
  }
}

function instanceSlots(node: Layer, ctx: SlotContext): Slots {
  const { token, fail, spaceByValue } = ctx
  // Which variant of its set it shows is the child's own prop, passed in code; only another set is a swap.
  const s: Slots = { component: node.mainSet ?? node.mainComponentName ?? '' }
  // Its box (size, position) is styled here and the instance-swap prop picks the component; any other override
  // (colours, text, nested props) changes the child's look, which is not mapped yet.
  const visual = (node.overrides ?? []).filter(
    (group) => !['size', 'position', 'name', 'component', 'visible', 'props'].includes(group),
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
  // colour of an icon inside it follows the child's own variant.
  const iconGlyphs = new Set(inside.filter((child) => child.mainSet === 'Icon').flatMap(descendants))
  const changed = inside.filter((child) =>
    (child.overrides ?? []).some(
      (group) =>
        !['name', 'characters', 'component', 'visible', 'props'].includes(group) &&
        !(iconGlyphs.has(child) && ['fills', 'strokes'].includes(group)),
    ),
  )
  if (changed.length) {
    fail(
      `${changed.map((child) => child.name).join(', ')} overridden inside ${node.mainSet ?? 'a nested instance'}; not mapped yet`,
    )
  }
  return s
}

function descendants(node: Layer): Layer[] {
  return (node.children ?? []).flatMap((child) => [child, ...descendants(child)])
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
    overflow: node.clip ? 'overflow-hidden' : '',
  }
}

function layoutSlots(node: Layer, layout: Layout, inset: number[], ctx: SlotContext): Slots {
  if (layout.mode !== 'horizontal' && layout.mode !== 'vertical') {
    return { direction: ctx.fail(`${layout.mode} auto layout is not mapped yet`) }
  }
  const space = (fields: string[], value: number, prefix: string, less = 0) =>
    spaceClass(node, fields, value, prefix, less, ctx)
  const [top = 0, right = 0, bottom = 0, left = 0] = layout.padding ?? []
  const [insetTop = 0, insetRight = 0, insetBottom = 0, insetLeft = 0] = inset
  // Sides that differ get a class each (pt-3 pb-8).
  return {
    direction: layout.mode === 'vertical' ? 'flex-col' : '',
    justify:
      ({ center: 'justify-center', max: 'justify-end', spaceBetween: 'justify-between' } as Slots)[
        layout.mainAlign ?? ''
      ] ?? '',
    items:
      ({ min: 'items-start', center: 'items-center', max: 'items-end', baseline: 'items-baseline' } as Slots)[
        layout.crossAlign ?? ''
      ] ?? '',
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
    ...gapSlots(layout, space),
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
  const borderColor = name ? `border-${name}` : fail('stroke is not bound to a Theme colour')
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
