# 06 — Strings: cart and checkout

`features/cart/**` (11 files) and `features/checkout/**` (19 files) plus `routes/_main/cart.tsx` and
`routes/_checkout/*`. Around 54 messages — the largest of the four string tickets, and the one with
the most e2e surface underneath it.

Depends on `01-runtime-and-build-wiring.md`.

## Coordination

`.scratch/store-design-system/issues/07-cart-drawer.md` is in flight and rewrites much of
`features/cart` — including deleting the `Added to cart` toast that `cart.spec.ts`, `checkout.spec.ts`
and `orders.spec.ts` currently assert on. **Land the cart drawer first.** Wrapping strings in
components that are about to be rewritten wastes the work twice: once in the edit, once in the
catalog churn when the extract drops the old messages.

## Work

Mechanical apart from the composed fragments, which is most of what makes this ticket bigger than
its file count suggests.

**Checkout step titles** — `checkout-form.tsx:25,37,48,64,75` pass `Contact`, `Shipping Address`,
`Delivery`, `Payment`, `Review` as a `title` prop on a custom `CheckoutStep`. A component prop, not
the HTML attribute; `useLingui()` at the call site.

**Field labels** are the densest cluster in the app — `shipping-address-form.tsx:85-161` alone
carries shipping and billing with every label duplicated. Wrap each occurrence rather than hoisting
a shared constant: the duplicates collapse to one catalog entry automatically, and hoisting would
just recreate the module-scope problem `05` had to solve.

**Interpolated line items** — `cart-dropdown.tsx:129` (`Qty: {item.quantity} · {formatPrice(…)}`),
`checkout-summary.tsx:30` (`Qty: {item.quantity}`). Keep the price interpolated as a value — the
formatting is ticket 04's job, and these files switch to `useFormatters()` there.

**Pending/idle button ternaries** — `review-step.tsx:14`, `shipping-method-form.tsx:59`,
`payment-form.tsx:62`, `contact-form.tsx:37`, `shipping-address-form.tsx:170`. Keep each as **two
independent messages**. Collapsing them into one ICU select breaks
`getByRole('button', { name: … })` in the specs, and reads no better in Spanish.

v6.6 added nested `msg` and `t` support to the Babel macro, which is what makes the composed
fragments below tractable — a descriptor can be built inside another message rather than
concatenated around it.

**The "calculated later" family** — `cart-content.tsx:40` (`Calculated at checkout`),
`checkout-summary.tsx:51` (`Calculated at next step`), `shipping-method-form.tsx:49` (`Calculated`).
Three near-identical strings in three contexts. Keep them distinct; a shared message would force one
Spanish phrasing onto three different sentences.

**Toasts** — `features/cart/api/cart.ts:73,102,131,154,177` and
`features/checkout/api/checkout.ts:67,92,107,127,149`. All inside `use*` hooks, so `useLingui()` at
the top of the hook and the callbacks close over `t`. Translate the store-authored `title` only; the
`description` is the backend's `error.message` and stays English. Ticket 09 documents that gap.

## Translations

I fill `es.po` for the messages this ticket adds, in informal *tú* with neutral Latin-American
vocabulary — "carrito" not "cesta". You review the `.po` diff before it merges. The review surface
is one column of prose, and what it is actually guarding is **tone consistency across four
separately-landed tickets**: commerce copy is short and highly patterned, so the risk is drift, not
mistranslation.

A message left untranslated renders its English default, so a gap here is cosmetic rather than
broken — but ship the Spanish with the ticket rather than after it, or the review never happens.

## Acceptance

Rendered English byte-identical. `cart.spec.ts` and `checkout.spec.ts` are the specs most likely to
catch a whitespace regression — `checkout.spec.ts` drives the entire five-step flow on
`getByRole('button', { name: /continue to delivery/i })` and friends from `tests/setup/utils.ts`.

Currency assertions (`$25.00 each`, `$75.00`) are unaffected even after ticket 04: `es-US` formats
USD identically to `en-US`, so the rendered price never changes.

```bash
npm run verify
npm run --workspace=store test:e2e
```

Re-extract and commit the catalog diff.
