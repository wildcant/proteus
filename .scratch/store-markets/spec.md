# Store markets — shopper-selected market drives currency, formatting and payment methods

**Status:** shipped, pending the Final PR merge (#44). Tracked as ILLO-47.

## Overview

The storefront sold to one country in one currency, and neither was a decision anyone made — they were hardcoded defaults. Every shopper was quoted US dollars with US formatting, offered every payment provider the store had enabled, and given US shipping options regardless of where they were. Adding a second country meant editing the storefront, because the list of countries the store sells to was a constant compiled into the client.

Now a shopper picks their market from a control in the storefront. That single choice determines the URL they browse, the currency they are quoted and charged in, how prices and dates are formatted, which payment methods appear at checkout, and where the order can be delivered.

Two markets ship: the United States in USD (`en-US`), and Colombia in COP (`es-CO`). Which markets exist, which countries they cover, which currency each settles in and how each formats all live in the database. The storefront reads them and renders; it decides nothing.

Currency is derived from the market rather than chosen separately, so there is one decision for the shopper to make and one thing that can be wrong.

## Scope

**In scope**

- `region` and `store` modules, and a region-to-payment-provider link module.
- Country-to-region-to-currency resolution on the store API, with a defined fallback chain.
- A store endpoint listing countries in two shapes: sellable markets, and the full ISO table.
- Region-scoped payment providers, shipping options resolved from the cart, and cart repricing across a market switch.
- Locale-prefixed storefront routing, a market control, per-market money and date formatting, and market-aware address handling.
- Admin surfaces for regions, countries, store details and currencies, and multi-currency variant prices.

**Out of scope**

- Translations and the internationalisation runtime. The locale code drives the URL, the language attribute and formatting; interface text stays English. `.scratch/store-i18n/` owns that and lands next.
- Geo-IP market detection. The resolution chain is built with the slot it will occupy.
- Rule-based and context-based pricing. One price per currency is enough.
- Tax. No module, and explicitly excluded.
- Cross-border shipping. Shipping options carry a bare amount with no currency, so shipping outside the market's country would need per-currency rates.
- Independent currency selection. Currency is derived from the market.
- Multiple languages per country. Would need its own table.
- Sales channels and stock locations. No modules exist.

---

## 1. The data model

### `region` module

`Region` holds a name and a currency code. `Country` holds ISO-2 as its primary key, ISO-3, the numeric code, name, display name, a **nullable** owning region, and a **nullable** locale code. Uniqueness is enforced across owning region and ISO-2.

The nullable owning region is the load-bearing decision: the country table is static ISO reference data, and **assigning a region is what makes a country sellable**. There is no separate "enabled" flag to drift out of sync.

Modelled on the reference implementation's region module, minus its automatic-taxes flag — there is no tax module here.

### Locale code is one field doing three jobs

It is the URL segment, the document language attribute, and the tag passed to every number and date formatter.

It is stored rather than derived because formatting is not derivable from the country alone: a Colombian peso formatted under `en-CO` produces a three-letter code and US separators, while `es-CO` produces the symbol and Colombian separators. **Formatting conventions belong to the market, not to the reading language.**

One language per country for now. Several languages per country would need its own table.

### `store` module

`Store` holds a name and a default region; `StoreCurrency` holds a currency code and a default flag. The reference implementation's default-sales-channel and default-location fields are omitted because neither module exists here, and its supported-locales table is omitted because it belongs to the translation feature.

The default region is data rather than configuration, so the fallback market is editable without a deploy.

### Region ↔ payment provider

A writeable link module, following the codebase's existing link pattern. The relationship is many-to-many, so a region column on the provider would have been wrong.

### What was deliberately not built

No price rules, no tax module, no currency table. One price per currency per price set is sufficient; the pricing spec already defers rule-based pricing. Currency symbols and decimal digits come from `Intl`, so a currency table would carry no information.

---

## 2. Store API

### Pricing context resolves country to region on the server

`apps/backend/src/api/store/middlewares.ts` accepts a country code and resolves country → region → currency. The fallback order:

1. an explicit country code on the request,
2. the cart's region,
3. the store's default region,
4. otherwise an error.

A country code is an **instruction**: a country no region sells to is an error, not a reason to reach for the next signal. A cart is only a **hint** — its id comes off a cookie that outlives the cart it names — so an unknown one falls through. A store with no default region has no answer to give; quoting some other currency would price a basket in money nobody chose.

**Divergence from the reference implementation**, which resolves only by region id and leaves the country-to-region lookup to its storefront. Moving it server-side means the storefront sends the segment it already has and never needs to know what a region is.

### `GET /store/countries`

Returns a flat, server-sorted collection: ISO-2 code, display name, currency code, locale code. Sellable countries by default; the full ISO table under `?scope=all`, where currency and locale are null for countries with no owning region.

**Divergence:** the reference implementation exposes regions with countries nested and makes its storefront flatten, filter and sort them. This returns exactly what the caller renders.

The two shapes exist because the market control and the billing-country select need different sets — a card can legitimately be registered in a country the store does not sell to, and a past order must still show the full name of a country no longer sold to.

### Payment providers are scoped to the cart's region

`GET /store/carts/:id/payment-providers`, not a flat route with a region parameter. The cart is where the region is authoritative — checkout already priced the basket from it — so a region on the request would be a second source of truth free to disagree with the money on screen. Retrieving the cart is also what makes an unknown one a 404 rather than a list of every provider in the deployment.

A cart with no region gets an empty list, not the full one. Falling back to everything is exactly the leak this route closes.

### Shipping options resolve their country from the cart

Shipping address country first — the shopper's own answer wins outright. Then the region's first country by code, as the honest stand-in for a cart that has not reached the address step. Null when the cart has neither, and the caller lists nothing rather than guessing: every guess is somebody's market, and offering the wrong one's rates is worse than offering none.

Geo zones match by country code and are not linked to regions — that is the reference implementation's shape too, which is why this was a resolution fix rather than a new join.

### Cart update handles region change

Three of the reference implementation's five refresh steps port: reprice line items, refresh shipping methods, refresh the payment collection. Tax lines and promotions have no module to port to.

Region-change rules follow the reference: reject a shipping address whose country is outside the new region, and when the new region has exactly one country, set the shipping address country to it. A line item with no price in the new currency fails the switch with a message naming the item — nothing vanishes silently.

### Products the market cannot price are hidden

`GET /store/products` restricts to products with a price in the resolved currency; the detail route returns `NOT_FOUND` rather than a product whose variants were all dropped.

Before this feature every product had a USD price by construction, so this branch was unreachable. It became the default outcome for any product created after launch, which is why it is handled here rather than left to the admin.

---

## 3. Storefront

### Every market is prefixed in the URL

There is no unprefixed default. `/` is a pure router: it resolves the cookie, then the store default, and redirects. It never renders a page. This matches the reference implementation, which always prefixes.

Prefixing the default market too means one URL shape for every market, so no later slice has to remember that one market is spelled differently.

### The segment is carried by `RouterOptions.rewrite`, not by moving route files

`apps/store/src/router.tsx` configures `rewrite.input` to strip the market segment off the browser URL before matching, and `rewrite.output` to put it back on every URL the router builds.

**This is the decision most likely to be questioned later, so the reasoning is recorded in full.** The alternative — a `$market` or `[market]` directory, which is what the Medusa Next.js starter uses at `src/app/[countryCode]/` — would have rewritten 56 typed `to="/…"` call sites across 41 files, regenerated every id in `routeTree.gen.ts`, and broken the end-to-end suite at typecheck, because `apps/store/tests/setup/test-extend.ts` types its navigation fixture against `FileRouteTypes['to']` and the typecheck includes the test directory.

The reference implementation has no choice: Next's App Router has no router-level rewrite, so a dynamic segment directory is the only way to get that URL shape there. TanStack Router has `rewrite`, so the same URLs are reachable while route files, generated types and every call site stay untouched.

The rewrite behaving identically across server rendering and client hydration was the one unproven assumption in the plan. It was built first, with the file move as a declared fallback. It held; the fallback was never taken.

**The known trade:** `rewrite.input` mutates `market.current` while parsing the location. That is safe — the server builds a router per request, and on the client a market switch is a full document navigation — but a route param would not need the mutable state at all. If this is ever revisited, that is the reason to do it, not the URL shape, which is already correct.

`context.market` is a separate mechanism: how a component asks which market it is in without re-parsing the URL. It does not carry the segment.

### Resolution order, and what an unknown segment does

URL, then persisted cookie, then store default. The cookie stores the locale code.

An unknown segment returns not-found rather than redirecting. Redirecting would create duplicate content at unbounded URLs.

### Switching market is a document navigation

The rewrite is fixed when the router is created, so a client-side navigation would re-apply the previous segment. The switch preserves the path and search parameters, writes the cookie, and asks the backend to move the cart.

**The cart must be reconciled on every market entry, not only on the control** — a bookmark, a shared link and the cookie-resolved root redirect all land a returning shopper in a market holding a stale cart. Missing this was the most expensive defect in the build; see §6.

### The document language attribute follows the locale code

Until translations land, the `es-CO` market serves English text under a Spanish tag. This is a known, accepted trade-off, chosen over hardcoding English because that would be a flag someone must remember to flip, whereas this becomes correct the moment catalogues exist. It is bounded: no alternate-language and no sitemap entry is published for that market, so it is reachable and shoppable but never advertised to crawlers as Spanish content.

Only a market control ships. A language control would have one option and nothing behind it.

### Formatting

The money and date helpers in `packages/ui` and `packages/utils` take an optional trailing locale that defaults to the previous behaviour, so every existing admin call site kept working untouched. The storefront routes all of its formatting through one helper (`lib/use-formatters.ts`), which is what keeps the two markets from drifting apart one call site at a time.

### Addresses

The shipping address country is inferred from the market and is not editable — a shopper cannot create an address the store cannot ship to. The billing address country is freely selectable across the full ISO list, because a card can legitimately be registered abroad.

The checkout address picker filters to addresses deliverable in the current market; the address book shows everything the shopper saved, so switching market never looks like data loss.

---

## 4. Admin

Seed-only management was the original plan. It turned out to be a dead end: the store hides products it cannot price, the admin could only ever write USD, so any product created after launch was invisible in Colombia with no screen to fix it. The admin surface was added to this feature rather than deferred.

- **Multi-currency variant prices** — the price editor offers a row per store currency instead of a hardcoded USD row.
- **Regions** at `settings/regions` — create, edit, list, with currency and payment-provider selection.
- **Countries and locales** at `settings/regions/$id/countries` — assign countries to a region and set each one's locale code.
- **Store details and currencies** at `settings/store` — store name, default region, and the store currency set with its default.

Backend: `api/admin/regions`, `api/admin/countries`, `api/admin/store` and `api/admin/store/currencies`, each with API-seam tests.

---

## 5. Testing

**Assert on what a caller observes** — the HTTP response a storefront would receive, or what a shopper sees in a browser. Never on which module was consulted, in what order, or with what arguments. A test that would fail if the country-to-region lookup moved between middleware and route handler, without any response changing, is testing the implementation and will have to be rewritten by whoever refactors it next.

**Two seams, both pre-existing.**

- **The store HTTP API harness** covers everything server-side: resolution and each of its fallbacks including the errors, region-scoped providers, shipping-option country resolution, cart repricing across a switch, the region rejection, and the missing-price path. Deliberately **no module-service tests** for this feature — the API seam sits above them and observes the same behaviour, and a second seam testing the same logic is a second thing to update per change.
- **The browser end-to-end suite** covers what only a real browser against a real server can show: root redirect, both markets rendering, unknown segment not-found, the document language attribute, a market switch round-trip preserving search parameters, and rendered formatting differing between markets.

Seed integrity is tested at the API seam rather than by inspecting the database: a request for each market returns prices in that market's currency, which fails if either currency is missing from a variant.

**Frontend unit tests are deliberately absent.** They were written during the build and removed before merge — the FE projects are not taking unit tests yet. Backend API coverage is unaffected.

**The end-to-end suite runs outside `npm run verify`**, so it is a manual gate. It was never run against this branch by an agent: Playwright needs a browser and a running stack. Everything else — all ten verify suites including Spectral, plus the full backend suite — passes.

---

## 6. Two defects the slicing missed, and why

Recorded because both were gaps *between* tickets, which is the failure mode this kind of plan is prone to and the one per-slice review cannot see.

**The market switch never moved the cart.** The repricing API and the market control were separate slices, and neither owned the wiring between them. Every per-slice check passed while a shopper could add an item in `/en-US`, switch to `/es-CO`, see two currencies on one screen, be offered US courier rates under a form saying Colombia, and complete the order in USD after being quoted COP. Caught by a stage review reading across slices, not by any ticket's own tests.

**Products with no price in the market were returned anyway.** The listing returned them without a price and the detail route returned a shell with no variants — a card with a title, an image and no price, and a page with nothing to add to a cart. Unreachable before this feature, because every product had a USD price by construction. Caught by the final cross-slice review; the seed prices every variant in both currencies, which is exactly why no test saw it.

The lesson worth keeping: **a fixture that makes the happy path testable can hide the branch that only exists once the feature ships.**

---

## 7. Known limitations at merge

- **A market switch on a product the new market cannot price shows a developer error screen.** The store API correctly 404s, and no error boundary exists on `_main/products/$productId.tsx`. TanStack's built-in component renders with the raw backend message at HTTP 200. The codebase already uses `errorComponent` on three other routes; this one was never added.
- **`reprice-payment-session` restates the payment collection's amount but not its currency.** Safe only while `update-cart` is the sole writer of a cart's currency. Any future path that changes it elsewhere would produce a session that can never authorize, and every Place-order press would repeat the same refusal. One line removes the coupling.
- **Two markets settling in one currency never trigger the switch banner**, because staleness is detected by comparing currency rather than market.
- **Terminal completion refusals happen after Stripe holds funds** with `capture_method: 'manual'` and nothing releases them. Pre-existing class; this feature adds one more guard that can hit it.
- **`GET /store/products` reads the whole catalogue per request** to decide sellability. Public, unauthenticated, uncached; Postgres's 65,535 bind-parameter cap is the hard break. Acceptable at this catalogue size, not safe to leave.

## 8. Related specs

- `.scratch/store-i18n/` — Store Copy translation. Ships next and owns message catalogues, extraction and string wrapping. Its URL-shape section was corrected by this feature: it assumed English was unprefixed and that `/en-US` redirected to `/`, both of which are now false.
- `.scratch/store-translations/` — Merchant Text translation. Corrected here too: it assumed proteus had no store module, and that the routable locale set stayed static in the storefront.
- `CONTEXT.md` — the domain glossary. Its `Locale` entry claimed every Locale shows the same catalogue at the same prices, and that currency and delivery country come from the cart and address regardless of Locale. Both stopped being true; `Region` and `Market` were added as defined terms.
