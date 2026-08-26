# Store i18n — Store Copy

**Status:** not started. Ticket 01 is the spike that decides whether the rest of this holds.

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

**The URL segment is `{language}-{COUNTRY}`, and English is unprefixed.** `/` is `en-US`;
`/es-US` is Spanish. `/en-US` permanently redirects to `/` so the default has exactly one address.
The reference storefront uses this shape, and a country picker is coming, so the two-part segment
is adopted now even though country selects nothing yet — the URL is the expensive part to change
later. Country is pinned to `US` until markets exist.

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

For `en-US` the rewrite factory returns `undefined`, so `parseLocation` takes its existing fast
path and English behaviour is provably identical to today. That is what makes the string tickets
verifiable: the nine existing specs must keep passing unmodified.

**The `i18n` instance lives in router context, created per request.** `getRouter()` becomes async
and awaits the catalog. It already runs once per request on the server and once before hydration on
the client. A root-route `beforeLoad` is the obvious alternative and it is wrong — dehydrated SSR
matches skip `beforeLoad` on hydration, so the client would hydrate against an unactivated `i18n`.

**Bare `t` is banned, and the ban is a lint rule rather than a convention.** `t` from
`@lingui/core/macro` compiles to the *global* `i18n._()`. The reference project's thunk idiom
(`name: () => t\`…\``) does not save it: re-evaluating per render fixes staleness, not instance
identity. Module-scope strings use `msg` descriptors instead.

**The routable Locale set is static in the store.** `src/lib/i18n/locale.ts` owns it as a build-time
constant, because routing must be resolvable synchronously at boot on every SSR request — fetching
it would add a blocking round-trip to every render and make an unknown `/xx-YY` unanswerable until
the API replied. A named divergence from Medusa, which keeps supported locales in `store_locale`.
When the sibling feature lands, `GET /store/locales` answers "which Locales have Merchant Text
translations" and gates picker entries; it never decides which URLs exist.

**No persisted Locale preference.** The URL is authoritative. A stored Locale that contradicts it
produces the "I shared an `/es-US` link and my colleague saw English" bug.

**No `Accept-Language` negotiation.** Unprefixed URLs always serve English. Content-negotiating `/`
requires `Vary: Accept-Language`, which fragments exactly the ISR cache the product routes were
configured for; and Googlebot crawls with `Accept-Language: en` from US IPs, so auto-redirects are a
documented way to get the Spanish pages never indexed. Matches Medusa, which also has no
`Accept-Language` fallback.

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

**`deploy:static` is not supported.** `vite.config.static.ts` gets no Lingui wiring and will break
if run. Say so in the file rather than leaving it to be discovered.

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

In scope, and smaller than it looks. `formatPrice`, `formatAmount` and `getCurrencySymbol` in
`packages/ui/src/utils/pricing.ts` and the date helpers in `packages/utils/src/date.ts` all take an
optional trailing `locale = 'en-US'`, so all 15 admin call sites keep working untouched. The store
reaches them through `useFormatters()`, bound to the active tag.

Because `es-US` and `en-US` format USD identically, **the price change is plumbing with no visual
diff** and every e2e assertion on `$25.00 each` stays valid. Only dates actually move —
`5 ene 2026` rather than `Jan 5, 2026`. Details in ticket 04.

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
