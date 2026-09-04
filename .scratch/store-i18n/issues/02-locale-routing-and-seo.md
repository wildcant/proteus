# 02 — Locale prefix routing and SEO head

Makes `/es-US` real. After this ticket the Spanish site exists and is correctly server-rendered,
cached and linked — it just has nothing translated in it yet, because the catalogs are empty until
tickets 05–08. That is safe: with `sourceLocale: 'en'` a missing translation renders the English
default, so `/es-US` is an English page under a Spanish tag until the strings land.

Depends on `01-runtime-and-build-wiring.md`.

## Already delivered by markets

The prefix routing in this ticket shipped, in a different shape and for a different reason. What
exists in `src/router.tsx` and `src/start.ts` today:

- The `rewrite`, prefixing **every** market including the default. `/` is a router and never a page:
  it resolves a market from the cookie or the store default, redirects to that prefix, and renders
  nothing. `/en-US` renders — it does **not** redirect to `/`, which is the reverse of what this
  ticket proposed.
- `<html lang>` reads the market's Locale, so the `lang="en"` hardcode is gone.
- Unknown segments still 404: `/fr-FR/products` reaches the route tree unchanged.

What is left of this ticket is the SEO head — `canonical`, `hreflang` and `x-default`, and the
`SITE_URL` plumbing they need. Sections below are kept as written where they still apply; the
routing sections are marked.

## Work

**`src/lib/i18n/locale-rewrite.ts`** — superseded. The rewrite lives in `src/router.tsx`, built
from the market rather than from a Locale, and it does not return `undefined` for the default:

```ts
input:  ({ url }) => { /* strip the market segment, remember which market it was */ },
output: ({ url }) => { /* prefix every market, unless none was resolved from the URL */ },
```

Prefixing the default too is what removed the second address for the same page, and it is what the
`/en-US` → `/` redirect below was trying to achieve from the other direction. The cost is that
English is no longer a provably untouched code path, so tickets 05–08 cannot use "the nine existing
specs still pass unmodified" as their acceptance criterion — the suite already carries the prefix.

**`/en-US` redirects to `/`.** — superseded, and inverted. `/` redirects to `/en-US`. The goal was
one address per Locale and that goal is met; it is the unprefixed URL that no longer exists, not
the prefixed one.

**`src/routes/__root.tsx` — `<html lang>`.** — done. Reads the market's Locale.

Leave `suppressHydrationWarning` and `THEME_INIT_SCRIPT` exactly as they are. The Locale needs no
equivalent blocking script — that script exists because theme comes from `localStorage` and the
server cannot know it; the Locale is in the URL, so the server always knows it. Worth a comment
saying so, or someone will add one for symmetry.

**`src/routes/__root.tsx` — `head()`.** Title and description become `msg` descriptors resolved
through `match.context.i18n`. `head` receives `{ ssr, matches, match, params, loaderData }` and
`match.context` is the full router context, so no new plumbing is needed. It re-runs on every
`loadMatches`, so what is computed here stays correct across client navigation.

Add `canonical`, one `alternate` per Locale tag, and `x-default`, all built from
`joinMarketSegment()` and the last match's pathname — which is the *internal*, prefix-free path,
because the rewrite already stripped it.

```
<link rel="canonical"  href="https://…/es-US/products/abc">
<link rel="alternate" hreflang="en-US" href="https://…/en-US/products/abc">
<link rel="alternate" hreflang="es-US" href="https://…/es-US/products/abc">
<link rel="alternate" hreflang="x-default" href="https://…/en-US/products/abc">
```

Every href carries a prefix, `x-default` included — there is no unprefixed address to point it at.

Note the `hreflang` values are full tags. This is the payoff for putting the country in the URL:
`hreflang="es"` would tell Google "Spanish anywhere", which is wrong for a US store, and would
collide the day `es-MX` exists.

**Origin plumbing.** `hreflang` values must be absolute, and the app has no notion of its own
origin. Add `SITE_URL` to `src/env.ts` — the only file `scripts/check-env-usage.sh` permits to read
`import.meta.env` — backed by a new `VITE_SITE_URL` in `.env`, `.env.local` and `.env.test`. This is
net-new configuration; `src/env.ts` throws at module load on a missing var, so all three files must
be updated or dev and e2e both fail to boot.

## Verify

```bash
curl -sI localhost:3001/es-US/products/<id>   # cache-control: public, max-age=300, stale-while-revalidate=3600
curl -s  localhost:3001/es-US/products/<id> | grep '<html'   # lang="es-US"
curl -sI localhost:3001/en-US                 # 200 — the default market has a prefix like any other
curl -sI localhost:3001/                      # 302 → /en-US
curl -sI localhost:3001/fr-FR/products        # 404
```

Caching needs no work and that is worth understanding rather than assuming: the rewrite normalises
the pathname *before* matching, so `/es-US/products/abc` matches the same route object and returns
the same `headers()`. The CDN key is the full URL, which now differs per Locale, so the two
languages get independent cache entries for free.

**Never emit `Vary: Accept-Language`.** It would fragment exactly this cache, and it is the reason
the spec rules out content negotiation.

A `throw redirect({ to: '/login' })` from an `/es-US` page must land on `/es-US/login` —
`resolveRedirect` builds the `Location` header from `publicHref`. Already true under the market
prefix and covered by `tests/e2e/auth.spec.ts`, which asserts `/en-US/login`.

`npm run verify` and the e2e suite. Not "unmodified" any more — the specs already carry the market
prefix, so a change here that breaks them is a real break rather than an expected edit.
