# Store i18n — Store Copy

**Status:** not started. Ticket 01 is the spike that decides whether the rest of this holds.

Corrected after the markets feature shipped. Markets took the URL segment, the rewrite and the
formatters — the parts of this plan that were about *where* a Locale lives rather than about
translation — so several decisions below record what shipped instead of what was proposed. The
remaining work is the translation itself, and it is unstarted. Corrected in place rather than
re-planned: the plan is still the plan, but a reader now has to know the routing half is taken.

Scope is **Store Copy** only, in the `CONTEXT.md` sense: text the storefront itself authors.
**Merchant Text** — product titles, option values, shipping option names, API error messages — is
the sibling feature in `.scratch/store-translations/`, which follows Medusa's Store API
multi-language design. This feature ships first and establishes the Locale tag that one consumes.

## Why

`apps/store` is English-only and says so in one place — `<html lang="en">`, hardcoded in
`routes/__root.tsx`. Behind that sit roughly 250 string occurrences (~220 distinct) across 102
`.tsx` and ~37 hand-written `.ts` files, inline in components rather than centralised anywhere.
There is no i18n library in the repo at all.

A sibling project already solves this cleanly with Lingui — PO catalogs, macros only, one small
module owning locale resolution. This is a port of that pattern, onto **Lingui 6.6.0**.

Being greenfield means the v5 → v6 migration is free. What v6 gives us is peripheral rather than
architectural — native Vite 8 in the peer range, a typed `defineConfig`, extract and compile 2–4.5x
faster, `pseudoLocale` for finding unwrapped strings, and a React provider that subscribes through
`useSyncExternalStore`. **None of it changes the design below**: `t` from `@lingui/core/macro` still
compiles to the global singleton in v6, and `setupI18n()` per request is still Lingui's own
documented answer for SSR.

## The port is not literal, and the reasons are structural

That project is a pure client SPA. It keeps a **module-global `i18n` singleton**, reads the locale
from `localStorage`, and does a top-level `await loadCatalog(...)` before `createRoot`. Two parts of
that break here.

**A `localStorage` locale cannot survive SSR.** Six routes render on Cloudflare Workers, and the
product routes carry `Cache-Control: public, max-age=300, stale-while-revalidate=3600`. A locale the
server cannot see means English HTML that swaps to Spanish after hydration: a visible flash, a React
hydration mismatch on every text node, and Spanish that no crawler ever observes. ADR 0013 turned
SSR off globally *because* of `localStorage`.

**A global `i18n` bleeds locales between requests.** `createStartHandler` calls `getRouter()` once
per request, and in a workerd isolate concurrent requests interleave at every `await` in the async
stream render. A module-level `i18n.activate(locale)` is observable by another in-flight render.

So the Locale moves into the URL and the `i18n` instance becomes per-request.

## Decisions

**The URL segment is `{language}-{COUNTRY}`, and every market is prefixed.** `/en-US` is English,
`/es-CO` is Colombian Spanish, and `/` is a router rather than a page: it resolves a market, then
redirects to that market's prefix and never renders. The default is spelled the same way as every
other market, so nothing downstream has to remember that one of them is written differently.

The two-part segment shape was adopted here for a country picker that had not been built yet.
Markets shipped first and took the segment: it now carries the market's Locale, one per sellable
country, rather than a language with `US` pinned behind it. So a second *language* inside one
market has no address yet — `es-US` alongside `en-US` is not a second market, and which of the two
owns the segment is the open question this feature has to answer before it starts.

**The country part is load-bearing for formatting, not just for future markets.** Verified: bare
`es` resolves to European conventions — `Intl.NumberFormat('es').format(1234.56)` is `1234,56`, and
USD renders `1234,56 US$`. `es-US` gives `$1,234.56`, byte-identical to `en-US`. Shipping `/es`
and later passing `i18n.locale` to `Intl` would silently have made a US store's prices European.

**A Message Catalog is keyed by language, the Locale tag by URL.** `lingui.config.ts` declares
`locales: ['en','es']` → `en.po`, `es.po`. The app carries two values: `language` picks the
catalog, `tag` (`es-US`) goes in `<html lang>`, `hreflang` and every `Intl` call. `es-MX` later
reuses `es.po` with no new translation work, which is the whole point of the two-part URL.

**Carried by `RouterOptions.rewrite`, not by an optional path param.** `{-$locale}` exists in the
installed router and is the framework's advertised i18n pattern, but it would mean moving all 23
route files, regenerating every id in `routeTree.gen.ts`, and rewriting 54 typed `to="/…"` call
sites. It would also break all nine e2e specs at typecheck, because `tests/setup/test-extend.ts`
types its `navigate` fixture as `createTest<FileRouteTypes['to']>()` and `tsconfig.json` includes
`tests/`.

`rewrite` splits the URL the browser shows from the URL the router matches. Route files, the
generated tree and `FileRouteTypes['to']` are untouched. `<Link>` renders `publicHref`, history
commits it, and `resolveRedirect` sets `Location` from it — so `throw redirect({ to: '/login' })`
inside an `/es-US` page lands on `/es-US/login` with no change at the throw site.

The rewrite shipped with markets, in `src/router.tsx`, and it prefixes every market including the
default — the "no rewrite for `en-US`" fast path this section originally rested on is gone. English
is therefore no longer a provably untouched code path, and the e2e suite was updated for the
prefix rather than kept unmodified. The string tickets need a different acceptance argument than
"the nine existing specs pass unchanged".

**The `i18n` instance lives in router context, created per request.** `getRouter()` becomes async
and awaits the catalog. It already runs once per request on the server and once before hydration on
the client. A root-route `beforeLoad` is the obvious alternative and it is wrong — dehydrated SSR
matches skip `beforeLoad` on hydration, so the client would hydrate against an unactivated `i18n`.

**Bare `t` is banned, and the ban is a lint rule rather than a convention.** `t` from
`@lingui/core/macro` compiles to the *global* `i18n._()`. The reference project's thunk idiom
(`name: () => t\`…\``) does not save it: re-evaluating per render fixes staleness, not instance
identity. Module-scope strings use `msg` descriptors instead.

**The routable set is fetched, not compiled in.** This section originally decided the opposite —
`src/lib/i18n/locale.ts` owning a build-time `LOCALES` constant, on the reasoning that routing must
resolve synchronously at boot. Markets overturned it: the routable segments are exactly the
countries the store sells to, and adding one must not need a storefront release. So
`src/lib/sellable-markets.ts` reads them from `GET /store/countries` and caches the answer per
server instance, the client reads what the server already resolved out of the document, and a
compiled-in default market is what an unreachable backend falls back to. Not a per-render
round-trip, which is what the original reasoning was actually guarding against.

When the sibling feature lands, `GET /store/locales` answers "which Locales have Merchant Text
translations" and gates picker entries; it still does not decide which URLs exist.

**No persisted Locale preference.** The URL is authoritative. A stored Locale that contradicts it
produces the "I shared an `/es-US` link and my colleague saw English" bug.

The market, as distinct from the Locale, *is* persisted — a cookie written when a market is
resolved from the URL, and read only when the URL carries no market segment at all. That does not
weaken the rule above: a prefixed link always renders its own market, and the cookie only decides
where `/` sends a returning shopper.

**No `Accept-Language` negotiation.** Content-negotiating an unprefixed URL requires
`Vary: Accept-Language`, which fragments exactly the ISR cache the product routes were configured
for; and Googlebot crawls with `Accept-Language: en` from US IPs, so auto-redirects are a documented
way to get the Spanish pages never indexed. Matches Medusa, which also has no `Accept-Language`
fallback. The decision stands; what has changed is that there are no unprefixed URLs left to
negotiate — `/` resolves its market from the cookie, or from the store default, and never from a
header.

**Unknown segments 404.** `/fr-FR/products` matches nothing. Silently stripping it would create
duplicate content at unbounded URLs.

**No feature flag, no gated rollout.** With `sourceLocale: 'en'`, a missing Spanish translation
renders the English default automatically. A half-translated `/es-US` is therefore safe, and the
store is pre-launch. This is also why `lingui compile --strict` is **not** in the gate — it fails on
any missing translation, which would block the incremental approach on purpose.

**Spanish is informal *tú*, neutral Latin-American vocabulary.** "Inicia sesión", "Tu carrito",
"¿Olvidaste tu contraseña?". `es-US` targets US Hispanic shoppers, the reference storefront is
informal, and `.scratch/store-design-system/spec.md` already settled on warm first-person English
("Join us" over "Sign up"). Peninsular vocabulary is avoided: "carrito" not "cesta".

**Translations are written per string ticket and reviewed before merge.** The risk across four
separately-landed tickets is tone drift, not mistranslation — commerce copy is short and highly
patterned. Reviewing the `.po` diff is what keeps 220 messages sounding like one voice.

## Structure

The runtime lives in `src/lib/i18n/`, a shared layer. Not `src/features/i18n/` — dependency-cruiser's
`feature-graph-undeclared` rule blocks an unmodelled feature directory from importing declared
features, and ADR 0020 is explicit that a thing two features both need was never feature-specific.

| File | What it owns |
|---|---|
| `locale.ts` | `LOCALES`, `Locale`, `DEFAULT_LOCALE`, `isLocale`, `splitLocale`, `localePath` — pure |
| `locale-rewrite.ts` | `createLocaleRewrite(locale)`, returning `undefined` for the default |
| `resolve-locale.ts` | `resolveLocale` — `createIsomorphicFn()`, `window.location` / `getRequest()` |
| `catalogs.ts` | `createI18n(locale)` — `setupI18n()` then `loadAndActivate`, never a singleton |
| `i18n-provider.tsx` | `I18nRouterProvider`, the router's `InnerWrap` |
| `use-formatters.ts` | `useFormatters()` — price and date helpers bound to the active tag |
| `zod-locale.ts` | `applyZodLocale` — client-only `z.config({ localeError })` |
| `validation-messages.ts` | the English-string → `MessageDescriptor` table |

Four of those rows now describe something that exists, built for markets rather than for Lingui and
living in `src/lib/` rather than `src/lib/i18n/`. `market.ts` holds the pure parsing and joining
(`splitMarketSegment`, `joinMarketSegment`, `marketHref`), `sellable-markets.ts` holds the routable
set — fetched, not a `LOCALES` constant — `router.tsx` holds the rewrite itself, prefixing every
market rather than returning `undefined` for the default, and `use-formatters.ts` shipped bound to
the market's Locale. The first three rows are therefore not net-new work; what this ticket has to
settle is how a language sits inside a structure the market already owns.

A Locale is a record of `{ tag, language, country }`, not a bare string, and `LOCALES` is a typed
array rather than an object keyed by tag: `useNamingConvention` allows only
`camelCase | PascalCase | CONSTANT_CASE` for object literal properties, so `{ 'es-US': … }` is a
lint failure, and `warn` fails the gate under `--error-on-warnings`.

`InnerWrap`, not `Wrap`: `Wrap` renders outside `routerContext.Provider`, so `useRouter()` is
unavailable inside it. `InnerWrap` renders inside the provider and still above the root match,
which is where `shellComponent` lives — so it can both read context and wrap `<html lang>`.

## The macro rule

| Situation | Use |
|---|---|
| JSX text | `<Trans>` from `@lingui/react/macro` |
| A string inside a component or hook | `const { t } = useLingui()` from `@lingui/react/macro` |
| Module-scope constants | `msg` from `@lingui/core/macro`, resolved at the use site with `i18n._(d)` |
| A non-React helper that must return a string | take `i18n: I18n` as an explicit parameter |
| Bare `t` from `@lingui/core/macro` | never — lint error |

Route `head()` is not the exception it looks like: it receives `match.context`, so it reaches the
per-request instance directly, and `executeHead` re-runs on every `loadMatches` so canonical and
`hreflang` stay correct across client navigation. The 21 `toast.*` call sites are likewise fine —
all of them are already inside `use*` hooks or components.

## Formatting

Already done, by markets. `formatPrice`, `formatAmount` and `getCurrencySymbol` in
`packages/ui/src/utils/pricing.ts` and the date helpers in `packages/utils/src/date.ts` take an
optional trailing locale, so all the admin call sites keep working untouched, and the store reaches
them through `apps/store/src/lib/use-formatters.ts`, bound to the market's Locale.

What is left is one line of that hook: swapping the market's Locale for the active i18n tag, once
there is a tag that can differ from it. Details in ticket 04.

## Out of scope

**Merchant Text.** Product titles, subtitles and descriptions; Product Option titles and values;
Variant Titles; shipping option names; payment provider labels; and API error messages
(`src/api/fetcher.ts:57` throws `new Error(body?.message ?? …)`, rendered in ~10 inline form-error
spots and ~15 toasts). This is the whole subject of `.scratch/store-translations/`.

Ticket 09 translates the store-authored toast *title* and leaves the server-authored *description*
in English; the mixed-language toast is a recorded interim state.

**Order confirmation emails.** They belong with Merchant Text — the locale has to be persisted on
the cart and copied to the order before a subscriber can pick a template. Medusa's notification
module has no locale column either; language selection is the subscriber's job, reading
`order.locale`.

**The PWA manifest.** `apps/store/public/manifest.json` is stale scaffold — `"TanStack App"`,
`"Create TanStack App Sample"`. It needs fixing, but as a naming bug, not as i18n.

**A third Locale.** `es-MX` would reuse `es.po` and need only a `LOCALES` entry and a picker option.
A new *language* needs a new catalog and a translator.

## Tickets

`01` → `02` → `03` is a hard chain. `04` depends only on `01`. `05`–`08` depend on `01`, and all
regenerate the catalogs, so they land one at a time with a re-extract after each merge. `09` lands
last.

| # | Title |
|---|---|
| 01 | i18n runtime and build wiring |
| 02 | Locale prefix routing and SEO head |
| 03 | Locale and country pickers |
| 04 | Locale-aware formatting |
| 05 | Strings: global chrome |
| 06 | Strings: catalogue and product |
| 07 | Strings: cart and checkout |
| 08 | Strings: auth, account, addresses, orders |
| 09 | Validation copy and guardrails |

The decisions above are distilled into `docs/adr/0021-store-locale-is-a-url-rewrite.md` in ticket 09.
