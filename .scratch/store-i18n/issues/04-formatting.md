# 04 — Locale-aware formatting

Money and dates. Smaller than it looks, because of a property of `es-US` worth stating up front.

Depends on `01-runtime-and-build-wiring.md`. Independent of the string tickets.

## Already delivered by markets

**This ticket is done, other than one line.** Markets needed the same thing for a different reason
— a Colombian shopper reading `$ 100.000` rather than `COP 100,000` — so the whole of the Work
section below shipped:

- `packages/ui/src/utils/pricing.ts` — `formatPrice`, `formatAmount` and `getCurrencySymbol` take
  an optional trailing locale, defaulting to `en-US`. Covered by `pricing.test.ts`.
- `packages/utils/src/date.ts` — `formatDate`, `formatDatetime` and `formatRelativeTime` take an
  optional locale and use `Intl` when given one. Covered by `date.test.ts`. `formatRelativeTime`
  was localized too, which this ticket left out as admin-only.
- `apps/store/src/lib/use-formatters.ts` — the store's seam, bound to the market's Locale rather
  than to an i18n tag, and exposing only what the storefront renders (`formatPrice`, `formatDate`,
  `formatDatetime`).
- The store call sites, all swapped to the hook.

The one line left is inside the hook: read the tag from the active `i18n` instead of from
`current.localeCode`, once ticket 01 has created an `i18n` whose tag can differ from the market's.
Until then the two are the same value and the hook is already correct.

One deviation from what this ticket proposed, worth knowing before reading it. The pricing helpers
default the parameter to `'en-US'` as written here, but the date helpers take `locale?: string` and
branch on it, keeping date-fns on the no-locale path rather than routing every caller through
`Intl`. Same guarantee either way — omit the locale and the output is character-for-character what
it was — but for dates the two are not actually identical, which is why the branch exists. See the
comment at the top of `date.ts`.

## The finding this ticket rests on

`es-US` means *Spanish words, American numbers*. Verified with `Intl`:

| | `en-US` | `es-US` | `es-ES` | bare `es` |
|---|---|---|---|---|
| USD | `$1,234.56` | **`$1,234.56`** | `1234,56 US$` | `1234,56 US$` |
| date medium | `Jan 5, 2026` | `5 ene 2026` | `5 ene 2026` | `5 ene 2026` |
| time short | `10:45 AM` | `10:45 a.m.` | `10:45` | — |
| week starts | Sun | Sun | Mon | — |

So **money is byte-identical between `en-US` and `es-US`** and the price work is pure plumbing with
no visual diff — every e2e assertion on `$25.00 each` and `$75.00` stays valid. **Only dates move.**

It also shows why the Locale tag carries the country. Passing a bare `es` to `Intl` would render a
US store's prices `1234,56 US$`.

## Work

**`packages/ui/src/utils/pricing.ts`** — `formatPrice`, `formatAmount` and `getCurrencySymbol` each
take an optional trailing `locale = 'en-US'` and pass it to `Intl.NumberFormat` in place of the
hardcoded literal. All three currently hardcode `'en-US'` in four places between them, including the
nested call inside `formatAmount` that resolves `minimumFractionDigits`.

Defaulting to `'en-US'` is what keeps this additive: admin's four call sites, and everything in
`packages/ui` itself, keep their current behaviour with no edit.

**`packages/utils/src/date.ts`** — `formatDate` and `formatDatetime` move from date-fns `format()`
to `Intl.DateTimeFormat`, taking the same optional `locale = 'en-US'`:

```ts
export function formatDate(date: string | number | Date, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(date))
}
```

Intl rather than date-fns locale objects because `Intl` takes the BCP 47 tag we already hold, while
date-fns needs an imported `Locale` object and therefore a hand-maintained tag→object map — a second
locale vocabulary running alongside the first.

Two output notes, both checked:

- `formatDate` is **unchanged** for English. `Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })`
  is `Jan 5, 2026`, character-identical to `format(d, 'MMM d, yyyy')`.
- `formatDatetime` gains **one comma**: `Jan 5, 2026, 10:45 AM` rather than `Jan 5, 2026 10:45 AM`.
  Nothing asserts on it — there are no date assertions in the store e2e suite and no admin tests
  touch these functions — but it is a real diff on 11 admin screens, so say so in the PR.

  This did not happen: the shipped `date.ts` keeps date-fns on the no-locale path, so the admin
  gained no comma. `date.test.ts` asserts it.

`formatRelativeTime` stays on date-fns and stays un-localized. It is **admin-only** — the store
imports `formatDate` (3 sites) and `formatDatetime` (1 site) and never touches it. `startOfDay` and
`subDays` are unaffected, so date-fns remains a dependency either way.

**`apps/store/src/lib/i18n/use-formatters.ts`** — the store's seam:

```ts
export function useFormatters() {
  const { i18n } = useLingui()
  return useMemo(() => ({
    formatPrice:    (amount: string, currency: string) => formatPrice(amount, currency, i18n.locale),
    formatAmount:   (value: string, currency: string) => formatAmount(value, currency, i18n.locale),
    formatDate:     (date: DateInput) => formatDate(date, i18n.locale),
    formatDatetime: (date: DateInput) => formatDatetime(date, i18n.locale),
  }), [i18n.locale])
}
```

A hook rather than threading `i18n.locale` through ~22 call sites: each file swaps one import for
one hook call, and a site that is missed becomes a lint error for an unused import rather than
silently rendering `en-US` forever.

`i18n.locale` is the **tag** (`es-US`), which is why ticket 01 sets it from `locale.tag` and not
from the language.

**Swap the store call sites** — ~18 pricing and 4 date. Pricing lives in `product-card`,
`product-detail`, `checkout-summary`, `cart-content`, `cart-item`, `order-summary`, `order-items`,
`payment-details`, `delivery-details`, `shipping-method-form`, `orders-panel`, `cart-dropdown`.
Dates in `order-content`, `orders-panel`, `payment-details`, `order-confirmed-content`.

Note `payment-details.tsx:21` uses both in one sentence, and that sentence also gets wrapped for
translation in ticket 08 — coordinate or expect a conflict.

## Acceptance

```bash
npm run verify                          # includes admin tests and the ui/utils formatter tests
npm run --workspace=store test:e2e
```

English output must be unchanged. The admin must be untouched — if any admin file needed editing,
the optional parameter was not optional enough.

Spot-check under `/es-US` once ticket 05 has translated enough chrome to navigate: prices identical
to English, dates in Spanish.
