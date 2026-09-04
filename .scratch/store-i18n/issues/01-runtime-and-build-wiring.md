# 01 — i18n runtime and build wiring

Everything else depends on this, and this is also the ticket most likely to fail. **No strings are
wrapped here.** The deliverable is Lingui installed, an `i18n` instance flowing through router
context on both server and client, and empty catalogs that extract cleanly — with the app looking
exactly as it does today.

Treat it as a spike with a fallback, not a foregone conclusion. See *Risk* below.

## Dependencies

**Lingui 6.6.0**, the current line. We are greenfield, so none of the v5 → v6 migration applies to
us — no catalogs to re-encode, no deprecated APIs to unwind.

```
deps:     @lingui/core@^6.6.0  @lingui/react@^6.6.0
devDeps:  @lingui/cli@^6.6.0  @lingui/vite-plugin@^6.6.0
          @lingui/babel-plugin-lingui-macro@^6.6.0  @lingui/format-po@^6.6.0
```

`@lingui/format-po` is new to the dep list: v6 removed the string-based `format: 'po'` config in
favour of importing the formatter directly.

Not `@lingui/macro` — that is the v4 package, unmaintained; the macros are entry points of core and
react. Not `babel-plugin-macros` — v6 deprecated that integration path in favour of the standalone
plugin, which is also what `lingui extract` uses internally.

`@lingui/vite-plugin@6.6.0` declares `vite: '^6.3.0 || ^7 || ^8'`, so Vite 8 is natively in range.
Its `rolldown`, `@rolldown/plugin-babel` and `@babel/core` peers are all `optional: true` (verified
via `npm view @lingui/vite-plugin peerDependenciesMeta`), so the install is clean with
`@vitejs/plugin-react`.

**Node.** Every v6 package declares `engines: { node: '>=22.19.0' }`. The machine is on 24.14, but
the repo has no `engines` field and no `.nvmrc`, so nothing enforces it for anyone else. Worth
adding one while you are here.

## Work

**`apps/store/lingui.config.ts`** — v6 shape, using the typed helper:

```ts
import { defineConfig } from '@lingui/cli'
import { formatter } from '@lingui/format-po'

export default defineConfig({
  locales: ['en', 'es'],
  sourceLocale: 'en',
  catalogs: [{ path: '<rootDir>/src/locales/{locale}', include: ['<rootDir>/src'] }],
  format: formatter({ origins: false, lineNumbers: false }),
  orderBy: 'messageId',
})
```

`defineConfig` is worth using rather than a bare object literal: it types the options, so a
misspelled key is a typecheck error instead of a silently ignored one.

Two options that are not cosmetic. Origins put a source path and line on every entry, which turns a
one-word copy edit into a hundred-line catalog diff and makes the drift check in ticket 09 noise
instead of signal — in v6 they moved from `formatOptions` into the formatter call. Sorting by
message id is what keeps tickets 05–08 producing local, mechanical `.po` conflicts rather than
whole-file ones.

`noDefaultExport` is `warn` globally and `warn` fails the gate, but `**/*.config*.ts` is already
carved out — this file may default-export.

**`vite.config.ts`.** `viteReact()` is currently called with no options:

```ts
plugins: [ …, tanstackStart(), lingui(), viteReact({ babel: { plugins: ['@lingui/babel-plugin-lingui-macro'] } }) ]
```

There is one Vite config to wire and one deploy target behind it — the edge Worker.

**`src/types/po.d.ts`** — the first `.d.ts` in the repo, so there is no convention to follow.
`@lingui/vite-plugin` ships only `dist/index.mjs` and `dist/index.d.mts` — no ambient client types —
so this file is genuinely required, not a workaround for a missing `types` entry.
`tsconfig.json` has `include: ["**/*.ts", "**/*.tsx"]`, so it is picked up with no config edit.
Keep it out of `src/locales/`, which ticket 09 excludes from Biome. Keep the `import type` *inside*
the declaration body so the file stays a global script rather than becoming a module augmentation —
`verbatimModuleSyntax` is on.

```ts
declare module '*.po' {
  import type { Messages } from '@lingui/core'
  export const messages: Messages
}
```

**`src/lib/i18n/locale.ts`** — pure, imports nothing.

A Locale is a record, not a string, because two different values fall out of one URL segment:

```ts
export type Locale = { tag: 'en-US' | 'es-US'; language: 'en' | 'es'; country: 'US' }

export const LOCALES: readonly Locale[] = [
  { tag: 'en-US', language: 'en', country: 'US' },
  { tag: 'es-US', language: 'es', country: 'US' },
]
export const DEFAULT_LOCALE = LOCALES[0]
```

`LOCALES` is an **array, not an object keyed by tag**. `useNamingConvention` allows only
`camelCase | PascalCase | CONSTANT_CASE` for object literal properties, so `{ 'es-US': … }` is a
lint failure — and `warn` fails the gate under `--error-on-warnings`. Lookups go through
`findLocale(tag)`, not indexing.

Also `isLocale`, `splitLocale(pathname): { locale, rest }` and `localePath(locale, path)`.
`splitLocale` must round-trip with `localePath` for every Locale including the default, and must
leave an unknown segment alone so ticket 02's 404 behaviour falls out of it — `/fr-FR/products`
returns the default Locale and an unchanged `rest`, which then matches no route.

`language` picks the Message Catalog; `tag` goes to `<html lang>`, `hreflang` and `Intl`.

**`src/lib/i18n/catalogs.ts`** — `createI18n(locale)`: `setupI18n()`, await the catalog,
`loadAndActivate`. Never a module singleton, never `activate` on a shared object.

Use a static map of thunks, not a template-literal specifier. `` import(`../../locales/${locale}.po`) ``
types as `any` and leans on Vite's dynamic-import-vars glob; the map is statically analysable, typed
by the `*.po` declaration, and code-splits identically:

```ts
const catalogs = {
  en: () => import('../../locales/en.po'),
  es: () => import('../../locales/es.po'),
} satisfies Record<Locale['language'], () => Promise<{ messages: Messages }>>
```

Keyed by **language**, not tag — that is what lets a future `es-MX` reuse `es.po` with no new
translation work. `i18n.locale` is set to the *tag*, so `useFormatters()` in ticket 04 gets
`es-US` and not a bare `es`, which would format money the European way.

Relative specifiers, not `#/locales/…`. The subpath import is unproven against the Lingui plugin's
extension-keyed transform and this is not the place to discover that.

`noUncheckedIndexedAccess` is on and non-null assertions are banned repo-wide, so the lookup narrows
or falls back — it does not `!`.

**`src/lib/i18n/resolve-locale.ts`** — `createIsomorphicFn()`, `.client()` reading
`window.location.pathname`, `.server()` reading `new URL(getRequest().url).pathname`, both through
`splitLocale`. `getRequest()` is legal inside `getRouter()`: `requestHandler` wraps the entire
request in the h3 event ALS before the router entry is called.

**`src/lib/i18n/i18n-provider.tsx`** — `I18nRouterProvider`, reading
`useRouter().options.context.i18n` and rendering `<I18nProvider>`. A component-only file:
`useComponentExportOnlyModules` is `warn`, and warn fails the gate.

**`src/router.tsx`** — `getRouter` becomes `async`; resolve the locale, await `createI18n`, put
`i18n` in `context`, pass `InnerWrap: I18nRouterProvider`.

`InnerWrap`, not `Wrap`. `Wrap` renders *outside* `routerContext.Provider`, so `useRouter()` is
unavailable inside it. `InnerWrap` renders inside the provider and still above the root match,
which is where `shellComponent` renders — both properties are needed, the first here and the second
in ticket 02. It also sidesteps `noNestedComponentDefinitions`, which is `error` for `apps/store/**`
and which an inline arrow-function `Wrap` would likely trip.

**The trap, and it is silent.** `src/router.tsx:25` currently declares
`router: ReturnType<typeof getRouter>`. `routeTree.gen.ts:556` already says
`Awaited<ReturnType<typeof getRouter>>`, so the generated file needs nothing — but the hand-written
declaration must be changed to `Awaited<…>` too. Miss it and every typed hook in the app quietly
becomes a `Promise`, with errors surfacing far from the cause.

**`src/routes/__root.tsx`** — widen the context type to
`createRootRouteWithContext<{ queryClient: QueryClient; i18n: I18n }>()`. Nothing else in this file
changes yet; `<html lang>` is ticket 02.

**Empty catalogs.** `npm run --workspace=store i18n:extract` with nothing wrapped writes headers-only
`en.po` and `es.po`. Commit them so tickets 05–08 have a file to diff against.

**Scripts** — `"i18n:extract": "lingui extract --clean"`, `"i18n:compile": "lingui compile --strict"`.
The `lingui` bin comes from `@lingui/cli`. Add the compiled-catalog output to `apps/store/.gitignore`
once you have seen what `compile` actually emits.

## Risk

**The riskiest unknown in the whole feature is whether `@lingui/vite-plugin`'s `.po` transform runs
inside the `ssr` environment** created by `cloudflare({ viteEnvironment: { name: 'ssr' } })`. A dev
server that works proves nothing about the Worker build. Acceptance is all four:

```bash
npm run --workspace=store dev                  # 3001, browse
npm run --workspace=store build                # workerd build
npx -w store wrangler dev                      # boot the built Worker
```

Then `npm run verify` and `npm run --workspace=store test:e2e` — all nine specs, unmodified, green.

**Fallback if `rewrite` turns out not to work under SSR** (ticket 02 is where that shows up, but
decide it here): `{-$locale}` with a `src/routes/{-$locale}/` directory, accepting the 54 call-site
edits and the e2e typecheck churn. A Worker-level rewrite is *not* an acceptable fallback — it
rewrites incoming requests but not outgoing `href`s, so every `<Link>` would drop the prefix.

## Notes

`lingui extract` and `lingui compile` are 2.2–2.4x and 3.2–4.5x faster respectively since v6.2
(they moved to `pofile-ts`). That is not a vanity number here — ticket 09 puts both commands in the
`verify.sh` gate, where they run on every check.

Both compiled catalogs end up in the Worker bundle as separate lazy chunks — ~20–30 KB each
uncompressed against a 3 MB compressed limit, and lazy, so neither size nor startup CPU is affected.

On the client exactly one catalog is fetched, and `hydrateStart()` already awaits `getRouter()`, so
there is no flash of untranslated content. The cost is one extra same-origin module fetch before
hydration. If that ever matters, statically import the default catalog into the entry chunk and keep
the others dynamic — but do not do it pre-emptively.
