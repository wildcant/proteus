# 03 — Locale and country pickers

A shopper can reach `/es-US` after ticket 02, but only by typing it. This adds the footer controls.

Depends on `02-locale-routing-and-seo.md`.

## Two controls, one of them inert

The reference storefront's footer bottom bar carries a country picker (`🇺🇸 US`) and a language
picker (`Español`) side by side. We build both. Country is pinned to `US` until markets exist, so
it renders with a single option and cannot be changed.

That is a deliberate exception to the design-system rule against shipping controls with no
destination. The reasoning: the country picker communicates *where the store ships*, which is real
information even when there is only one answer, and the layout needs to be right before the second
option exists. The footer link columns were dropped in that ticket because a link that silently
returns you to the home page is a bug you walk into; a picker showing your only country is not.

Make it honest rather than broken: `aria-disabled`, a tooltip or helper text along the lines of
"We currently ship to the United States only", and no dropdown that opens onto one item. Do not
render a native `<select>` with a single `<option>` and call it done — a screen reader user should
be told why it cannot be changed, not left to discover it.

## The language picker

`src/components/locale-picker.tsx`, sibling of `theme-toggle.tsx` and modelled on it.

The switch is a **document navigation**, not a client-side one:

```ts
window.location.assign(localePath(next, router.state.location.href))
```

`router.state.location.href` is the *internal* href — the segment is already stripped, and search
and hash come along. `router.navigate({ href, reloadDocument: true })` is the equivalent inside the
router API; either is fine.

Do **not** use `navigate({ to })`. The rewrite is fixed at router creation, so a client-side
navigation would re-apply the old Locale's segment and land you back where you started.

A full document load is correct, not a compromise: the Message Catalog has to change and the SSR'd
product pages have to be re-rendered by the server in the new language. Client-patching Spanish over
English SSR HTML is the thing this whole design avoids.

The picker lists Locales by their own endonym — `English`, `Español`, never `Spanish`. A shopper
looking for their language is scanning for the word they use for it.

## Placement

The footer bottom bar, which renders at every width, and `side-menu.tsx:69` beside the theme toggle
for mobile parity — the side menu is below-`lg` only, so a control living solely there is invisible
to desktop shoppers. Build the bottom bar to hold two controls so the country picker slots in
without a relayout.

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
3. The picker round-trips `/` → `/es-US` → `/`, preserving search params.

Any row this needs comes from `factories.create.*` with `await using` inside the test. Never
`beforeAll` — `playwright.config.ts` sets `fullyParallel: true`, so shared fixture data is a race
between specs.

Assertion 1 cannot be written until ticket 05 has translated the nav. Either land 03 after 05, or
write assertions 2 and 3 now and add the first when the chrome is translated — say which in the PR
rather than leaving a spec that asserts English and calls itself an i18n test.

## Verify

`npm run verify`, then the full e2e suite including the new spec. E2E is not part of `verify` and
there is no CI, so this is a manual gate.
