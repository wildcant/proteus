# 02 — Locale prefix routing and SEO head

Makes `/es-US` real. After this ticket the Spanish site exists and is correctly server-rendered,
cached and linked — it just has nothing translated in it yet, because the catalogs are empty until
tickets 05–08. That is safe: with `sourceLocale: 'en'` a missing translation renders the English
default, so `/es-US` is an English page under a Spanish tag until the strings land.

Depends on `01-runtime-and-build-wiring.md`.

## Work

**`src/lib/i18n/locale-rewrite.ts`**

```ts
export function createLocaleRewrite(locale: Locale): LocationRewrite | undefined {
  if (locale.tag === DEFAULT_LOCALE.tag) return undefined
  return {
    input: ({ url }) => { url.pathname = splitLocale(url.pathname).rest; return url },
    output: ({ url }) => { url.pathname = localePath(locale, url.pathname); return url },
  }
}
```

Returning `undefined` for the default is load-bearing, not tidiness: `parseLocation` takes a fast
path when `rewrite` is falsy, so English is provably the same code path it is today. That is what
lets tickets 05–08 use "the nine existing specs still pass" as their acceptance criterion.

Wire it into `createTanStackRouter({ …, rewrite: createLocaleRewrite(locale) })` in `src/router.tsx`.

**`/en-US` redirects to `/`.** The default Locale has exactly one address. Without this, every page
exists at two URLs and the canonical tag is doing work it should not have to. A permanent redirect,
issued before the router matches — simplest place is the same request path that resolves the Locale.
Confirm it survives search params and hash.

**`src/routes/__root.tsx` — `<html lang>`.** Hardcoded `lang="en"` at :62. Read the **tag** (not the
language) from the active Locale, so the document announces `es-US`.

Leave `suppressHydrationWarning` and `THEME_INIT_SCRIPT` exactly as they are. The Locale needs no
equivalent blocking script — that script exists because theme comes from `localStorage` and the
server cannot know it; the Locale is in the URL, so the server always knows it. Worth a comment
saying so, or someone will add one for symmetry.

**`src/routes/__root.tsx` — `head()`.** Title and description become `msg` descriptors resolved
through `match.context.i18n`. `head` receives `{ ssr, matches, match, params, loaderData }` and
`match.context` is the full router context, so no new plumbing is needed. It re-runs on every
`loadMatches`, so what is computed here stays correct across client navigation.

Add `canonical`, one `alternate` per Locale tag, and `x-default`, all built from `localePath()` and
the last match's pathname — which is the *internal*, prefix-free path, because the rewrite already
stripped it.

```
<link rel="canonical"  href="https://…/es-US/products/abc">
<link rel="alternate" hreflang="en-US" href="https://…/products/abc">
<link rel="alternate" hreflang="es-US" href="https://…/es-US/products/abc">
<link rel="alternate" hreflang="x-default" href="https://…/products/abc">
```

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
curl -sI localhost:3001/en-US                 # 301 → /
curl -sI localhost:3001/fr-FR/products        # 404
```

Caching needs no work and that is worth understanding rather than assuming: the rewrite normalises
the pathname *before* matching, so `/es-US/products/abc` matches the same route object and returns
the same `headers()`. The CDN key is the full URL, which now differs per Locale, so the two
languages get independent cache entries for free.

**Never emit `Vary: Accept-Language`.** It would fragment exactly this cache, and it is the reason
the spec rules out content negotiation.

A `throw redirect({ to: '/login' })` from an `/es-US` page must land on `/es-US/login` —
`resolveRedirect` builds the `Location` header from `publicHref`. Worth checking by hand on the
`_authed` guard, since nothing in the e2e suite covers it under a prefix until ticket 03.

`npm run verify` and all nine e2e specs, unmodified.
