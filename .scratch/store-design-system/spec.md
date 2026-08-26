# Store design system

**Status:** in progress. Foundation and login shipped; the rest of the storefront follows.

## Why

The storefront had no visual identity. `apps/store/src/styles.css` held five neutral-gray tokens
and no brand hue; `@proteus/ui` underneath is stock shadcn `baseColor: neutral`. The result was
coherent on the PDP and absent everywhere else — the home page is a single `<h1>`, the PLP has no
chrome, and `components/button.tsx` squared its own corners by hand because nothing in the token
layer said the brand was square.

`docs/specs/store-layout-and-cart.md` §7 still documents a palette (`--sea-ink`, `--lagoon`,
`--header-bg`, `.page-wrap`) that no longer exists in any CSS file. Treat that section as dead.

A large DTC activewear storefront is the reference. See `reference.md` for the extracted values.

## Decisions

**One typeface, two voices.** The reference pairs a custom Plaak cut against SN Skandia; both are
proprietary. We use the already-installed Manrope Variable for both roles and build the hierarchy
out of contrast its 200–800 axis can carry: display is 800 / uppercase / 0.9 leading / -0.02em,
body is 400 / sentence case / 1.4. No new font bytes.

**Display roles are utilities, not font-size tokens.** `type-display`, `type-title` and
`type-heading` are `@utility` rules carrying size, weight, leading, tracking and case together —
they are roles, not sizes. They are deliberately *not* named `text-*`: tailwind-merge classifies an
unrecognised `text-x` as a colour, so a custom `text-display` would be silently dropped whenever
`cn()` also saw a text colour on the same element.

Body and meta get no role at all. The reference's 14px and 12px are exactly Tailwind's stock
`text-sm` and `text-xs`, and `body { font-size: 0.875rem }` makes 14px the default. Set on `body`
rather than `html` so Tailwind's rem-based spacing scale is untouched.

**`--radius: 0rem` is the load-bearing line.** `packages/ui` derives `--radius-sm` through
`--radius-4xl` with `calc()` off it, so zeroing it squares every shadcn primitive at once.

**Colour tokens are indirections.** `@theme` registers `--color-ink: var(--ink)` so the value can
be themed per scheme on `:root`, following the `--color-foreground-muted` precedent already in the
file. `--foreground`, `--foreground-muted` and `--bg-subtle` are kept and repointed, so the ~25
files using them need no edit.

**Mobile-first, always.** The reference screenshots are captured at desktop width, which is the
wrong way round for a storefront — most shoppers arrive on a phone. Base classes are the phone
layout and `sm:` / `lg:` only ever *add*; no `lg:hidden` undoing of a desktop-first base. Every
ticket from `03` on carries a Responsive section that says what the phone does, not just what
collapses.

Where the reference changes *structure* across breakpoints rather than just reflowing — an inline
panel becoming a link to a separate route — we stack instead. Under selective SSR (ADR 0013) the
server has no viewport, so a structural switch means either two DOM trees in the markup or
client-side breakpoint detection that flashes the wrong one on first paint.

**Store-only.** All token work is in `apps/store/src/styles.css`. `packages/ui` is shared with
`apps/admin`; changing its `:root` would redesign the admin as a side effect.

**Dark mode stays.** The reference is light-only, but the store has a working `ThemeToggle`. Every
token has a dark counterpart. `--sale` and `--positive` use the reference's own published
`red-hc-dark` / `green-hc-dark`; the neutrals are ours.

**Copy is unchanged.** `apps/store/tests/e2e/auth.spec.ts` matches `/sign in/i`, `/join us/i`,
`/^join$/i` and calls `getByLabel('Email')`. That spec passing unmodified is the contract that
labels stayed associated and the vocabulary stayed put. "Sign in" / "Join us" is also more
consistent than the reference's own "Log In" / "Sign up" — two different verbs for one flow.

## Divergences from the reference

| | Reference | Us | Why |
|---|---|---|---|
| Display face | custom Plaak cut | Manrope 800 | Plaak is not licensable |
| Body face | SN Skandia | Manrope 400 | as above |
| Dark mode | none | full | the store already has a working toggle |
| Login wordmark | large display wordmark above the form | none | login sits inside the `_main` layout, so the nav wordmark is already on screen; the *heading* carries the display role instead |
| Login heading | "<Brand> Login" | eyebrow "Account" + display title | the eyebrow names the section and holds still across all three views; the title names the action and changes |

## Shipped

- `01-token-foundation.md` — colour, type roles, radius, dark counterparts
- `02-auth-pages.md` — floating-label input, button treatment, the `_auth` layout, sign in / sign up / verify / password reset
- `03-header.md` — bar, side menu and search panel; `--accent`; modals as URL state. One
  placeholder left (`Best sellers`) and the e2e specs still to run

## Next

- `04-footer.md` — link columns, monochrome payment and social marks, no placeholder links
- `05-account-page.md` — orders panel, panel grid, read-only details, emailed password reset
- `06-address-book.md` — the missing store address endpoints, plus the route-modal components moving to `packages/ui`
- `07-cart-drawer.md` — the bag as a right-edge panel on `?modal=cart`, auto-opened by the add
  mutation; deletes the header popover. Drops the free-shipping bar, the cross-sell rail and the
  estimated-shipping line for want of anything behind them, and carries the variant options line
  onto the line item, which needs `AddLineItem` widened. `/cart` is left alone
- `08-checkout.md` — the five-step `?step=` accordion collapses into one page on a full-bleed
  white/grey split; the address commits on blur, which is what unlocks the shipping rates. Wires
  the shipping-options query to the cart's address instead of the endpoint's `?? 'us'` fallback,
  and renders `address2`, which the checkout has never had. Drops the wallets, the discount field
  and the terms line for want of anything behind them; the saved-address picker is deferred

- `09-product-detail.md` — the gallery becomes a full-bleed snap carousel on the phone and a
  `[half, half, full]` mosaic at `lg:`; the thumbnail rail's job moves to a dot row. Swatches go from
  44px circles to 4:5 tiles, the size values go from wrapped pills to a zero-gap 4-column grid, and
  both pickers become radio groups. The action bar pins to the bottom of the phone viewport, which
  collides with the `Toaster` lane — so `Toaster` gains a `viewportClassName` pass-through, the one
  `packages/ui` change — and needs a 52px `QuantityStepper` size to stand beside it. Drops the
  reviews, both product rails, the tabs, the
  size guide, the wishlist, the BNPL strip and the delivery promises for want of anything behind
  them; keeps the quantity stepper and the specs table, which the reference does not have

Then PLP (grid gap, header, card) and the `/cart` page. The 4:5 product
image, the `gap: 24px 4px` contact-sheet grid and the muted-eyebrow-plus-display-title page header
are the three patterns with the most left to give.
