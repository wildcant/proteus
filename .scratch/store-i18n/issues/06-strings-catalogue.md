# 05 — Strings: catalogue and product

`features/products/**` plus `routes/_main/index.tsx` and `routes/_main/products/*` — roughly 15
messages across 11 files. Small, but it covers the two SSR'd SEO routes, so it is the first place
the Spanish site becomes worth indexing.

Depends on `01-runtime-and-build-wiring.md`. Follows the pattern established in `05`.

## Work

Mechanical apart from three things.

**`product-specs.tsx:15-18`** — the spec labels (`Ref.`, `Material`, `Weight`, `Made in`) are
frontend and translate; the *values* beside them are backend catalogue rows and do not. The row
will read `Material: plywood` in Spanish. That is expected — see the out-of-scope list in `spec.md`.

The `` `${weight} g` `` suffix stays as-is: `g` is an SI symbol and does not translate. The number
itself is a bare integer, so ticket 04 does not touch it either.

**`variant-picker.tsx:41,45,54`** is the classic e-commerce trap. `{option.title}` ("Colour",
"Size") and `value.value` ("Red", "S") read like UI chrome and are catalogue data. Leave them alone.
Do not "helpfully" add a lookup table of common option names — that is a translation layer for
merchant data and belongs behind an API contract, not in the storefront.

**`product-gallery.tsx:39`** — `` aria-label={`Show image ${index + 1}`} `` needs an interpolated
message, not a template literal.

Per-route `<title>` and `<meta description>` for the product pages are **not** in this ticket. There
are none today — ticket 02 localised the single root `head()`. Adding per-product metadata is real
SEO work with its own decisions (truncation, brand suffix, OG tags) and deserves its own ticket.

## Translations

I fill `es.po` for the messages this ticket adds, in informal *tú* with neutral Latin-American
vocabulary — "carrito" not "cesta". You review the `.po` diff before it merges. The review surface
is one column of prose, and what it is actually guarding is **tone consistency across four
separately-landed tickets**: commerce copy is short and highly patterned, so the risk is drift, not
mistranslation.

A message left untranslated renders its English default, so a gap here is cosmetic rather than
broken — but ship the Spanish with the ticket rather than after it, or the review never happens.

## Acceptance

Same as `05`: rendered English byte-identical, `npm run verify`, all nine e2e specs unmodified.
`products.spec.ts` is the one to watch.

`product-card.tsx` and `product-detail.tsx` render prices through `formatPrice`. Ticket 04 makes
that Locale-aware, but because `es-US` and `en-US` format USD identically the rendered output does
not change — so the e2e assertions on `$25.00 each` and `$75.00` hold regardless of which ticket
lands first.

Re-extract and commit the catalog diff.
