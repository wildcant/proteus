import { describe, expect, it } from 'vitest'

import { buildComponents, type ComponentsContext } from '../components/build.ts'
import { type ComponentSet, exportCandidates, type Layer } from '../components/snapshot.ts'
import { componentsConfig, fill, frame, text, tokenSnapshot } from './fixtures.ts'

const context: ComponentsContext = {
  config: componentsConfig,
  variables: tokenSnapshot.variables,
  textStyles: tokenSnapshot.textStyles,
  textStylePrefix: 'type-',
}

const variantProperty = (name: string, options: string[]) => ({
  name,
  type: 'variant',
  default: options[0],
  options,
})

function buttonVariant(variant: 'primary' | 'secondary'): Layer {
  const secondary = variant === 'secondary'
  return {
    ...frame(`variant=${variant}`, 'horizontal'),
    type: 'COMPONENT',
    fills: [{ type: 'solid', color: '#000000' }],
    ...(secondary ? { strokes: [{ type: 'solid', color: '#dee0e3' }], strokeWeight: 1, strokeAlign: 'inside' } : {}),
    cornerRadius: 9999,
    boundVariables: {
      fill: secondary ? 'c:surface' : 'c:accent',
      ...(secondary ? { stroke: 'c:line' } : {}),
      cornerRadius: 'r:full',
      paddingHorizontal: 's:4',
      paddingVertical: 's:2',
      gap: 's:2',
    },
    layout: { mode: 'horizontal', crossAlign: 'center', gap: 8, padding: [8, 16, 8, 16], strokesIncluded: true },
    children: [
      {
        name: 'icon',
        type: 'INSTANCE',
        mainSet: 'Icon',
        visible: secondary,
        sizing: { horizontal: 'fixed', vertical: 'fixed' },
        width: 24,
        height: 24,
        children: [{ name: 'glyph', type: 'VECTOR', boundVariables: { stroke: 'c:ink' } }],
      },
      text('label', 'heading', secondary ? 'c:ink' : 'c:surface'),
    ],
  }
}

const button: ComponentSet = {
  name: 'Button',
  page: 'components/ui',
  properties: [variantProperty('variant', ['primary', 'secondary']), { name: 'label', type: 'text', default: 'Add' }],
  variants: [buttonVariant('primary'), buttonVariant('secondary')],
}

// A slot holds the caller's content; only the slot frame, and default text named after a text property, is styled.
const productCard: ComponentSet = {
  name: 'ProductCard',
  page: 'entities/product',
  properties: [{ name: 'title', type: 'text', default: 'Name' }],
  variants: [
    {
      ...frame('ProductCard', 'vertical'),
      type: 'COMPONENT',
      layout: { mode: 'vertical', gap: 8, padding: [0, 0, 0, 0] },
      boundVariables: { gap: 's:2' },
      children: [
        {
          ...frame('body', 'vertical'),
          slot: true,
          layout: { mode: 'vertical', gap: 0, padding: [16, 16, 16, 16] },
          boundVariables: { paddingHorizontal: 's:4', paddingVertical: 's:4' },
          children: [
            text('title', 'body', 'c:ink'),
            { name: 'placeholder', type: 'RECTANGLE', fills: [{ type: 'solid', color: '#ff0000' }] },
          ],
        },
      ],
    },
  ],
}

const single = (name: string, page: string, extra: Partial<ComponentSet> = {}): ComponentSet => ({
  name,
  page,
  properties: [],
  variants: [{ ...frame(name, 'vertical'), type: 'COMPONENT', ...fill('c:surface') }],
  ...extra,
})

const VIEWPORTS = ['mobile', 'md', 'lg'] as const

function heroVariant(tone: 'plain' | 'accent', viewport: (typeof VIEWPORTS)[number]): Layer {
  const space = { mobile: ['s:2', 8, 's:4', 16], md: ['s:4', 16, 's:4', 16], lg: ['s:6', 24, 's:6', 24] } as const
  const [gapId, gap, paddingId, padding] = space[viewport]
  // The bottom padding grows from md; the top stays, so md repeats only the bottom.
  const [bottomId, bottom] = viewport === 'mobile' ? ['s:4', 16] : ['s:6', 24]
  return {
    name: `tone=${tone}, viewport=${viewport}`,
    type: 'COMPONENT',
    fills: [{ type: 'solid', color: '#000000' }],
    boundVariables: {
      fill: tone === 'plain' ? 'c:surface' : 'c:accent',
      gap: gapId,
      paddingHorizontal: paddingId,
      paddingTop: 's:2',
      paddingBottom: bottomId,
    },
    layout: { mode: viewport === 'mobile' ? 'vertical' : 'horizontal', gap, padding: [8, padding, bottom, padding] },
    children: [text('title', 'heading', 'c:ink'), ...(viewport === 'lg' ? [frame('aside', 'vertical')] : [])],
  }
}

const hero: ComponentSet = {
  name: 'Hero',
  page: 'components/store',
  properties: [variantProperty('tone', ['plain', 'accent']), variantProperty('viewport', [...VIEWPORTS])],
  variants: (['plain', 'accent'] as const).flatMap((tone) => VIEWPORTS.map((viewport) => heroVariant(tone, viewport))),
}

describe('components', () => {
  it('turns each layer of a set into a cva, its variant properties into variants, in the folder its page maps to', () => {
    const { files } = buildComponents(
      [
        button,
        productCard,
        single('CartLine', 'features/cart'),
        // Never exported: a design-only set on the not-exported list, and screen sets by page and by description.
        single('Icon', 'components/ui'),
        single('Home', 'app/home'),
        single('CartScreen', 'features/cart', { description: 'Screen set: the cart route.' }),
      ],
      context,
    )

    expect([...files.keys()].sort()).toEqual([
      '/shop/src/components/ui/button/button.variants.ts',
      '/shop/src/entities/product/ui/product-card/product-card.variants.ts',
      '/shop/src/features/cart/components/cart-line/cart-line.variants.ts',
    ])

    // The component itself, then one cva per layer; a hidden layer is `hidden` in that variant, a nested
    // icon keeps a token size and draws in one Theme colour.
    expect(files.get('/shop/src/components/ui/button/button.variants.ts')).toBe(
      [
        '// Generated by @proteus/design from the FigCraft component set "Button". Do not edit: change the design file, then run its components:export.',
        "import { cva } from 'class-variance-authority'",
        '',
        "export const button = cva('flex items-center px-4 py-2 gap-2 rounded-full', {",
        '  variants: {',
        '    variant: {',
        "      primary: 'bg-accent',",
        "      secondary: 'bg-surface border border-line',",
        '    },',
        '  },',
        "  defaultVariants: { variant: 'primary' },",
        '})',
        '',
        "export const buttonIcon = cva('w-6 h-6 text-ink', {",
        '  variants: {',
        '    variant: {',
        "      primary: 'hidden',",
        "      secondary: '',",
        '    },',
        '  },',
        "  defaultVariants: { variant: 'primary' },",
        '})',
        '',
        "export const buttonLabel = cva('type-heading', {",
        '  variants: {',
        '    variant: {',
        "      primary: 'text-surface',",
        "      secondary: 'text-ink',",
        '    },',
        '  },',
        "  defaultVariants: { variant: 'primary' },",
        '})',
        '',
      ].join('\n'),
    )

    // The slot frame and its default text are styled; the caller's content in it (an unbound fill that
    // would otherwise stop the build) is not.
    const card = files.get('/shop/src/entities/product/ui/product-card/product-card.variants.ts')
    expect(card).toContain("export const productCard = cva('flex flex-col gap-2')")
    expect(card).toContain("export const productCardBody = cva('flex flex-col px-4 py-4')")
    expect(card).toContain("export const productCardTitle = cva('type-body text-ink')")
    expect(card).not.toContain('placeholder')
  })

  it('makes the design-only viewport property responsive classes: mobile as the base, each breakpoint only what changes', () => {
    const { files } = buildComponents([hero], context)
    const source = files.get('/shop/src/components/store/hero/hero.variants.ts')

    // md turns the stack into a row, widens the gap and the bottom padding; lg widens the gap and the side
    // padding. Nothing lg shares with md is repeated, and what md shares with mobile gets no md: class.
    expect(source).toContain(
      "export const hero = cva('flex flex-col md:flex-row px-4 lg:px-6 pt-2 pb-4 md:pb-6 gap-2 md:gap-4 lg:gap-6', {\n  variants: {\n    tone: {\n      plain: 'bg-surface',\n      accent: 'bg-accent',\n    },\n  },\n  defaultVariants: { tone: 'plain' },\n})",
    )
    // A layer drawn only from lg up is hidden below it.
    expect(source).toContain("export const heroAside = cva('hidden lg:flex lg:flex-col')")
    expect(source).toContain("export const heroTitle = cva('type-heading text-ink')")
    expect(source).not.toContain('viewport')
  })

  it('stops on a value that is not a token, naming the layer', () => {
    const badge = single('Badge', 'components/ui', {
      variants: [
        {
          ...frame('Badge', 'horizontal'),
          type: 'COMPONENT',
          children: [{ name: 'dot', type: 'FRAME', fills: [{ type: 'solid', color: '#ff0000' }] }],
        },
      ],
    })
    expect(() => buildComponents([badge], context)).toThrow('Badge › dot: fill #ff0000 is not bound to a Theme colour')
  })

  it('exports a component outside any set, which FigCraft also lists with a folder', () => {
    const pages = new Map([['1', 'components/ui']])
    const candidates = exportCandidates(
      [
        {
          id: '10',
          name: 'variant=primary',
          type: 'COMPONENT',
          page: 1,
          folder: ['components/ui', 'Button', 'Button'],
        },
        { id: '11', name: 'Button', type: 'COMPONENT_SET', page: 1, folder: ['components/ui', 'Button'] },
        { id: '12', name: 'Label', type: 'COMPONENT', page: 1, folder: ['components/ui', 'Label'] },
      ],
      pages,
    )
    expect(candidates.map((c) => [c.name, c.page])).toEqual([
      ['Button', 'components/ui'],
      ['Label', 'components/ui'],
    ])
  })

  it('leaves out example children, stretches children that all fill the cross axis, and makes a listed set inline', () => {
    const exampleInput = { ...frame('exampleInput', 'vertical'), sizing: { horizontal: 'fill' as const } }
    const fieldSet = single('Field', 'components/ui', {
      variants: [
        {
          ...frame('Field', 'vertical'),
          type: 'COMPONENT',
          layout: { mode: 'vertical', crossAlign: 'min', gap: 8, padding: [0, 0, 0, 0] },
          boundVariables: { gap: 's:2' },
          children: [exampleInput, text('hint', 'body', 'c:ink', { sizing: { horizontal: 'fill' } })],
        },
      ],
    })
    const chip = single('Chip', 'components/ui', {
      variants: [
        {
          ...frame('Chip', 'horizontal'),
          type: 'COMPONENT',
          layout: { mode: 'horizontal', crossAlign: 'min', gap: 0, padding: [0, 0, 0, 0] },
          children: [text('label', 'body', 'c:ink')],
        },
      ],
    })
    const { files } = buildComponents([fieldSet, chip], {
      ...context,
      config: { ...componentsConfig, notStyledLayers: { 'Field › exampleInput': 'example content' }, inline: ['Chip'] },
    })
    const field = files.get('/shop/src/components/ui/field/field.variants.ts')
    // Every child fills across the stack, the caller's example included: the children stretch, so none says so.
    expect(field).toContain("export const field = cva('flex flex-col items-stretch gap-2')")
    expect(field).toContain("export const fieldHint = cva('type-body text-ink')")
    expect(field).not.toContain('exampleInput')
    // A hugging child keeps the cross alignment drawn.
    expect(files.get('/shop/src/components/ui/chip/chip.variants.ts')).toContain(
      "export const chip = cva('inline-flex items-start')",
    )
  })

  it('makes the design-only interaction property state classes: rest as the base, each state only what differs', () => {
    const states = ['rest', 'hover', 'disabled'] as const
    const variant = (tone: 'solid' | 'quiet', state: (typeof states)[number], viewport: 'mobile' | 'md'): Layer => ({
      ...frame(`tone=${tone}, interaction=${state}, viewport=${viewport}`, 'horizontal'),
      type: 'COMPONENT',
      ...(state === 'disabled' ? { opacity: 0.5 } : {}),
      fills: [{ type: 'solid', color: '#000000', ...(state === 'hover' && tone === 'solid' ? { opacity: 0.8 } : {}) }],
      // A stroke drawn transparent keeps every variant the box of a bordered one.
      strokes: [{ type: 'solid', color: '#00000000' }],
      strokeWeight: 1,
      strokeAlign: 'inside',
      boundVariables: {
        fill: tone === 'solid' ? 'c:accent' : 'c:surface',
        paddingHorizontal: viewport === 'md' ? 's:6' : 's:4',
      },
      layout: {
        mode: 'horizontal',
        gap: 0,
        padding: [0, viewport === 'md' ? 24 : 16, 0, viewport === 'md' ? 24 : 16],
        strokesIncluded: true,
      },
      children: [
        text('label', 'body', state === 'hover' && viewport === 'md' ? 'c:accent' : 'c:ink'),
        // A glyph in a slot draws in currentColor: its colour is the slot's text colour.
        {
          ...frame('icon', 'horizontal'),
          slot: true,
          children: [
            {
              name: 'glyph',
              type: 'VECTOR',
              strokes: [{ type: 'solid', color: '#fff' }],
              boundVariables: { stroke: 'c:surface' },
            },
          ],
        },
      ],
    })
    const pill: ComponentSet = {
      name: 'Pill',
      page: 'components/ui',
      properties: [
        variantProperty('tone', ['solid', 'quiet']),
        variantProperty('interaction', [...states]),
        variantProperty('viewport', ['mobile', 'md']),
      ],
      variants: (['solid', 'quiet'] as const).flatMap((tone) =>
        states.flatMap((state) =>
          // Hover is drawn at md too, where the label turns accent; disabled only at mobile.
          (state === 'disabled' ? (['mobile'] as const) : (['mobile', 'md'] as const)).map((vp) =>
            variant(tone, state, vp),
          ),
        ),
      ),
    }
    const { files } = buildComponents([pill], {
      ...context,
      config: { ...componentsConfig, interactionPrefixes: { Pill: { disabled: 'data-disabled' } } },
    })
    const source = files.get('/shop/src/components/ui/pill/pill.variants.ts')
    expect(source).not.toContain('interaction')
    expect(source).toContain(
      "export const pill = cva('group/pill flex px-4 md:px-6 border border-transparent data-disabled:opacity-50', {\n  variants: {\n    tone: {\n      solid: 'bg-accent hover:bg-accent/80',\n      quiet: 'bg-surface',\n    },\n  },",
    )
    // A part follows its component's state through the named group; breakpoint and state prefixes compose.
    expect(source).toContain("export const pillLabel = cva('type-body text-ink md:group-hover/pill:text-accent')")
    expect(source).toContain("export const pillIcon = cva('flex text-surface')")
  })

  it('lets the text style change at a breakpoint', () => {
    const tag = single('Tag', 'components/ui', {
      properties: [variantProperty('viewport', ['mobile', 'md'])],
      variants: (['mobile', 'md'] as const).map((viewport) => ({
        ...frame(`viewport=${viewport}`, 'horizontal'),
        type: 'COMPONENT',
        children: [text('label', viewport === 'md' ? 'heading' : 'body', 'c:ink')],
      })),
    })
    const { files } = buildComponents([tag], context)
    expect(files.get('/shop/src/components/ui/tag/tag.variants.ts')).toContain(
      "export const tagLabel = cva('type-body md:type-heading text-ink')",
    )
  })
})
