# 03 — Locale and country pickers

A shopper can reach `/es-US` after ticket 02, but only by typing it. This adds the footer controls.

Depends on `02-locale-routing-and-seo.md`.

## Already delivered by markets

**The country control shipped, and it is not inert.** `src/components/market-select.tsx` is a
native `<select>` on the footer bottom bar listing every market the store sells in, straight off
the country endpoint. Choosing one is a document navigation to that market's prefix, which is also
what re-quotes the page in that market's currency. So the section below — two controls, one of them
pinned to `US` with helper text explaining why it cannot be changed — describes a state the store
is no longer in.

**The bottom bar already holds a control**, so the layout question this ticket raised is settled:
the language picker slots in beside `MarketSelect`, at `src/components/footer.tsx:137`.

**The side-menu placement is still open.** `MarketSelect` renders only in the footer; nothing was
added to `side-menu.tsx`. If mobile parity matters it is unresolved for both controls, not just
the new one.

Only the language picker is left. What follows applies to it.

## The language picker

`src/components/locale-picker.tsx`, sibling of `theme-toggle.tsx` and modelled on it.

The switch is a **document navigation**, not a client-side one. `market-select.tsx` already does
exactly this and is the model to copy:

```ts
window.location.assign(marketHref(next, window.location, markets))
```

Note it takes `window.location`, not `router.state.location`: the segment has to be swapped on the
address the document request will be made to, and it is the browser's URL that carries one at all.
`router.navigate({ href, reloadDocument: true })` is the equivalent inside the router API.

Do **not** use `navigate({ to })`. The rewrite is fixed at router creation, so a client-side
navigation would re-apply the old Locale's segment and land you back where you started.

A full document load is correct, not a compromise: the Message Catalog has to change and the SSR'd
product pages have to be re-rendered by the server in the new language. Client-patching Spanish over
English SSR HTML is the thing this whole design avoids.

The picker lists Locales by their own endonym — `English`, `Español`, never `Spanish`. A shopper
looking for their language is scanning for the word they use for it.

## Placement

The footer bottom bar, which renders at every width and already carries `MarketSelect`, and
`side-menu.tsx` beside the theme toggle for mobile parity — the side menu is below-`lg` only, so a
control living solely there is invisible to desktop shoppers. If the side menu gets a language
picker it should get the market control too, or the two standing choices are in different places.

**No persistence.** Deliberate, and worth a comment at the call site so it is not "fixed" later. The
URL is authoritative; a stored Locale that disagrees with the URL is how you get an `/es-US` link
that renders English for the person you sent it to.

## The Spanish spec

`tests/e2e/i18n.spec.ts`. Keep it to three assertions — it guards the *mechanism*, not the
translations, which are the string tickets' job.

Use raw `page.goto('/es-US…')`. The typed `navigate` fixture is `createTest<FileRouteTypes['to']>()`
and `/es-US` is deliberately not in the route tree, so it cannot express these URLs; that is the
design working, not a gap.

1. `/es-US` — `<html lang="es-US">`, and a known Spanish nav string is visible.
2. `/es-US/products` — an `ssr: true` route: same `lang`, and the `page.goto` response still carries
   `cache-control: public, max-age=300, stale-while-revalidate=3600`.
3. The picker round-trips `/en-US` → `/es-US` → `/en-US`, preserving search params. Both ends carry
   a prefix; there is no unprefixed address to round-trip through.

`tests/e2e/markets.spec.ts` is the existing spec of this shape and shows the fixtures and the raw
`page.goto` idiom in use. Any row this needs comes from `factories.create.*` with `await using`
inside the test. Never `beforeAll` — `playwright.config.ts` sets `fullyParallel: true`, so shared
fixture data is a race between specs.

Assertion 1 cannot be written until ticket 05 has translated the nav. Either land 03 after 05, or
write assertions 2 and 3 now and add the first when the chrome is translated — say which in the PR
rather than leaving a spec that asserts English and calls itself an i18n test.

## Verify

`npm run verify`, then the full e2e suite including the new spec. E2E is not part of `verify` and
there is no CI, so this is a manual gate.
