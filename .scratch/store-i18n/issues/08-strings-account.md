# 07 — Strings: auth, account, addresses, orders

`features/auth` (12 files), `account` (6), `address` (11) and `orders` (11), plus `routes/_auth/*`,
`routes/_main/_authed/**` and `routes/_main/order/**`. Around 76 messages — the long tail, and the
one that touches the copy contract.

Depends on `01-runtime-and-build-wiring.md`.

## Work

**The three nested-element cases** need `<Trans>` with children, not `t`:

- `orders/components/order-confirmed-content.tsx:29-31` — `…details to{' '}<span>{order.email}</span>.`
- `account/components/password-panel.tsx:16-17` — `Reset link sent to <strong>{email}</strong>. Check your inbox.`
- `routes/_auth/login.tsx:32` — `Don't have an account?{' '}<Link>Sign up</Link>`

Each is one message with a placeholder for the element, so a translator can move the emphasis or the
link where the sentence needs it. Splitting them into fragments around the tag is the failure mode
to avoid — it produces three untranslatable stubs and hardcodes English word order.

**`orders-panel.tsx:13-18`** — `fulfillmentLabels: Record<StoreOrderFulfillmentStatus, string>`
maps a backend enum to `Preparing`, `Ready to ship`, `Shipped`, `Delivered`. Module scope, so `msg`
descriptors resolved at the render site. This one is worth doing carefully: it is the only place a
backend enum gets a frontend label, and it is the template for how the others should be handled if
they ever surface. `payment-details.tsx:14` (`Payment received` / `Awaiting payment`) is the same
shape inline.

**The remaining pending/idle ternaries** — `login-form.tsx:24`, `register-form.tsx:29`,
`forgot-password-form.tsx:17`, `reset-password-form.tsx:17`, `password-panel.tsx:26`. Two messages
each, as in `07`.

**`account-detail.tsx:18`** — `` customer.firstName ? `Hello, ${customer.firstName}` : 'Hello' `` —
two messages, one with a placeholder.

**`address-card.tsx:68-70`** — confirm-dialog copy built imperatively outside render (`title`,
an interpolated `description`, `confirmText`). The handler is inside a component, so `useLingui()`
covers it.

**`address-lines.tsx:20`** renders `address.countryCode?.toUpperCase()` — a raw `US` / `GB`. Leave
it. Making it a display name is the same `Intl.DisplayNames` question `05` deferred on
`country-options.tsx`, and the two should be decided together, later.

**Toasts** — `features/auth/api/auth.ts:29,47,62,80` and `features/address/api/addresses.ts:50,73,92`.
Store-authored `title` translates; backend `error.message` in the `description` does not. Same rule
as `07`.

Note that `routes/_auth/login.tsx:30`, `signup.tsx:32`, `forgot-password.tsx:36` and
`reset-password.tsx:42` pass the backend message as the toast **title** — the whole message is the
server's string, so there is nothing to wrap. Flag these in the PR; they are the most visible
instance of the untranslatable-backend-copy gap and the strongest argument for the error-code
contract ticket 09 recommends.

## Translations

I fill `es.po` for the messages this ticket adds, in informal *tú* with neutral Latin-American
vocabulary — "carrito" not "cesta". You review the `.po` diff before it merges. The review surface
is one column of prose, and what it is actually guarding is **tone consistency across four
separately-landed tickets**: commerce copy is short and highly patterned, so the risk is drift, not
mistranslation.

A message left untranslated renders its English default, so a gap here is cosmetic rather than
broken — but ship the Spanish with the ticket rather than after it, or the review never happens.

## The copy contract

`.scratch/store-design-system/spec.md` records an explicit decision that
`apps/store/tests/e2e/auth.spec.ts` passing unmodified — `/sign in/i`, `/join us/i`, `/^join$/i`,
`getByLabel('Email')` — is the contract that labels stayed associated and the vocabulary stayed put.

This ticket wraps exactly those strings. **Rendered English must not move by a character.** If a
`<Trans>` normalises whitespace inside one of them, fix the JSX, not the spec.

## Acceptance

```bash
npm run verify
npm run --workspace=store test:e2e
```

`auth.spec.ts`, `account.spec.ts`, `addresses.spec.ts` and `orders.spec.ts`, all unmodified. There
are no date assertions in the store e2e suite, so ticket 04's date change does not collide here —
but `payment-details.tsx:21` interpolates both a price and a datetime into one sentence that this
ticket wraps, so coordinate with 04 or expect a conflict in that file.

Re-extract and commit the catalog diff.
