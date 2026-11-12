import { describe, expect, it } from 'vitest'

import type { ComponentSet, Layer } from '../components/snapshot.ts'
import type { TokensConfig } from '../config.ts'
import { buildFrontmatter, withFrontmatter } from '../design-md/build.ts'
import { buildTokens } from '../tokens/tokens.ts'
import { componentsConfig, frame, text, tokenSnapshot } from './fixtures.ts'

const tokensConfig: TokensConfig = {
  output: { css: '/shop/tokens.gen.css', ts: undefined },
  theme: { collection: 'Theme', modes: [{ mode: 'Light', selector: ':root' }] },
  viewport: undefined,
  textStyles: { prefix: 'type-', form: 'utility' },
  paletteInTheme: false,
  rootFontSize: 16,
}

function variant(name: string, fillId: string, textColorId: string, extra: Partial<Layer> = {}): Layer {
  return {
    ...frame(name, 'horizontal'),
    type: 'COMPONENT',
    fills: [{ type: 'solid', color: '#000000' }],
    boundVariables: { fill: fillId },
    children: [text('label', 'heading', textColorId)],
    ...extra,
  }
}

const button: ComponentSet = {
  name: 'Button',
  page: 'components/ui',
  properties: [{ name: 'variant', type: 'variant', default: 'primary', options: ['primary', 'secondary'] }],
  variants: [
    variant('variant=primary', 'c:accent', 'c:surface', {
      sizing: { vertical: 'fixed' },
      height: 44,
      boundVariables: { fill: 'c:accent', height: 's:11' },
    }),
    variant('variant=secondary', 'c:surface', 'c:ink'),
  ],
}

// The viewport property is design-only: one entry per cva variant, read at mobile.
const promoBanner: ComponentSet = {
  name: 'PromoBanner',
  page: 'components/store',
  properties: [{ name: 'viewport', type: 'variant', default: 'mobile', options: ['mobile', 'lg'] }],
  variants: [variant('viewport=mobile', 'c:accent', 'c:surface'), variant('viewport=lg', 'c:ink', 'c:surface')],
}

const homeScreen: ComponentSet = {
  name: 'Home',
  page: 'app/home',
  properties: [],
  variants: [variant('Home', 'c:surface', 'c:ink')],
}

describe('DESIGN.md frontmatter', () => {
  const frontmatter = buildFrontmatter({
    name: 'Shop',
    description: 'A test shop.',
    tokens: buildTokens(tokenSnapshot, tokensConfig),
    sets: [button, promoBanner, homeScreen],
    context: {
      config: componentsConfig,
      variables: tokenSnapshot.variables,
      textStyles: tokenSnapshot.textStyles,
      textStylePrefix: 'type-',
      textStyleVariants: true,
    },
  })

  it('writes the tokens and every exported set variant, the variants as token references', () => {
    expect(frontmatter).toBe(
      [
        '---',
        'name: Shop',
        'description: A test shop.',
        'colors: { ink: "#0d1012", surface: "#ffffff", accent: "#004eba", line: "#dee0e3" }',
        'typography: { heading: { fontFamily: "Manrope", fontSize: "20px", fontWeight: 700, lineHeight: "30px" }, body: { fontFamily: "Manrope", fontSize: "16px", fontWeight: 400, lineHeight: "24px" } }',
        'rounded: { full: "9999px" }',
        'spacing: { "2": "8px", "4": "16px", "6": "24px", "11": "44px" }',
        'components: { button: { backgroundColor: "{colors.accent}", textColor: "{colors.surface}", typography: "{typography.heading}", height: "{spacing.11}" }, button-secondary: { backgroundColor: "{colors.surface}", textColor: "{colors.ink}", typography: "{typography.heading}" }, promo-banner: { backgroundColor: "{colors.accent}", textColor: "{colors.surface}", typography: "{typography.heading}" } }',
        '---',
        '',
      ].join('\n'),
    )
  })

  it('replaces only the frontmatter, leaving the prose as written', () => {
    const prose = '\n# Design System: Shop\n\nHand-written.\n'
    expect(withFrontmatter(`---\nname: Old\ncolors: {}\n---\n${prose}`, frontmatter)).toBe(`${frontmatter}${prose}`)
    expect(withFrontmatter(`---\n---\n${prose}`, frontmatter)).toBe(`${frontmatter}${prose}`)
    expect(withFrontmatter(prose, frontmatter)).toBe(`${frontmatter}${prose}`)
  })
})
