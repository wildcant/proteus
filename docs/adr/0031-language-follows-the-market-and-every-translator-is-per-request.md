# 31. Language Follows the Market, and Every Translator Is Per Request

The store, the backend and the shared HTTP schemas are translated with Lingui, one catalog per workspace (`en`, `es`, source `en`). A Market carries exactly one Locale, and that Locale's language subtag picks the Message Catalog — `es-CO` reads `es`, `en-US` reads `en`. There is no language picker, no persisted language preference and no `Accept-Language` negotiation: the market's URL segment is the only input. The full Locale tag, not the catalog key, goes into `<html lang>`, `hreflang`, the `x-proteus-locale` request header and every `Intl` call, because the country is what formats money and dates (`es` alone writes European numbers; `es-CO` writes pesos).

## Considered Options

**A global `i18n` instance, activated per request.** Lingui's default. Rejected: one Worker isolate or Node process serves many requests at once, so a `/es-CO` render paused on an `await` resumes in whatever language the next request activated. The store builds one instance per router and the backend one per request; bare `t` from `@lingui/core/macro` (which compiles to the global instance) is a lint error, and `z.config` is never used for the same reason.

**A locale the server cannot see** (`localStorage`, a client-only picker). Rejected: five routes render on Cloudflare Workers behind a shared cache, so the HTML would be English and swap after hydration — a flash, a hydration mismatch on every text node, and Spanish no crawler reads.

**A `{-$locale}` path param for the market segment.** Rejected in favour of `RouterOptions.rewrite`, which leaves the route tree, every typed `to="/…"` and every e2e spec untouched, and makes `throw redirect({ to: '/login' })` inside an `/es-CO` page land on `/es-CO/login`.

**Per-language schema factories.** Rejected: the schemas stay static constants with their English message, which keeps `z.infer` types and OpenAPI generation unchanged. Messages are translated where they are shown, by one shared `translateIssue`.

## How messages are marked

- **Store:** Lingui macros — `<Trans>` in JSX, `useLingui()`'s `t` in components and hooks, `msg` for module-scope constants, and an explicit translate parameter for non-React helpers. `@proteus/ui` takes its copy as props with English defaults, so it has no Lingui dependency.
- **Backend and `@proteus/http-schemas`:** none of `tsx`, wrangler's esbuild or the Temporal webpack bundle can run macros, so messages are marked with `i18n.t('English text')` from `@proteus/utils` — a marker, not a translator. The English sentence is the message id; interpolation is ICU with separate `values`. It returns a branded `Msgid`, and `AppError.message` is typed `Msgid`, so an unmarked API Message fails `tsc`.
- **Only the response translates.** The backend's error handler takes a `Translator` port (`core/i18n/types.ts`) built from `x-proteus-locale` in each app's request `try/catch`. It is never registered in the container, so domain code cannot translate. `AppError`'s own `Error.message` stays English, so logs, Temporal workers and tests read English; `values` cross Temporal with the error so the route can still translate it.

## Consequences

- **Rewording an English string drops its translation.** The id is the sentence. `lingui compile --strict` in `pnpm run verify` fails until the new sentence is translated, and the extract and compile steps fail when a catalog is stale.
- **A market whose language has no catalog renders the default market's language**, in its own Locale's formats. The default market is the one behind the admin's `defaultRegionId`, so the fallback language is admin-controlled; Lingui's `sourceLocale` (`en`) is the last resort.
- **Merchant text is not covered.** Product titles, option values, shipping option names and similar data are translated separately, reusing `x-proteus-locale` and the `Translator`.
