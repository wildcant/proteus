# 08 — Validation copy and guardrails

The last ticket. Translates the validation messages the shared schemas produce, and installs the
rules that keep the previous seven from rotting.

Depends on `05`–`08`. Lands last, so the drift check is not tripping over catalogs that are still
being filled in.

## Validation copy

Two classes, two mechanisms, neither touching `packages/http-schemas` — it is imported by the
backend for request validation, and wrapping its messages in `t` at module scope would both break
the backend and freeze the locale at import time.

**Class 1 — raw Zod defaults leaking to shoppers.** `http-schemas/src/store/customer/payloads.ts:41-50`
(`StoreCreateAddress`) uses bare `z.string().min(1)` with no message, so the address book form shows
*"Too small: expected string to have >=1 characters"* to a shopper **today**, in English. This is a
live bug that i18n happens to fix.

Zod 4.4.3 ships locales — `node_modules/zod/v4/locales/es.js` exports `{ localeError }`.
`src/lib/i18n/zod-locale.ts` exposes `applyZodLocale(locale)` calling `z.config({ localeError })`.
Zod's precedence is schema message > `customError` > `localeError` > built-in default, so
`localeError` fills gaps and can never fight an authored message.

`z.config` is isolate-global, so call it **client-side only** — from `createI18n`, guarded on
`typeof document !== 'undefined'`. That is safe rather than lucky: every form-bearing route
(`_auth`, `_checkout`, `_main/_authed`) is outside the six `ssr: true` routes, so validation never
runs during SSR. Comment the guard with that reason; it is not obvious from the code.

**Class 2 — authored English inside the shared schemas.** `'Enter a password'`, `'Enter your password'`,
`'First name is required'`, `'Address is required'`, `'City is required'`, `'Country is required'`,
`'Postal code is required'`, and `auth/payloads.ts:35`. These are schema-level and therefore
unreachable by any error map — they must be translated at the render seam the store owns.

- `src/lib/i18n/validation-messages.ts` — `Record<string, MessageDescriptor>` keyed by the exact
  English string.
- `src/components/form/use-field-errors.ts` — takes `field.state.meta.errors`, returns the same
  shape with each `message` mapped through the table, falling back to the original string.
- Wire into the three field components the store owns: `text-field.tsx:32`, `select-field.tsx:36`,
  `checkbox-field.tsx`.

`FieldError`'s prop type is `Array<{ message?: string } | undefined>`, so remapped plain objects go
straight in with **no change to `packages/ui`**.

**Guard the key coupling.** Keying on an English string means an upstream reword silently falls back
to English. Add a check that walks the store-facing schemas with known-bad input and asserts every
message it produces has a table entry. `apps/store` has `vitest` in devDependencies but no `test`
script and no vitest config — either add one, or fold the assertion into the shell script below if
you would rather not open that door in this ticket.

## Guardrails

**Ban bare `t`.** Biome 2.5.4 supports `importNames` on `noRestrictedImports` (confirmed in its
`configuration_schema.json`). Scope it to `apps/store/**`:

```jsonc
"@lingui/core/macro": { "importNames": ["t"],
  "message": "Bare `t` compiles to the global i18n singleton and bleeds locales across concurrent SSR requests. Use useLingui() from @lingui/react/macro, or msg for module scope." }
```

The message matters more than the rule. The failure it prevents does not reproduce locally — it
needs concurrent requests in one isolate — so anyone who hits the rule needs to be told why rather
than shown a workaround.

**Exclude catalogs from Biome.** Add `"!**/src/locales/**"` to `files.includes` in `biome.json`,
following the existing `!**/src/api/generated` precedent. Biome has no `.po` parser and
`files.ignoreUnknown` is `false`. It also does double duty: `verify.sh` runs `biome format --write .`
across the whole tree, and the drift job below *writes* `.po` files during the parallel phase.

**Naming convention.** `useNamingConvention` allows `camelCase | PascalCase | CONSTANT_CASE` for
object literal properties, and `warn` fails the gate under `--error-on-warnings`. `{ en, es }`
passes; **`{ 'en-US': … }` would not.** Locale identifiers in this codebase are bare language
subtags. If a regional variant is ever needed, use a `Map` or add a scoped override — do not add a
hyphenated key and do not reach for a `biome-ignore`.

**Drift check.** Still no `lingui extract --check` in v6 — `extract` has `--clean`, `--overwrite`,
`--format`, `--locale`, `--convert-from`, `--verbose`, `--watch`, `--workers`; `compile` has
`--strict`. So `scripts/check-i18n-catalogs.sh` is three steps:

1. `npm run --workspace=store i18n:extract`
2. `git diff --quiet -- apps/store/src/locales` — non-zero means strings changed and the catalogs
   were not committed

**`lingui compile --strict` is deliberately not in the gate.** It fails on any missing translation,
which would block the incremental approach the spec chose on purpose: with `sourceLocale: 'en'` a
missing Spanish message renders the English default, so a partially-translated catalog is a safe
state, not a broken one. The `i18n:compile` script keeps `--strict` for running by hand when you
want to know what is still untranslated; the gate only checks that the catalogs match the source.

Step 1 mutating the tree is consistent with this gate — `verify.sh` already rewrites every file with
`biome format --write` before checking anything — but say so in the script header. This repo
comments its *why*.

**`verify.sh`** — three edits, as the file's own header prescribes: add `i18n` to `JOBS`, define
`job_i18n()`, add a `label_of` case.

Cost is acceptable because v6.2 moved both commands to `pofile-ts`: extract is 2.2–2.4x faster than
the v5 line. It also takes `--workers`, so if the job ever dominates the gate that is the knob — but measure before reaching for it, since `verify.sh` already runs six jobs in
parallel and more threads may not help.

**Pseudolocale, optional but cheap.** v6.5 added a `pseudoLocale` config option
(`{ locale: 'pseudo', prepend: '⟦ ', append: ' ⟧', extend: 0.4 }`). It renders every *wrapped*
message wrapped in brackets and padded, so anything still in plain English on screen is a string
someone missed. That is a better unwrapped-string detector than reading diffs, and it costs one
config line plus a dev-only entry in `LOCALES`. If you add it, keep it out of the production
`LOCALES` union so it cannot be reached by URL — it is a build-time tool, not a locale.

## ADR

`docs/adr/0021-store-locale-is-a-url-rewrite.md`. Two decisions belong in it, and both are the kind
that someone will otherwise undo in six months because the alternative looks more idiomatic:

1. Locale is carried by `RouterOptions.rewrite`, not by an optional path param — with the reason
   (`{-$locale}` works, but costs 54 typed call sites and breaks the e2e fixture's types).
2. The `i18n` instance is per-request in router context, not a module singleton — with the reason
   (isolate-level cross-request bleed).

Same shape as 0013 (selective SSR), 0019 (modals are URL state) and 0020 (feature graph).

## Notes

`src/lib/i18n/**` imports nothing from `#/components` or `#/features`, so `no-circular` stays quiet
and no `FEATURE_GRAPH` edit is needed. The one exception, `i18n-provider.tsx`, imports only
`@lingui/react` and `@tanstack/react-router`.

**There is no CI.** `.github/` does not exist, so every guardrail here is only as good as the habit
of running `npm run verify` locally, and the e2e suite is not in `verify` at all. If this feature is
worth guarding, a workflow running `npm run verify -- --ci` plus the e2e suite is worth more than
the drift check itself — but that is its own piece of work, not this ticket.
