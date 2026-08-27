# 04 — Strings: global chrome

The first string ticket, and the one that sets the pattern the other three copy. Header, nav,
footer, side menu, search, pagination, panels, drawers, the cart-mismatch banner — about 25 files in
`src/components/**`, roughly 45 messages.

Depends on `01-runtime-and-build-wiring.md`. Ticket 03's first assertion depends on this.

## Work

Apply the macro rule from `spec.md`: `<Trans>` for JSX text, `const { t } = useLingui()` for strings
inside a component, `msg` descriptors for anything at module scope.

**The module-scope constants are the interesting part** — everything else is mechanical:

| File | What |
|---|---|
| `components/header/constants.ts:6` | `SEARCH_PLACEHOLDER`, used as both a placeholder and a button label |
| `components/header/nav.tsx:9` | `railLinks` |
| `components/footer.tsx:13-28` | `footerColumns` — `title` and `label` on each entry |
| `components/header/side-menu.tsx:10-15` | `menuLinks` |
| `components/form/country-options.tsx:10-19` | eight country names |

All five become `MessageDescriptor` arrays via `msg`, resolved at the render site with
`i18n._(entry.label)`. **Do not convert them to thunks** — the reference project's
`() => t\`…\`` idiom binds to the global singleton, which is the exact failure mode this feature is
built to avoid.

`country-options.tsx` deserves a moment's thought: these are country *names*, and `Intl.DisplayNames`
would produce them for free in any locale. It stays a hand-maintained `msg` list for now because the
file's own comment says the list is a placeholder until there is a region table behind it, and
swapping in `Intl.DisplayNames` is a data-model change wearing an i18n costume. Note it and move on.

`theme-toggle.tsx:64-67` builds `` `Theme mode: ${mode}. Click to switch mode.` `` by interpolating a
raw enum value into a sentence — untranslatable as written. Split it into three separate messages,
one per mode.

## Translations

I fill `es.po` for the messages this ticket adds, in informal *tú* with neutral Latin-American
vocabulary — "carrito" not "cesta". You review the `.po` diff before it merges. The review surface
is one column of prose, and what it is actually guarding is **tone consistency across four
separately-landed tickets**: commerce copy is short and highly patterned, so the risk is drift, not
mistranslation.

A message left untranslated renders its English default, so a gap here is cosmetic rather than
broken — but ship the Spanish with the ticket rather than after it, or the review never happens.

## Acceptance

**The rendered English must be byte-identical.** That is the whole criterion, and it is what makes
these tickets safe to land one at a time.

```bash
npm run verify
npm run --workspace=store test:e2e     # nine specs, unmodified
```

The realistic breakage is whitespace, not translation. `<Trans>` normalises JSX whitespace, so a
sentence split across two source lines can come back with different internal spacing. Playwright's
`getByText(string)` is substring-and-normalised and absorbs most of it, but `{ exact: true }` and
`getByRole(name)` are strict. `footer.spec.ts` and `header.spec.ts` are the ones that will tell you.

`.scratch/store-design-system/spec.md` has a standing "copy is unchanged" contract covering
`/sign in/i`, `/join us/i` and `getByLabel('Email')`. This ticket does not touch those, but 07 does —
the rule is the same either way.

Ticket 09 describes an optional `pseudoLocale` (v6.5) that brackets and pads every *wrapped*
message. It is worth wiring up here rather than at the end — under it, anything still rendering
plain English is a string this ticket missed, which is a far better check than re-reading the diff.

Re-run `npm run --workspace=store i18n:extract` before committing and include the catalog diff.
