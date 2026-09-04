# Store translations — Merchant Text

**Status:** not started, not designed. This is a placeholder capturing the intended approach so it
is not re-derived later. `.scratch/store-i18n/` ships first and must land before this is planned in
detail.

Two of the named divergences below were corrected after the markets feature shipped: proteus now
has a `store` module, and the storefront now fetches its routable set rather than compiling it in.
The language-country segment shape this spec assumes is unchanged — markets adopted it.

## Why

`.scratch/store-i18n/` translates **Store Copy** — the text the storefront authors. It cannot touch
**Merchant Text**: product titles, subtitles and descriptions; Product Option titles and values;
Variant Titles; shipping option names; payment provider labels; and API error messages. Those come
from the backend, in one language, and render as-is under every Locale.

The result after that feature is a Spanish page with English merchandise on it. This feature closes
that.

## Approach: follow Medusa's Store API multi-language

Reference implementation lives at `/Users/willo/learn/medusa/medusa-source`. The shape:

**Feature flag.** Medusa gates the whole thing behind `translation` / `MEDUSA_FF_TRANSLATION`,
default off (`packages/medusa/src/feature-flags/translation.ts`). `ConfigModule` here already has
`featureFlags: Record<string, boolean | string | Record<string, boolean>>`, so the mechanism exists.

**Locale resolution** — `packages/core/framework/src/http/middlewares/apply-locale.ts`, mounted on
`/store` only. Order is: `?locale=en-US` query param (deleted from the query afterwards), then the
`x-medusa-locale` header. **No `Accept-Language` fallback and no default** — send neither and
`req.locale` is `undefined`, which yields untranslated values.

Our seam is `apps/backend/src/api/store/middlewares.ts`, which already carries `setPricingContext()`
setting `req.pricingContext`. `req.locale` follows the same pattern.

**Storage** — one row per `(reference_id, reference, locale_code)` holding a JSON blob of the
translated fields (`packages/modules/translation/src/models/translation.ts`). Allowed locales are
declared per store in `store_locale` and exposed via `GET /store/locales`.

**Read path** — store routes thread `req.locale` into the query and `applyTranslations` swaps the
fields in the response, for products, variants, categories, collections, tags and types.

**Checkout persistence** — `cart.locale` (settable on cart create/update) is copied to `order.locale`
at completion, and line items, shipping methods and tax lines get their **translated titles
snapshotted at that moment**. That is what makes an order render correctly forever, even if the
translation changes later. proteus already has an `order` module with its own `line-item` and
`shipping-method`, so the snapshot pattern is established.

**Notifications** — the notification module has no locale column and `CreateNotificationDTO` has no
locale field. Language selection is entirely the caller's job: the subscriber reads `order.locale`
and either picks a per-locale template or passes the locale through in `data` for the provider's
template engine to branch on. Because item titles are already translated snapshots, the body mostly
comes out right for free — it is the surrounding boilerplate that needs localizing. `order.locale`
is null unless the storefront set it, so the subscriber needs a store-level default.

## Named divergences from Medusa

**camelCase, not snake_case.** `referenceId`, `localeCode`, `cart.locale`. Enforced by Biome's
`useNamingConvention`; the repo has no snake_case anywhere.

**Our own header name**, not `x-medusa-locale`.

**Query param over header for GETs.** Medusa accepts both. The store's product routes are ISR-cached
by URL at the CDN, and React Query keys off the URL too — a header would need `Vary` and would make
two Locales share one cache entry. A query param is naturally cache-keyed. Worth confirming when
this is designed properly.

**A `store` module now exists.** This section originally said proteus had no Store entity and that
`store_locale` therefore had no home. The markets feature added
`apps/backend/src/modules/store/` with `Store` and `StoreCurrency`, so a `store_locale` table
alongside them is now the obvious placement rather than an open question — worth confirming when
this is designed properly, but no longer a divergence.

**The routable Locale set is fetched by the storefront, not compiled into it.** Also inverted by
markets: `apps/store/src/lib/sellable-markets.ts` reads the routable segments from
`GET /store/countries` and caches the answer per server instance, with a compiled-in default market
as the fallback when the backend is unreachable. `GET /store/locales` still answers a different
question — "which Locales have Merchant Text translations" — and still gates picker entries rather
than deciding which URLs exist. What has changed is that "the storefront cannot fetch this" is no
longer the reason why.

## Open questions for when this is planned

- Admin authoring UI, or seed and API only to start?
- Which entities in the first pass — products alone, or options and shipping too?
- Does `applyTranslations` fall back to the source language per field, or per row?
- Do API error messages move to a code-based contract, or stay English? They are the one piece of
  Merchant Text with no natural translation row.
