import { describe, expect, it } from 'vitest'

import { buildComponents, type ComponentsContext } from '../components/build.ts'
import type { ComponentSet, Layer } from '../components/snapshot.ts'
import { componentsConfig, fill, frame, text, tokenSnapshot } from './fixtures.ts'

const context: ComponentsContext = {
  config: componentsConfig,
  variables: tokenSnapshot.variables,
  textStyles: tokenSnapshot.textStyles,
  textStylePrefix: 'type-',
  textStyleVariants: true,
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
})
