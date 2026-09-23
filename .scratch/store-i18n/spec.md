# Store i18n — Store Copy and API Messages

**Status:** not started. Designed, and every load-bearing assumption is proven — see **Proven**.
One naming decision is open at the end.

## Scope

Three kinds of text, each translated where it is authored:

- **Store Copy** — text the storefront itself authors, in `apps/store`.
- **Validation messages** — the messages in `@proteus/http-schemas`, shared by the store, the
  backend and the admin, and Zod's own default messages.
- **API Messages** — every `AppError` message the backend returns, all of them, admin-only ones
  included. No partial migration: admin translations land right after this and reuse the backend
  catalog as it stands.

Plus one markets change it depends on: the default market comes from the store's
`defaultRegionId` instead of a compiled-in constant.

Out of scope is the rest of **Merchant Text** — product titles, option values, shipping option
names, payment provider labels — which is `.scratch/store-translations/`.

## Why

`apps/store` renders every page in English, in every market. Markets already route, price and
format per Locale — `/es-CO` is quoted in COP, formatted `$ 1.234`, and carries
`<html lang="es-CO">` — but every label, heading, button and error on that page is English. The
copy is inline across 139 `.tsx` and 57 hand-written `.ts` files in the store, 220 `new AppError`
sites across 97 backend files, and the schema messages in `@proteus/http-schemas`. There is no i18n
library in the repo.

The library is **Lingui 6** (6.8.0 at time of writing; pin whatever is current when work starts):
PO catalogs, macros in the store, and its non-macro runtime API in the backend and the shared
schemas.

## What markets already provide

| Concern | Where it lives |
|---|---|
| Market record, segment parsing and joining, market cookie | `apps/store/src/lib/market.ts` |
| Routable set, from `GET /store/countries?scope=sellable`, cached per server instance | `apps/store/src/api/sellable-markets.ts` |
| The URL rewrite, prefixing every market including the default | `apps/store/src/router.tsx` |
| `/` as a redirect, the market cookie, `Vary: Cookie` | `apps/store/src/start.ts` — `marketMiddleware` |
| `<html lang>` from the market's `localeCode` | `apps/store/src/routes/__root.tsx` |
| Price and date formatting bound to the market's `localeCode` | `apps/store/src/hooks/use-formatters.ts` over `packages/utils/src/{pricing,date}.ts` |
| The market control | `apps/store/src/components/market-select.tsx`, `apps/store/src/features/cart/components/cart-market-switch.tsx` |

Two markets ship, seeded in `apps/backend/scripts/seed/markets.ts`: the United States (`en-US`,
USD) and Colombia (`es-CO`, COP). Switching market is a document navigation that builds a new
router (`apps/store/src/hooks/use-market.ts`), so neither the market nor its language ever changes
under a mounted component.

## Decisions

### Language follows the market

**The market's Locale picks the Message Catalog.** A Market carries exactly one Locale; its
language subtag names the catalog — `es-CO` → `es`, `en-US` → `en`. There is no language picker and
no second language inside one market. A later `es-MX` market reuses `es` with no new translation
work; a new *language* needs a new catalog and a translator.

**A market whose language has no catalog renders the default market's language**, formatted in its
own Locale. The default market is the one the admin configures (below), so the fallback language is
admin-controlled. If that language has no catalog either, Lingui's `sourceLocale` (`en`) renders.

**The Locale tag and the catalog key are different values.** `language` picks the catalog; the full
tag goes in `<html lang>`, `hreflang`, `x-proteus-locale` and every `Intl` call. The country part is
load-bearing for formatting: bare `es` resolves to European conventions —
`Intl.NumberFormat('es').format(1234.56)` is `1234,56` — while `es-CO` formats COP as `$ 1.234`.

### The default market comes from `defaultRegionId`

Today `DEFAULT_MARKET` (`en-US`) is compiled into `apps/store/src/lib/market.ts`, and
`sellable-markets.ts` throws when the backend does not sell in it. The admin already edits
`store.defaultRegionId` (`apps/admin/src/features/store/components/edit-store-form.tsx`), and the
backend's pricing middleware already falls back to it (`apps/backend/src/api/store/middlewares.ts`).

The default market becomes the sellable country behind `defaultRegionId` — the first by
`displayName` when that Region covers several — returned by `GET /store/countries?scope=sellable`
alongside the routable set. Every seeded Region covers one country today; a `store.defaultCountry`
is added only when a multi-country default Region exists to design it against. `/` redirects there
when no cookie applies, and both the store's and the backend's language fallback use its language. The
compiled-in `DEFAULT_MARKET` stays only as the answer when the backend is unreachable, and the
"does not sell in its default market" throw goes.

### Why every `i18n` instance is per request, never global

One Worker isolate — or one Node process — serves many requests at once and shares module-level
objects between them. With a global instance: a `/es-CO` request activates `es` and pauses on an
`await`; an `/en-US` request activates `en` on the same object; the first render resumes in
English. So there is no shared instance anywhere: the store creates one per router, the backend one
per request. Lingui's own server-rendering guidance is the same.

A locale kept anywhere the server cannot see (such as `localStorage`) is also out: five routes
render on Cloudflare Workers (`__root`, `_main/route`, `_main/index`, `_main/products/route`,
`_main/products/$productId`) and the product routes carry
`Cache-Control: public, max-age=300, stale-while-revalidate=3600`, so a server-invisible locale
means English HTML that swaps language after hydration — a flash, a hydration mismatch on every
text node, and Spanish no crawler observes.

### The URL, preference and negotiation rules

**The URL segment is the market's Locale, and every market is prefixed.** Shipped with markets,
carried by `RouterOptions.rewrite` rather than a `{-$locale}` path param — the path param would
move all 27 route files, regenerate every id in `routeTree.gen.ts`, rewrite ~58 typed `to="/…"`
call sites, and break every e2e spec at typecheck through `tests/setup/test-extend.ts`'s
`createTest<FileRouteTypes['to']>()`. With `rewrite`, `throw redirect({ to: '/login' })` inside an
`/es-CO` page lands on `/es-CO/login` with no change at the throw site.

**No persisted Locale preference.** The URL is authoritative. The market cookie is not a Locale
preference: it is read only when the URL carries no market segment, so it decides where `/` sends a
returning shopper and never overrides a prefixed link.

**No `Accept-Language` negotiation.** There are no unprefixed pages left to negotiate. Redirecting
on the header would also hide the Spanish pages from Googlebot, which crawls with
`Accept-Language: en` from US IPs. The planned first-visit default is geo-IP instead (ILLO-46:
URL segment → cookie → `request.cf.country` → default market), which only changes which prefixed
URL `/` redirects to. Matches Medusa, which has no `Accept-Language` fallback either.

**Unknown segments 404.** `/fr-FR/products` matches nothing (`looksLikeMarketSegment`).

### SEO head

Every server-rendered page's `head()` declares, from `match.context`:

- **Canonical** — the page's own URL, so `/en-US/products/shirt` and `/es-CO/products/shirt` are
  two pages, not duplicates.
- **`hreflang` alternates** — one per sellable market, pointing at the same path under that
  market's segment, so search results send each shopper to their language's URL.
- **`x-default`** — `/`, so anyone matching no alternate goes through the redirect (cookie, later
  geo-IP) rather than being pinned to `/en-US`.

`executeHead` re-runs on every `loadMatches`, so these stay correct across client navigation.

## The store

### Build wiring

`@vitejs/plugin-react` 6 has no Babel, so macros are transformed by `@rolldown/plugin-babel` with
Lingui's preset, beside `@lingui/vite-plugin`, which compiles `.po` imports:

```ts
// apps/store/vite.config.ts — added after viteReact()
lingui(),
babel({ presets: [linguiTransformerBabelPreset()] }),
```

`src/po.d.ts` declares `*.po` modules (`export const messages: Messages`) so the dynamic imports
typecheck.

### One catalog, loaded before the router exists

The rewrite's `input` discovers the market, but it runs only once the router has a history — on the
server, Start attaches the request's history after `getRouter()` returns
(`router-core` `updateLatestLocation`). So `getRouter()` cannot wait for "the catalog of the market
the rewrite found".

Instead `getRouter()` resolves the market itself first. An isomorphic `currentUrl()` reads
`getRequest().url` on the server and `window.location` on the client, and the same
`splitMarketSegment` the rewrite uses picks the market. `getRouter()` then dynamically imports that
one language's `.po`, creates the instance with `setupI18n()`, and hands it to the router's
`InnerWrap`:

```tsx
const early = splitMarketSegment(currentUrl().pathname, markets)
const i18n = await createI18n(languageOf(early?.market ?? defaultMarket))
// …
InnerWrap: ({ children }) => <I18nProvider i18n={i18n}>{children}</I18nProvider>,
```

Both parse with one pure function, so they cannot disagree. Each language is its own chunk, and a
page fetches only its own.

`InnerWrap`, not `Wrap`: `Wrap` renders outside `routerContext.Provider`; `InnerWrap` renders
inside it and above the root match, where `shellComponent` (`RootDocument`) lives. A root-route
`beforeLoad` is the wrong home for the instance: dehydrated SSR matches skip `beforeLoad` on
hydration, so the client would hydrate against an unactivated instance.

### The macro rule

| Situation | Use |
|---|---|
| JSX text | `<Trans>` from `@lingui/react/macro` |
| A string inside a component or hook | `const { t } = useLingui()` from `@lingui/react/macro` |
| Module-scope constants | `msg` from `@lingui/core/macro`, translated at the use site with `useLingui`'s `t(descriptor)` |
| A non-React helper that must return a string | take the translate function as an explicit parameter |
| Bare `t` from `@lingui/core/macro` | never — lint error |

```tsx
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'

const footerColumns = [{ title: msg`Shop`, links: [/* … */] }]

export function Footer() {
  const { t } = useLingui()
  const year = new Date().getFullYear()
  return (
    <footer>
      {footerColumns.map((column) => <h3 key={column.title.id}>{t(column.title)}</h3>)}
      <p><Trans>&copy; {year} Proteus. All rights reserved.</Trans></p>
    </footer>
  )
}
```

Bare `t` from `@lingui/core/macro` compiles to Lingui's *global* instance, so it is the one import
that is unsafe here. Biome's `noRestrictedImports` bans it (`importNames: ['t']` on
`@lingui/core/macro`) in the apps that use macros. Re-evaluating it inside a thunk
(`name: () => t\`…\``) does not help: that fixes staleness, not instance identity.

Route `head()` receives `match.context` and reaches the per-request instance directly. The 22
`toast.*` call sites are already inside hooks or components. `customerMessageForStripeError` and
its message constants (`apps/store/src/features/checkout/utils/payment/adapters/stripe/errors.ts`)
take the translate function as a parameter.

Store components never import the backend/schema marker (below): `useLingui()` already returns an
`i18n` whose `.t()` translates on the spot, and two things named `i18n.t` in one file would read
the same and do different things.

**Stripe Elements gets the active Locale.** The Stripe adapter passes no `locale` today, so the card
form follows the browser's language rather than the page's. Stripe's own `error.message`, passed
through for card and validation errors, follows the same setting.

### `@proteus/ui` takes its copy as props

The store renders shared components that carry English: `RouteDrawer` and `Sheet` (sr-only
"Close"), `toast` ("Close toast"), `Prompt` (`cancelText = 'Cancel'`, `confirmText = 'Confirm'`).
Each takes its copy as `children` or label props, with today's English as the default, so the admin
keeps working untouched and `@proteus/ui` takes no Lingui dependency.

## The backend and the shared schemas

### The marker: `i18n.t()`, the English text is the ID

The backend runs every process on `tsx` (esbuild, no Babel/SWC plugin hook) and deploys to workerd
through wrangler's esbuild; its workflow bundle is webpack
(`apps/backend/src/framework/workflows/temporal/worker.ts`); `@proteus/http-schemas` is loaded by
all of them. None can run Lingui macros without replacing that tooling, so they mark messages with
a function the extractor recognises by name:

```ts
// packages/utils/src/i18n.ts — a marker, not a translator: it tags the English text for extraction
declare const brand: unique symbol
export type Msgid = string & { [brand]: true }
export const i18n = { t: (id: string) => id as Msgid }
```

`lingui extract` matches `i18n.t(…)` / `i18n._(…)` calls by name without checking where `i18n`
comes from, so every `i18n.t('literal')` lands in the catalog with the English sentence as its
`msgid`. Interpolation is ICU (`{id}`), with values passed separately:

```ts
// schemas
password: z.string().min(1, i18n.t('Enter your password')),
note: z.string().max(280, i18n.t('Keep it under {maximum} characters')),

// backend
throw new AppError({ type, message: i18n.t('Product {id} was not found'), values: { id } })
```

Template-literal messages today (e.g. `apps/backend/src/api/admin/store/route.ts:65`) become ICU
plus `values`. Rewording a sentence changes its ID and so drops its translation; the strict gate
reports it as missing.

The marker returns a branded **string**, so Zod accepts it unchanged, and `AppError` types
`message` as `Msgid`, so an unwrapped `AppError` message is a `tsc` error — all 220 sites are
enforced by the type checker. Zod's own signatures take plain `string`, so schemas are covered by
the lint rule in **The gate** instead.

The marker lives in `@proteus/utils` because it is pure and everything that marks messages already
imports that package — `core/` included.

### Shared schemas stay static and translate at display

Schemas are plain constants, exactly as today, with `i18n.t()` on every message. There are no
per-language factories: shared primitives (`bounded.ts:100` `'Invalid amount'`, `common.ts:33,38`
`'Invalid numeric value'`) stay primitives, the 107 exported `z.infer` types stay as they are, and
OpenAPI generation reads the one English schema it always has.

Translation happens where an issue is shown, by one shared function:

```ts
// packages/http-schemas/src/i18n.ts
export function translateIssue(issue: $ZodIssue, translate: Translate, zodLocale: ZodLocale): string {
  // Our message: its English text is a catalog id; placeholders come from the issue's own fields.
  if (isCatalogMessage(issue.message)) return translate(issue.message, { ...issue })
  // Zod's own default: re-rendered from the issue in the request's language.
  return renderZodDefault(zodLocale.localeError(issue)) ?? issue.message
}
```

- **Store:** the form fields (`apps/store/src/components/form/text-field.tsx` and the three other
  `FieldError` call sites) translate `field.state.meta.errors` before passing them down. TanStack
  Form validates through Standard Schema, which takes no per-parse options, so display time is the
  only place this can happen — and it is the same place for client and server.
- **Backend:** request validation raises an `AppError` carrying the raw Zod issues rather than a
  pre-formatted string, and the error handler translates each one. `format-zod-issues.ts` stops
  building final text.
- **`z.config` is never used** — it is global and would bleed between requests exactly as a global
  `i18n` would.

**Every field a shopper can reach carries an explicit message.** Zod's bundled Spanish reads badly
("Inválido dirección de correo electrónico"), so `z.locales` is only the fallback for fields no
shopper sees. `store/auth/payloads.ts` already sets its messages explicitly for the same reason in
English.

### The `Translator` port and its Lingui adapter

`errorHandler` lives in `core/errors/error-handler.ts`, and `core/` never imports a library, so the
error handler translates through a port:

```ts
// apps/backend/src/core/i18n/types.ts
export type Translator = {
  locale: string
  translate: (message: Msgid, values?: Record<string, unknown>) => string
}
```

- **Adapter:** `apps/backend/src/framework/i18n/lingui-translator.ts` — `setupI18n()` per call over
  the committed compiled catalogs (the backend's own plus `@proteus/http-schemas`'). A noop adapter
  that fills values into the English message serves tests, like `core/logger/noop-logger.ts`.
- **Per request, not in the container.** Both apps already wrap every route in the same
  `try/catch` (`framework/runtime/hono/app.ts:99` on workerd, `express/app.ts:105` on node) with
  the request headers in hand. Each builds the `Translator` from `x-proteus-locale` there and passes
  it in: `errorHandler(error, logger, translator)`. Registering it in the request scope would let
  any module service resolve it and translate inside domain code; the rule is that only the
  response translates.
- **The method is `translate`, not `t`,** so `translator.translate(error.message)` is never mistaken
  for a marker by the extractor, and a literal `i18n.t('…')` always means "mark this".
- **Fallback language** — no header, or a language without a catalog — is the default market's
  language, read from the store module and cached per server instance with a TTL, the same shape as
  `apps/store/src/api/sellable-markets.ts`. `errorHandler` stays synchronous.
- **`AppError` carries `message: Msgid` and `values`.** Its `Error.message` is the English sentence
  with values filled in, so logs, Temporal workers and tests keep reading English. Workers never
  translate — they have no request to take a Locale from.
- **Temporal:** every `AppError` thrown inside a workflow step crosses Temporal, not only the ones
  raised in `workflows/`. `framework/temporal/failures.ts` already carries `type` and `code` through
  `serializeError` / `deserializeError`; it carries `values` too, so the error handler rebuilds a
  translatable error. A round-trip test throws in a step and expects a Spanish response from the
  route. There is no fallback for failures missing `values`: pre-launch, no such history exists.

`ApiError` in the store is unchanged — its `message` arrives translated. `code` stays for program
logic (payment branching in `session-errors.ts`), not for copy.

### The locale header

`apps/store/src/api/fetcher.ts` sends `x-proteus-locale: <market localeCode>` on every request. The
admin sends it once admin translations land. `.scratch/store-translations/` reuses the same header
and the same fallback.

## Catalogs, development and the gate

**One catalog per workspace**, each with its own `lingui.config.ts`, extracted from its own source,
`locales: ['en', 'es']`, `sourceLocale: 'en'`:

| Workspace | Catalog | How it is loaded |
|---|---|---|
| `apps/store` | `src/locales/{en,es}.po` | `.po` imported through `@lingui/vite-plugin`; only `.po` committed |
| `apps/backend` | `locales/{en,es}.po` + compiled `locales/{en,es}.ts` | compiled `.ts` imported by the adapter; both committed |
| `packages/http-schemas` | `locales/{en,es}.po` + compiled `locales/{en,es}.ts` | compiled `.ts` exported as `@proteus/http-schemas/locales/{language}`, merged next to their own by the store, the backend and the admin |

Compiled output is committed wherever Vite is not the loader: the backend cannot import `.po`
under `tsx`, and wrangler bundles plain modules with no filesystem at runtime. The store never loads
the backend catalog — API Messages arrive already translated.

**Development:**

- editing a store `.po` hot-reloads through the Vite plugin — no restart;
- `lingui extract --watch` runs beside `pnpm --filter store run dev`, so a newly wrapped string
  reaches the catalogs with no manual step;
- `lingui compile --typescript --watch` runs beside the backend's `dev` and `worker:*:dev` scripts
  and for `http-schemas`, so a `.po` edit recompiles and `tsx watch` reloads.

**The gate.** `pnpm run verify` fails, in each workspace, when:

| Mistake | Caught by |
|---|---|
| A schema message not wrapped in `i18n.t()` | `check:standards` — ast-grep rule in `standards/rules/http-schemas/`, with rule-tests: a string literal (or `{ error: '…' }` / `{ message: '…' }`) as the message argument of `.min/.max/.length/.regex/.refine/.gt/.gte/.lt/.lte/.multipleOf` |
| An `AppError` message not wrapped | `tsc` — `message: Msgid` |
| Wrapped but never extracted | `lingui extract`, then fail if any `.po` changed |
| Compiled catalog stale | `lingui compile`, then fail if any compiled `.ts` changed |
| Extracted but not translated | `lingui compile --strict` |

Strict is safe for incremental work because each change translates what it wraps; a string that is
still unwrapped is not in any catalog.

## Copy rules

**Spanish is informal *tú*, neutral Latin-American vocabulary.** "Inicia sesión", "Tu carrito",
"¿Olvidaste tu contraseña?". Colombia is the only Spanish market, and neutral vocabulary lets a
later Latin-American market reuse `es` unchanged. The reference storefront is informal, and
`.scratch/store-design-system/spec.md` settled on warm first-person English ("Join us" over
"Sign up"). Peninsular vocabulary is avoided: "carrito" not "cesta". API Messages and validation
messages follow the same voice.

**Translations are written with the change that wraps them and reviewed as a `.po` diff.** The
builder writes `es.po` in the same change; agent review of that diff against these rules is the
review, with no named human reviewer. The risk across separately-landed changes is tone drift, not
mistranslation, and these rules are what the review checks.

## Structure

| File | What it owns |
|---|---|
| `packages/utils/src/i18n.ts` | `Msgid`, the `i18n.t()` marker |
| `packages/http-schemas/src/i18n.ts` | `translateIssue`, the `z.locales` selection |
| `packages/http-schemas/lingui.config.ts`, `locales/` | the schemas catalog |
| `apps/store/src/lib/i18n/resolve-market.ts` | `currentUrl()`, the isomorphic pre-router read |
| `apps/store/src/lib/i18n/catalogs.ts` | `createI18n(language)` — dynamic `.po` import, `setupI18n()`; never a singleton |
| `apps/store/src/po.d.ts` | the `*.po` module declaration |
| `apps/backend/src/core/i18n/types.ts` | the `Translator` port |
| `apps/backend/src/framework/i18n/lingui-translator.ts` | the Lingui adapter and the noop adapter |
| `apps/backend/src/framework/runtime/{hono,express}/app.ts` | build the `Translator` from `x-proteus-locale`, pass it to `errorHandler` |
| `apps/backend/src/framework/temporal/failures.ts` | `values` across the Temporal boundary |

The store runtime is a shared layer in `src/lib/i18n/`, not `src/features/i18n/` —
dependency-cruiser's `feature-graph-undeclared` rule blocks an unmodelled feature directory from
importing declared features, and ADR 0020 is explicit that a thing two features both need was never
feature-specific. Locale parsing, the routable set and the rewrite stay where markets put them.

## Proven

Checked with throwaway code on 2026-09-23 against the versions the repo uses (Lingui 6.8.0, Zod
4.4.3, zod-to-openapi 8.5.0, wrangler 4.131.1, TanStack Start 1.168, Vite 8,
`@vitejs/plugin-react` 6):

- **Non-macro extraction.** `i18n.t('literal')` and `i18n._('literal')` from any object named
  `i18n` — including a local marker — are extracted with the English sentence as `msgid` and
  `msgstr`, ICU placeholders intact.
- **`Msgid` brand.** A bare string passed where `Msgid` is required fails `tsc` (`TS2322`).
- **Static schemas at display.** Concurrent `en` and `es` parses of one schema instance translate
  correctly; `{maximum}` fills from the issue; Zod defaults re-render through
  `z.locales.es().localeError(issue)` on the Standard Schema path TanStack Form uses. A per-parse
  error map does *not* override a schema-level message, which is why translation is at display.
- **OpenAPI.** Messages never reach the document. (Registering two instances under one
  `.openapi('Name')` does not error either — it collapses to one component — but static schemas
  make that moot.)
- **Gate behaviour.** A blank translation fails `lingui compile --strict` (exit 1, "Missing 1
  translation(s)"); a marked-but-unextracted message passes strict and is caught only by the
  extract-changes-catalog check; ast-grep flags `.min(1, 'literal')`, `.regex(re, 'literal')`,
  `.refine(fn, 'literal')` and passes marked ones — on today's `http-schemas` it lists all 16
  unmarked messages. The object form (`{ error: 'literal' }`) needs its own pattern.
- **`lingui compile --watch`** recompiles the `.ts` catalog on a `.po` edit.
- **workerd.** A wrangler worker using `@lingui/core` over committed compiled catalogs, one
  `Translator` per request with an `await` between creation and use: six interleaved requests
  (`es-CO`, `en-US`, `es-MX`, `fr-FR`) each got their own language, `fr` falling back.
- **Store SSR.** With the build wiring above: `/es-CO` server-renders `Tienda`, `Abrir menú` and
  `© 2026 Proteus. Todos los derechos reservados.` (`msg` + `t(descriptor)`, `useLingui` `t`, and
  `<Trans>` with interpolation); 40 of 40 concurrent `es-CO`/`en-US` requests rendered the right
  language; hydration in Chromium logged no mismatch and the client kept the server's language; each
  page fetched only its own catalog chunk; editing `es.po` showed on the next request with no
  restart; `vite build` succeeds with `es` as its own chunk on client and server.

## Acceptance

- every existing e2e spec stays green under `/en-US` — the English source strings are the English
  UI, so a changed assertion means a changed string;
- a journey in `apps/store/tests/e2e/markets.spec.ts` asserts Spanish on `/es-CO` for each
  translated surface, including a validation message and an API Message (wrong password on login);
- an SSR render of `/es-CO` hydrates with no mismatch;
- the Temporal round-trip test returns a Spanish API Message for an error thrown inside a step;
- `verify` passes every row of **The gate** in all three workspaces.

## Out of scope

**The rest of Merchant Text** — product titles, subtitles and descriptions; Product Option titles
and values; Variant Titles; shipping option names; payment provider labels. That is
`.scratch/store-translations/`, which reuses `x-proteus-locale` and the `Translator` from this spec.

**Admin UI copy.** Lands right after, on the same pattern, with the backend and schema catalogs
already complete.

**Order confirmation emails.** They need the locale persisted on the cart and copied to the order
before a subscriber can pick a template — that is the sibling feature. Note for it:
`apps/backend/src/workflows/notification/utils/prepare-order-confirmation-data.ts` formats every
order amount with a hardcoded `'en-US'`.

**The PWA manifest.** `apps/store/public/manifest.json` is stale scaffold — `"TanStack App"`,
`"Create TanStack App Sample"`. A naming bug, not i18n.

## Open

1. **Compiled catalog file names.** Lingui writes `locales/{language}.ts`. The repo convention for
   generated, never-hand-edited files is `.gen.ts`; either rename through the catalog `path` or
   accept Lingui's names with its generated-file header.

The decisions above are distilled into a new ADR once built, numbered at the time it is written
(0030 is the latest today).
