import type { Appearance } from '@stripe/stripe-js'
import { useEffect, useState } from 'react'

/**
 * The Payment Element's accordion, dressed as one of the store's own rows.
 *
 * Stripe draws rows 3 of the payment list — the provider's other methods — inside a cross-origin
 * iframe, so the only way they can match the rows we draw is the Appearance API's fixed set of
 * rules. Every value here comes from a `@proteus/ui` token read off the live document rather than
 * written twice: a literal here and a literal in `styles.css` are twins that drift silently, and
 * the first person to change one would have no way of knowing the other existed.
 */

/** The tokens the appearance is built from. Named here so a missing one fails loudly. */
const TOKENS = ['--ink', '--ink-muted', '--ink-subtle', '--surface', '--surface-subtle', '--line', '--sale'] as const

type Token = (typeof TOKENS)[number]
export type ThemeTokens = Record<Token, string>

/** Only reachable in the browser: the Payment Element does not render on the server. */
export function readThemeTokens(): ThemeTokens {
  const styles = getComputedStyle(document.documentElement)
  const entries = TOKENS.map((token) => [token, styles.getPropertyValue(token).trim()] as const)
  return Object.fromEntries(entries) as ThemeTokens
}

/**
 * The current tokens, re-read when the shopper changes the colour scheme.
 *
 * `ThemeToggle` swaps a class and a `data-theme` attribute on `<html>`, so watching those two is
 * the whole of it. Re-reading matters because the iframe cannot see our variables: without this
 * a shopper who switches to dark mid-checkout is left with a white card form on a dark page.
 */
export function useThemeTokens(): ThemeTokens | null {
  const [tokens, setTokens] = useState<ThemeTokens | null>(null)

  useEffect(() => {
    const read = () => setTokens(readThemeTokens())
    read()

    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => observer.disconnect()
  }, [])

  return tokens
}

/**
 * Built from the store's tokens, and deliberately *not* giving the accordion's selected state a
 * second heavy border: the store's own row and its panel already draw one envelope around the
 * open method, and a border inside it stacks two black rectangles. Carried over from
 * `accept-a-payment`, which documents the same decision.
 */
export function appearanceFor(tokens: ThemeTokens): Appearance {
  return {
    theme: 'stripe',
    variables: {
      colorPrimary: tokens['--ink'],
      colorText: tokens['--ink'],
      colorTextSecondary: tokens['--ink-muted'],
      colorTextPlaceholder: tokens['--ink-subtle'],
      colorBackground: tokens['--surface'],
      colorDanger: tokens['--sale'],
      // Square is the system, not an override — `--radius` is 0rem for every store primitive.
      borderRadius: '0px',
      fontFamily: '"Manrope Variable", ui-sans-serif, system-ui, sans-serif',
      fontSizeBase: '14px',
      spacingUnit: '4px',
    },
    rules: {
      /**
       * The accordion item, written as the twin of `ROW_CLASS` in `payment-methods/row.ts`: one
       * hairline, square, 16px in, no shadow, filling on hover. Both sides are the same row drawn
       * in two places we cannot share a stylesheet across, so a change to one is a change to the
       * other — and this side is the constrained one, because the Appearance API decides which
       * properties exist at all. `min-height` is not among them, which is why `ROW_CLASS` gives
       * its height to `p-4` rather than to a minimum only one side could honour.
       */
      '.AccordionItem': {
        backgroundColor: tokens['--surface'],
        border: `1px solid ${tokens['--line']}`,
        borderRadius: '0px',
        boxShadow: 'none',
        padding: '16px',
      },
      '.AccordionItem--selected': {
        backgroundColor: tokens['--surface-subtle'],
        // No second border here on purpose. See the comment above.
        color: tokens['--ink'],
      },
      '.AccordionItem:hover': { backgroundColor: tokens['--surface-subtle'] },
      /**
       * The radio mark, matched to the store's own — which is a *filled* mark rather than a ring:
       * `RadioGroupItem` paints the whole circle ink and punches a surface-coloured dot out of it.
       * Stripe's default is the opposite (a ring with a filled centre), and the two sat side by
       * side in one list looking like two different controls.
       *
       * `--checked` is the modifier Stripe recognises. It was written as `RadioIconOuterChecked`,
       * which is not a rule name, so the checked state was silently never styled at all.
       */
      '.RadioIconOuter': { fill: tokens['--surface'], stroke: tokens['--line'], strokeWidth: '1' },
      '.RadioIconOuter--checked': { fill: tokens['--ink'], stroke: tokens['--ink'] },
      '.RadioIconInner': { fill: tokens['--surface'] },
      // Inputs are white on the panel's subtle fill, with hairline borders.
      '.Input': {
        backgroundColor: tokens['--surface'],
        border: `1px solid ${tokens['--line']}`,
        borderRadius: '0px',
        boxShadow: 'none',
        padding: '10px 12px',
      },
      '.Input:focus': { border: `1px solid ${tokens['--ink']}`, boxShadow: 'none', outline: 'none' },
      '.Input--invalid': { border: `1px solid ${tokens['--sale']}`, boxShadow: 'none', color: tokens['--ink'] },
      '.Label': { color: tokens['--ink-muted'], fontSize: '12px', fontWeight: '500' },
      '.Error': { color: tokens['--sale'], fontSize: '12px' },
      '.CheckboxInput': { borderRadius: '0px', border: `1px solid ${tokens['--line']}`, boxShadow: 'none' },
      '.CheckboxInput--checked': { backgroundColor: tokens['--ink'], borderColor: tokens['--ink'] },
      '.CheckboxLabel': { color: tokens['--ink'], fontSize: '14px' },
    },
  }
}
