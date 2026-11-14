import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildComponents, type ComponentsContext } from '../components/build.ts'
import {
  type ComponentSet,
  chooseExports,
  exportCandidates,
  type Layer,
  setOfComponents,
} from '../components/snapshot.ts'
import { formatTs } from '../files.ts'
import { componentsConfig, fill, frame, text, tokenSnapshot } from './fixtures.ts'

const context: ComponentsContext = {
  config: componentsConfig,
  variables: tokenSnapshot.variables,
  textStyles: tokenSnapshot.textStyles,
  effectStyles: tokenSnapshot.effectStyles,
  textStylePrefix: 'type-',
  responsiveSizes: new Set(['layout-header']),
}

const repo = join(import.meta.dirname, '../../../..')

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

  it('undoes a fill at a larger breakpoint with the CSS default, and leaves a layer only a boolean shows to code', () => {
    const bannerVariant = (viewport: 'mobile' | 'sm'): Layer => ({
      ...frame(`viewport=${viewport}`, 'horizontal'),
      type: 'COMPONENT',
      children: [
        text('message', 'body', 'c:ink', { sizing: { horizontal: viewport === 'mobile' ? 'fill' : 'hug' } }),
        text('note', 'body', 'c:ink', { visible: false }),
      ],
    })
    const banner: ComponentSet = {
      name: 'Banner',
      page: 'components/store',
      properties: [variantProperty('viewport', ['mobile', 'sm']), { name: 'hasNote', type: 'boolean', default: false }],
      variants: [bannerVariant('mobile'), bannerVariant('sm')],
    }
    const source = buildComponents([banner], context).files.get('/shop/src/components/store/banner/banner.variants.ts')

    expect(source).toContain("export const bannerMessage = cva('flex-1 sm:flex-initial type-body text-ink')")
    expect(source).toContain("export const bannerNote = cva('type-body text-ink')")
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

  it('tells a component from the screen set named after it, by page: only the component is exported', () => {
    const pages = new Map([
      ['1', 'features/auth'],
      ['2', 'features/account'],
      ['3', 'app/_auth'],
      ['4', 'app/_main/_authed'],
    ])
    const list = [
      // A component outside any set, and a screen set of the same name on the route's page.
      { id: '10', name: 'LoginForm', type: 'COMPONENT', page: 1, folder: ['features/auth', 'LoginForm'] },
      { id: '11', name: 'LoginForm', type: 'COMPONENT_SET', page: 3, folder: ['app/_auth', 'LoginForm'] },
      { id: '12', name: 'state=default', type: 'COMPONENT', page: 3, folder: ['app/_auth', 'LoginForm', 'LoginForm'] },
      // A component set, and a screen set of the same name.
      {
        id: '20',
        name: 'AccountDetail',
        type: 'COMPONENT_SET',
        page: 2,
        folder: ['features/account', 'AccountDetail'],
      },
      {
        id: '21',
        name: 'viewport=mobile',
        type: 'COMPONENT',
        page: 2,
        folder: ['features/account', 'AccountDetail', 'AccountDetail'],
      },
      {
        id: '22',
        name: 'AccountDetail',
        type: 'COMPONENT_SET',
        page: 4,
        folder: ['app/_main/_authed', 'AccountDetail'],
      },
      {
        id: '23',
        name: 'state=orders',
        type: 'COMPONENT',
        page: 4,
        folder: ['app/_main/_authed', 'AccountDetail', 'AccountDetail'],
      },
    ]
    const candidates = exportCandidates(list, pages)
    const chosen = (names: string[]) => chooseExports(candidates, names, componentsConfig).map((c) => [c.name, c.page])

    expect(chosen([])).toEqual([
      ['LoginForm', 'features/auth'],
      ['AccountDetail', 'features/account'],
    ])
    expect(chosen(['LoginForm', 'AccountDetail'])).toEqual([
      ['LoginForm', 'features/auth'],
      ['AccountDetail', 'features/account'],
    ])
    expect(() => chosen(['Missing'])).toThrow('expected one component or component set named "Missing", found 0')
    // An instance's set is the one on its main component's page.
    expect(Object.fromEntries(setOfComponents(list))).toEqual({
      '12': 'LoginForm',
      '21': 'AccountDetail',
      '23': 'AccountDetail',
    })
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

  it('maps a ring drawn as a spread shadow, an effect style and a background blur; any other shadow stops the build', () => {
    const ring = { type: 'dropShadow', color: { r: 0, g: 0, b: 0, a: 0.5 }, offset: [0, 0], radius: 0, spread: 3 }
    const variant = (state: 'rest' | 'focus-visible'): Layer => ({
      ...frame(`interaction=${state}`, 'horizontal'),
      type: 'COMPONENT',
      ...fill('c:surface'),
      // The ring shows only in focus-visible; at rest it is drawn hidden.
      effects: [{ ...ring, visible: state === 'focus-visible' }],
      boundVariables: { fill: 'c:surface', 'effects/0/color': 'c:ring' },
      children: [
        // A layer with a shadow/* effect style takes its class, whatever its shadows are.
        { ...frame('panel', 'vertical'), effectStyle: 'S:lg', effects: [{ type: 'dropShadow', offset: [0, 10] }] },
        { ...frame('scrim', 'vertical'), effects: [{ type: 'backgroundBlur', radius: 4 }] },
      ],
    })
    const chip: ComponentSet = {
      name: 'Chip',
      page: 'components/ui',
      properties: [variantProperty('interaction', ['rest', 'focus-visible'])],
      variants: [variant('rest'), variant('focus-visible')],
    }
    const source = buildComponents([chip], context).files.get('/shop/src/components/ui/chip/chip.variants.ts')
    expect(source).toContain(
      "export const chip = cva('flex bg-surface focus-visible:ring-3 focus-visible:ring-focus-ring')",
    )
    expect(source).toContain("export const chipPanel = cva('flex flex-col shadow-lg')")
    expect(source).toContain("export const chipScrim = cva('flex flex-col backdrop-blur-xs')")

    const raw = single('Card', 'components/ui', {
      variants: [
        {
          ...frame('Card', 'vertical'),
          type: 'COMPONENT',
          effects: [{ type: 'dropShadow', offset: [0, 4], radius: 6 }],
        },
      ],
    })
    expect(() => buildComponents([raw], context)).toThrow('Card: a shadow is an effect style (shadow/*)')
  })

  it('leaves a runtime position to code, maps a max width and a vertical scroll, and reverses a stack drawn reversed', () => {
    const tip = single('Tip', 'components/ui', {
      variants: [
        {
          ...frame('Tip', 'horizontal'),
          type: 'COMPONENT',
          maxWidth: 224,
          boundVariables: { maxWidth: 's:56' },
          children: [
            {
              ...frame('arrow', 'horizontal'),
              absolute: { horizontal: 'left', vertical: 'bottom', left: 112, top: 30, right: 102, bottom: -2 },
            },
            { ...frame('body', 'vertical'), clip: true, overflow: 'vertical' },
          ],
        },
      ],
    })
    // DOM order is the largest viewport's; mobile draws the same children the other way up.
    const footer = (viewport: 'mobile' | 'md'): Layer => ({
      ...frame(`viewport=${viewport}`, viewport === 'mobile' ? 'vertical' : 'horizontal'),
      type: 'COMPONENT',
      children:
        viewport === 'mobile'
          ? [frame('action', 'horizontal'), frame('cancel', 'horizontal')]
          : [frame('cancel', 'horizontal'), frame('action', 'horizontal')],
    })
    const bar: ComponentSet = {
      name: 'Bar',
      page: 'components/ui',
      properties: [variantProperty('viewport', ['mobile', 'md'])],
      variants: [footer('mobile'), footer('md')],
    }
    const { files } = buildComponents([tip, bar], {
      ...context,
      config: { ...componentsConfig, runtimePositions: ['Tip › arrow'] },
    })
    const source = files.get('/shop/src/components/ui/tip/tip.variants.ts')
    expect(source).toContain("export const tip = cva('flex max-w-56 relative')")
    expect(source).toContain("export const tipArrow = cva('flex absolute')")
    expect(source).toContain("export const tipBody = cva('flex flex-col overflow-y-auto')")
    expect(files.get('/shop/src/components/ui/bar/bar.variants.ts')).toContain(
      "export const bar = cva('flex flex-col-reverse md:flex-row')",
    )
  })

  it('leaves the parent of a layer Base UI places against its positioner unpositioned', () => {
    const pop = single('Pop', 'components/ui', {
      variants: [
        {
          ...frame('Pop', 'vertical'),
          type: 'COMPONENT',
          children: [
            {
              ...frame('arrow', 'horizontal'),
              absolute: { horizontal: 'left', vertical: 'top', left: 8, top: -15, right: 8, bottom: 0 },
            },
          ],
        },
      ],
    })
    const { files } = buildComponents([pop], {
      ...context,
      config: { ...componentsConfig, positionerAnchored: ['Pop › arrow'] },
    })
    const source = files.get('/shop/src/components/ui/pop/pop.variants.ts')
    expect(source).toContain("export const pop = cva('flex flex-col')")
    expect(source).toContain("export const popArrow = cva('flex absolute')")
  })

  it("styles the caller's own markup put in a nested instance's slot, but not a glyph put there", () => {
    const set = single('Details', 'features/account', {
      variants: [
        {
          ...frame('Details', 'vertical'),
          type: 'COMPONENT',
          children: [
            {
              name: 'panel',
              type: 'INSTANCE',
              mainSet: 'Panel',
              children: [
                {
                  ...frame('body', 'vertical'),
                  slot: true,
                  overrides: ['slot'],
                  children: [
                    { ...frame('list', 'vertical'), children: [text('term', 'body', 'c:ink')] },
                    // An instance the caller resized in its own markup is its box, not a change to the Panel.
                    { name: 'mark', type: 'INSTANCE', mainSet: 'Skeleton', overrides: ['size'] },
                  ],
                },
                {
                  ...frame('icon', 'horizontal'),
                  slot: true,
                  overrides: ['slot'],
                  children: [{ name: 'glyph', type: 'VECTOR', boundVariables: { stroke: 'c:ink' } }],
                },
              ],
            },
          ],
        },
      ],
    })
    const source = buildComponents([set], context).files.get(
      '/shop/src/features/account/components/details/details.variants.ts',
    )
    expect(source).toContain("export const detailsList = cva('flex flex-col')")
    expect(source).toContain('export const detailsTerm = cva(')
    expect(source).not.toContain('detailsGlyph')
  })

  it('maps grid column tracks that hug or share the rest to an arbitrary template', () => {
    const terms = single('Terms', 'components/ui', {
      variants: [
        {
          ...frame('Terms', 'vertical'),
          type: 'COMPONENT',
          layout: {
            mode: 'grid',
            gap: 24,
            crossGap: 8,
            padding: [0, 0, 0, 0],
            gridColumns: 2,
            columnTracks: [
              { sizing: 'hug', value: 0 },
              { sizing: 'fill', value: 1 },
            ],
            rowTracks: [],
          },
          boundVariables: { gap: 's:6', crossGap: 's:2' },
        },
      ],
    })
    const source = buildComponents([terms], context).files.get('/shop/src/components/ui/terms/terms.variants.ts')
    expect(source).toContain("export const terms = cva('grid grid-cols-[auto_1fr] gap-x-6 gap-y-2')")
  })

  it('spans a grid child across the columns its cell covers', () => {
    const page = (viewport: 'mobile' | 'lg'): Layer => ({
      ...frame(`viewport=${viewport}`, 'vertical'),
      type: 'COMPONENT',
      layout: { mode: 'grid', gap: 0, crossGap: 0, padding: [0, 0, 0, 0], gridColumns: viewport === 'lg' ? 3 : 1 },
      children: [
        { ...frame('main', 'vertical'), gridCell: { columnSpan: viewport === 'lg' ? 2 : 1 } },
        { ...frame('aside', 'vertical'), gridCell: { columnSpan: 1 } },
      ],
    })
    const set: ComponentSet = {
      name: 'Board',
      page: 'components/ui',
      properties: [variantProperty('viewport', ['mobile', 'lg'])],
      variants: [page('mobile'), page('lg')],
    }
    const source = buildComponents([set], context).files.get('/shop/src/components/ui/board/board.variants.ts')
    expect(source).toMatch(/export const boardMain = cva\('[^']*\blg:col-span-2\b/)
    expect(source).toContain("export const boardAside = cva('flex flex-col')")
  })

  it('maps an inner ring drawn as a spread inner shadow to ring-inset', () => {
    const ring = { type: 'innerShadow', color: { r: 0, g: 0, b: 0, a: 1 }, offset: [0, 0], radius: 0, spread: 1 }
    const row = (state: 'default' | 'selected'): Layer => ({
      ...frame(`state=${state}`, 'horizontal'),
      type: 'COMPONENT',
      effects: [{ ...ring, visible: state === 'selected' }],
      boundVariables: { 'effects/0/color': 'c:ink' },
    })
    const set: ComponentSet = {
      name: 'Row',
      page: 'components/ui',
      properties: [variantProperty('state', ['default', 'selected'])],
      variants: [row('default'), row('selected')],
    }
    const source = buildComponents([set], context).files.get('/shop/src/components/ui/row/row.variants.ts')
    expect(source).toContain("selected: 'ring-1 ring-ink ring-inset'")
  })

  it('maps a position property to first:/last: and a part that owns its states to its own variants', () => {
    // Every item has a top rule; the first one's is transparent, the last one also closes with a bottom rule.
    const item = (position: 'default' | 'first' | 'last'): Layer => ({
      ...frame(`position=${position}`, 'horizontal'),
      type: 'COMPONENT',
      strokes: [{ type: 'solid', color: position === 'first' ? '#00000000' : '#dee0e3' }],
      strokeWeight: 1,
      strokeSides: [1, 0, position === 'last' ? 1 : 0, 0],
      boundVariables: { stroke: 'c:line' },
    })
    const row: ComponentSet = {
      name: 'Row',
      page: 'components/ui',
      properties: [variantProperty('position', ['default', 'first', 'last'])],
      variants: [item('default'), item('first'), item('last')],
    }
    // Each button of the stepper takes its own hover; the glyph in it follows its button, not the stepper.
    const stepper = (state: 'rest' | 'hover' | 'disabled'): Layer => ({
      ...frame(`interaction=${state}`, 'horizontal'),
      type: 'COMPONENT',
      children: [
        {
          ...frame('step', 'horizontal'),
          ...(state === 'disabled' ? { opacity: 0.3 } : {}),
          ...(state === 'hover' ? fill('c:line') : {}),
          children: [text('label', 'body', state === 'hover' ? 'c:accent' : 'c:ink')],
        },
      ],
    })
    const counter: ComponentSet = {
      name: 'Counter',
      page: 'components/ui',
      properties: [variantProperty('interaction', ['rest', 'hover', 'disabled'])],
      variants: [stepper('rest'), stepper('hover'), stepper('disabled')],
    }
    const { files } = buildComponents([row, counter], {
      ...context,
      config: {
        ...componentsConfig,
        interactionParts: { Counter: ['step'] },
        interactionPrefixes: { Counter: { hover: 'enabled:hover' } },
      },
    })
    expect(files.get('/shop/src/components/ui/row/row.variants.ts')).toContain(
      "export const row = cva('flex border-t last:border-b border-line first:border-transparent')",
    )
    const counterSource = files.get('/shop/src/components/ui/counter/counter.variants.ts')
    expect(counterSource).toContain("export const counter = cva('flex')")
    expect(counterSource).toContain(
      "export const counterStep = cva('group/counter-step flex enabled:hover:bg-line disabled:opacity-30')",
    )
    expect(counterSource).toContain(
      "export const counterLabel = cva('type-body text-ink group-enabled/counter-step:group-hover/counter-step:text-accent')",
    )
  })

  it('maps the open interaction state to aria-expanded, the attribute a trigger carries while its popup is open', () => {
    // Only the quiet tone is drawn open (a menu trigger); the solid one has no open state of its own.
    const trigger = (tone: 'solid' | 'quiet', state: 'rest' | 'open'): Layer => ({
      ...frame(`tone=${tone}, interaction=${state}`, 'horizontal'),
      type: 'COMPONENT',
      ...(tone === 'solid' ? fill('c:accent') : state === 'open' ? fill('c:line') : {}),
      children: [text('label', 'body', state === 'open' ? 'c:accent' : 'c:ink')],
    })
    const menuTrigger: ComponentSet = {
      name: 'MenuTrigger',
      page: 'components/ui',
      properties: [variantProperty('tone', ['solid', 'quiet']), variantProperty('interaction', ['rest', 'open'])],
      variants: [trigger('solid', 'rest'), trigger('quiet', 'rest'), trigger('quiet', 'open')],
    }
    const { files } = buildComponents([menuTrigger], context)
    const source = files.get('/shop/src/components/ui/menu-trigger/menu-trigger.variants.ts')
    expect(source).not.toContain('open:')
    expect(source).toContain("quiet: 'aria-expanded:bg-line'")
    // A layer inside follows the trigger through its named group.
    expect(source).toContain("quiet: 'text-ink group-aria-expanded/menu-trigger:text-accent'")
  })

  it('lays out a grid, fills a listed set, sets an inherited text style and stretches an empty slot', () => {
    const group = single('Choices', 'components/ui', {
      variants: [
        {
          ...frame('Choices', 'vertical'),
          type: 'COMPONENT',
          layout: { mode: 'grid', gap: 8, crossGap: 8, padding: [0, 0, 0, 0], gridColumns: 1 },
          boundVariables: { gap: 's:2', crossGap: 's:2' },
          children: [{ ...frame('choice', 'horizontal'), sizing: { horizontal: 'fill' as const } }],
        },
      ],
    })
    const sheet = single('Sheet', 'components/ui', {
      variants: [
        {
          ...frame('Sheet', 'vertical'),
          type: 'COMPONENT',
          children: [
            {
              ...frame('content', 'vertical', {
                layout: { mode: 'vertical', crossAlign: 'min', gap: 0, padding: [0, 0, 0, 0] },
              }),
              slot: true,
            },
          ],
        },
      ],
    })
    const { files } = buildComponents([group, sheet], {
      ...context,
      config: { ...componentsConfig, fullWidth: ['Choices'], inheritedText: { Sheet: 'type/body' } },
    })
    const choices = files.get('/shop/src/components/ui/choices/choices.variants.ts')
    expect(choices).toContain("export const choices = cva('grid w-full gap-2')")
    expect(choices).toContain("export const choicesChoice = cva('flex')")
    const sheetSource = files.get('/shop/src/components/ui/sheet/sheet.variants.ts')
    expect(sheetSource).toContain("export const sheet = cva('flex flex-col type-body')")
    expect(sheetSource).toContain("export const sheetContent = cva('flex flex-col items-stretch')")
  })

  it('lets an instance show its own photograph in a layer whose fill comes from data', () => {
    const photo = (overrides: string[]): Layer => ({
      name: 'image',
      type: 'FRAME',
      fills: [{ type: 'image' }],
      overrides,
    })
    // A lone component (not a set) names its instances' main by mainComponentName.
    const list = (overrides: string[], main: Partial<Layer> = { mainSet: 'Card' }) =>
      single('List', 'features/shop', {
        variants: [
          {
            ...frame('List', 'vertical'),
            type: 'COMPONENT',
            children: [{ name: 'card', type: 'INSTANCE', ...main, overrides: ['name'], children: [photo(overrides)] }],
          },
        ],
      })
    const config = { ...componentsConfig, runtimeFills: ['Card › image'] }
    const { files } = buildComponents([list(['fills'])], { ...context, config })
    expect(files.get('/shop/src/features/shop/components/list/list.variants.ts')).toContain(
      "export const list = cva('flex flex-col')",
    )
    expect(() => buildComponents([list(['fills', 'strokes'])], { ...context, config })).toThrow(
      'image overridden inside Card',
    )
    expect(() => buildComponents([list(['fills'])], context)).toThrow('image overridden inside Card')
    expect(() =>
      buildComponents([list(['fills'], { mainComponentName: 'Card' })], { ...context, config }),
    ).not.toThrow()
    // A card nested in a grid instance shows its own photograph too.
    const shelf = single('Shelf', 'features/shop', {
      variants: [
        {
          ...frame('Shelf', 'vertical'),
          type: 'COMPONENT',
          children: [
            {
              name: 'grid',
              type: 'INSTANCE',
              mainSet: 'Grid',
              overrides: ['name'],
              children: [{ name: 'card', type: 'INSTANCE', mainSet: 'Card', children: [photo(['fills'])] }],
            },
          ],
        },
      ],
    })
    expect(() => buildComponents([shelf], { ...context, config })).not.toThrow()
    expect(() => buildComponents([shelf], context)).toThrow('image overridden inside Grid')
  })

  it("leaves a nested instance's own opacity to the child", () => {
    const row = (overrides: string[]) =>
      single('Row', 'features/shop', {
        variants: [
          {
            ...frame('Row', 'horizontal'),
            type: 'COMPONENT',
            children: [{ name: 'tile', type: 'INSTANCE', mainSet: 'Tile', opacity: 0.4, overrides }],
          },
        ],
      })
    const path = '/shop/src/features/shop/components/row/row.variants.ts'
    expect(buildComponents([row(['name'])], context).files.get(path)).not.toContain('opacity-40')
    expect(() => buildComponents([row(['name', 'opacity'])], context)).toThrow('opacity overridden')
  })

  it("keeps a stroke paint's opacity on its border colour", () => {
    const tinted = single('Tinted', 'components/ui', {
      variants: [
        {
          ...frame('Tinted', 'horizontal'),
          type: 'COMPONENT',
          strokes: [{ type: 'solid', color: '#000000', opacity: 0.4 }],
          strokeWeight: 1,
          strokeAlign: 'inside',
          boundVariables: { stroke: 'c:accent' },
        },
      ],
    })
    expect(buildComponents([tinted], context).files.get('/shop/src/components/ui/tinted/tinted.variants.ts')).toContain(
      'border-accent/40',
    )
  })

  it('writes a thick stroke as its pixels, since a stroke token has no border-width utility to name', () => {
    const ringed = single('Ringed', 'components/ui', {
      variants: [
        {
          ...frame('Ringed', 'horizontal'),
          type: 'COMPONENT',
          strokes: [{ type: 'solid', color: '#000000' }],
          strokeWeight: 2,
          strokeAlign: 'inside',
          boundVariables: { stroke: 'c:ink', strokeWeight: 'st:focus' },
          children: [
            {
              ...frame('hairline', 'horizontal'),
              strokes: [{ type: 'solid', color: '#000000' }],
              strokeWeight: 1.5,
              strokeAlign: 'inside',
              boundVariables: { stroke: 'c:line' },
            },
          ],
        },
      ],
    })
    const source = buildComponents([ringed], context).files.get('/shop/src/components/ui/ringed/ringed.variants.ts')
    expect(source).toContain('border-2 border-ink')
    expect(source).toContain('border-[1.5px] border-line')
    expect(source).not.toContain('border-focus')
  })

  it("makes a text layer's tabular figures tabular-nums; any other OpenType feature stops the build", () => {
    const counter = (fontFeatures: Record<string, boolean>) =>
      single('Counter', 'components/ui', {
        variants: [
          {
            ...frame('Counter', 'horizontal'),
            type: 'COMPONENT',
            children: [text('value', 'body', 'c:ink', { fontFeatures })],
          },
        ],
      })
    const path = '/shop/src/components/ui/counter/counter.variants.ts'
    expect(buildComponents([counter({ tnum: true })], context).files.get(path)).toContain(
      "export const counterValue = cva('type-body text-ink tabular-nums')",
    )
    expect(() => buildComponents([counter({ smcp: true })], context)).toThrow('OpenType feature smcp')
  })

  it('sizes a nested instance the caller resized to fill, as its own box', () => {
    const bar = single('Bar', 'features/shop', {
      variants: [
        {
          ...frame('Bar', 'horizontal'),
          type: 'COMPONENT',
          children: [
            {
              name: 'field',
              type: 'INSTANCE',
              mainSet: 'Field',
              overrides: ['name', 'resizing'],
              sizing: { horizontal: 'fill' },
            },
          ],
        },
      ],
    })
    expect(
      buildComponents([bar], context).files.get('/shop/src/features/shop/components/bar/bar.variants.ts'),
    ).toContain("export const barField = cva('flex-1')")
  })

  it('sizes a layer bound to a responsive size with its CSS variable, and stops on a binding it cannot map', () => {
    // The mobile bar is as tall as layout/header; the lg one hugs its rows, so the height comes off there.
    const bar = (height: string) =>
      single('Bar', 'components/store', {
        properties: [variantProperty('viewport', ['mobile', 'lg'])],
        variants: [
          {
            ...frame('viewport=mobile', 'horizontal'),
            type: 'COMPONENT',
            sizing: { horizontal: 'fixed', vertical: 'fixed' },
            width: 390,
            height: 60,
            boundVariables: { height },
          },
          {
            ...frame('viewport=lg', 'vertical'),
            type: 'COMPONENT',
            sizing: { horizontal: 'fixed', vertical: 'hug' },
            width: 1440,
          },
        ],
      })
    expect(
      buildComponents([bar('l:header')], context).files.get('/shop/src/components/store/bar/bar.variants.ts'),
    ).toContain("export const bar = cva('flex h-(--layout-header) lg:h-auto lg:flex-col')")
    expect(() => buildComponents([bar('l:gutter')], context)).toThrow(
      'height 60 is bound to a variable that is no space/*, stroke/* or responsive size',
    )
  })

  it('formats the generated file with its classes in the order the repo lint sorts them', () => {
    const path = join(repo, 'apps/store/src/components/ui/x/x.variants.ts')
    const formatted = formatTs(
      new Map([[path, "import { cva } from 'class-variance-authority'\nexport const x = cva('px-4 flex')\n"]]),
      repo,
    )
    expect(formatted.get(path)).toContain("cva('flex px-4')")
  })
})
