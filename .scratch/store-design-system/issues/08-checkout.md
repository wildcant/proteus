# 08 — Checkout

Checkout is the last screen in the store still built on the pre-design-system vocabulary, and the
only one whose *structure* is wrong rather than just its tokens. `checkout-step.tsx` hardcodes
`rounded-full`, `border-border`, `text-(--foreground-muted)` and `text-green-600`; `checkout-summary.tsx`
is a `rounded-lg border` card. Neither has been near `01-token-foundation.md`.

Underneath that, the flow is a five-step accordion driven by `?step=` — `contact`, `address`,
`delivery`, `payment`, `review` — where each step is a form ending in a "Continue to …" button and
every other step is collapsed to a one-line summary with an Edit link. A shopper who wants to check
their address against the shipping rate has to collapse one and open the other. The reference, and
every checkout Shopify has shipped since 2023, puts all of it on one page.

So this ticket is two things at once: the token pass, and the collapse of five steps into one page.
They are one ticket because doing the first without the second means restyling `CheckoutStep`,
which the second deletes.

Depends on `01-token-foundation.md`, `02-auth-pages.md` (the floating-label input), `07-cart-drawer.md`
(the line-item metrics and the `variantOptionValues` payload field).

## The reference

Captured from the live reference checkout at 1440×1000 and 390×844, `deviceScaleFactor: 1` — so the
capture is in CSS pixels and **the scale factor is 1**. Every number below is read directly off
`getBoundingClientRect()` and `getComputedStyle()`, not off a scaled screenshot.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ WORDMARK                                                                     │ 66px, white
├──────────────────────────────────────┬───────────────────────────────────────┤
│                                      │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│   ┌──────────────────────────────┐   │▓  ┌───┐ Pumper Pants      $60.00    ▓│
│   │ ⓘ  ARE YOU ON THE RIGHT…     │   │▓  │img│ Small                       ▓│
│   └──────────────────────────────┘   │▓  └───┘                             ▓│
│   ┌──────────────────────────────┐   │▓                                    ▓│
│   │ ⓘ  ORDERS TO MEXICO          │   │▓  ┌──────────────────────┐ ┌──────┐ ▓│
│   └──────────────────────────────┘   │▓  │ Gift Card / Discount │ │Apply │ ▓│
│           Express checkout           │▓  └──────────────────────┘ └──────┘ ▓│
│   ┌────────┐ ┌────────┐ ┌────────┐   │▓                                    ▓│
│   │  shop  │ │ PayPal │ │ G Pay  │   │▓  Subtotal                  $60.00  ▓│
│   └────────┘ └────────┘ └────────┘   │▓  Shipping     Enter shipping addr  ▓│
│   ─────────────  OR  ─────────────   │▓                                    ▓│
│                                      │▓  Total              USD    $60.00  ▓│
│   CONTACT                   Sign in  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│   ┌──────────────────────────────┐   │                                       │
│   │ Email                     ⓘ  │   │                                       │
│   └──────────────────────────────┘   │                                       │
│   ☐ Tick here to receive emails…     │                                       │
│   ┌──────────────────────────────┐   │                                       │
│   │ View our Privacy Policy.     │   │                                       │
│   └──────────────────────────────┘   │                                       │
│                                      │                                       │
│   DELIVERY                           │                                       │
│   ┌──────────────────────────────┐   │                                       │
│   │ Country/Region            ⌄  │   │                                       │
│   └──────────────────────────────┘   │                                       │
│   ┌─────────────┐ ┌──────────────┐   │                                       │
│   │ First name  │ │ Last name    │   │                                       │
│   └─────────────┘ └──────────────┘   │                                       │
│   ┌──────────────────────────────┐   │                                       │
│   │ Address Line 1               │   │                                       │
│   └──────────────────────────────┘   │                                       │
│   ┌─────────────┐ ┌──────────────┐   │                                       │
│   │ Line 2      │ │ District     │   │                                       │
│   └─────────────┘ └──────────────┘   │                                       │
│   ┌─────────────┐ ┌──────────────┐   │                                       │
│   │ Postal code │ │ City         │   │                                       │
│   └─────────────┘ └──────────────┘   │                                       │
│   ┌──────────────────────────────┐   │                                       │
│   │ Region                    ⌄  │   │                                       │
│   └──────────────────────────────┘   │                                       │
│   ┌──────────────────────────────┐   │                                       │
│   │ Phone                     ⓘ  │   │                                       │
│   └──────────────────────────────┘   │                                       │
│                                      │                                       │
│   SHIPPING METHOD                    │                                       │
│   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   │                                       │
│   ▒ Enter your shipping address  ▒   │  ← the dependency, stated             │
│   ▒ to view shipping methods.    ▒   │                                       │
│   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   │                                       │
│                                      │                                       │
│   PAYMENT                            │                                       │
│   All transactions are secure…       │                                       │
│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │                                       │
│   ┃ ◉ Credit/Debit Card  VISA MC ┃   │  ← selected row: 2px ink border,      │
│   ┠──────────────────────────────┨   │    fields nested beneath on subtle    │
│   ┃ ░ card number             🔒 ┃   │                                       │
│   ┃ ░ expiry  ░ cvc              ┃   │                                       │
│   ┃ ☑ Use shipping as billing    ┃   │                                       │
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │                                       │
│   │ ○ PayPal            PayPal   │   │                                       │
│   └──────────────────────────────┘   │                                       │
│   By placing your order you agree…   │                                       │
│   ┌──────────────────────────────┐   │                                       │
│   │          Pay Now             │   │                                       │
│   └──────────────────────────────┘   │                                       │
└──────────────────────────────────────┴───────────────────────────────────────┘
   Refund policy · Privacy policy · Terms of service
```

At phone width the summary moves to the **top** as a collapsed disclosure carrying the total, and
the form runs beneath it. It is a reorder, not a second layout:

```
 ─────────────────────────────
  WORDMARK
 ─────────────────────────────
 ▒ Order summary  ⌄   $60.00 ▒   ← 64px, --surface-subtle, hairline under
 ─────────────────────────────
   ┌───┐ Pumper Pants  $60.00     ← revealed on tap
   │img│ Small
   └───┘
   ┌────────────────┐ ┌───────┐
   │ Discount code  │ │ Apply │
   └────────────────┘ └───────┘
   Subtotal            $60.00
   Shipping   Enter shipping…
   Total        USD    $60.00
 ─────────────────────────────
   CONTACT             Sign in
   …the same form, stacked…
   ┌───────────────────────┐
   │       Pay Now         │
   └───────────────────────┘
```

### Measured

Scale is 1, so the capture column *is* the CSS pixel value.

| | Capture (1440) | We use |
|---|---|---|
| Header bar | 66px, `#fff`, hairline under | unchanged — `_checkout/route.tsx` already ships this |
| Split | at x=770 of 1440 | `lg:grid-cols-2` on a full-bleed wrapper |
| Left pane | 0–769, `#ffffff` | `bg-surface` |
| Right pane | 770–1440, `#f5f5f5` | `bg-surface-subtle` (`#f4f5f6`) |
| Left inner column | 499 wide, x230–729 | `max-w-125`, pushed to the split |
| Right inner column | 400 wide, x810–1210 | `max-w-100`, pushed to the split |
| Gutter either side of split | 41 / 40 | `lg:px-10` |
| Section heading | 16px · 600 · uppercase | `type-heading` — see decision |
| Sub-heading (`SHIPPING METHOD`) | 15px · 600 · uppercase | `type-heading`, same role |
| Section gap | ≈32px between blocks | `space-y-8` |
| Heading → first control | ≈14–16px | `mt-4` |
| Input | 48px tall, 14px, `radius 0`, 1px `#dee0e3` | `FloatingLabelInput` (56px) — see decision |
| Field gap | 12px both axes | `gap-4` (16px) — see decision |
| Two-up fields | 243 + 12 + 243 | `sm:grid-cols-2` |
| Shipping placeholder box | 499×51, `#f6f6f6`, `padding 16px`, copy centred, 14px | `bg-surface-subtle p-4 text-center text-sm` |
| Submit button | 499×59, `#000` on white text, 14px · 500, `radius 0`, `padding 20px`, **title case** | `Button` `w-full` (`h-13`, 52px) |
| "Sign in" link | 14px · 500, underlined ink, right-aligned on the `CONTACT` row | `Button variant="link"` (bold + underline) |
| Summary thumbnail | 64×64, `object-fit: contain` | `aspect-4/5 w-16` `object-cover` — see decision |
| Summary title | 14px · 500 ink, x890 (16px from thumb) | `text-sm` + `gap-4` |
| Summary variant line | 13px, `rgba(0,0,0,.56)` | `text-xs text-ink-muted` |
| Summary money rows | 14px · 500 | `text-sm` |
| Summary total | 16px · 600 | `font-bold text-base` |
| Mobile disclosure row | 390×64, `#f6f6f6`, 1px `#dfdfdf` under | `h-16 bg-surface-subtle border-line border-b` |
| Mobile page gutter | 14–15px | `px-4` |

## What we can actually back

| Slot | Us | Why |
|---|---|---|
| Wordmark header | ship, keep our back-link | `_checkout/route.tsx` already renders it; `cart.spec.ts` asserts the back link |
| Store notice boxes | dropped | nothing in the system publishes a store notice; two hardcoded paragraphs would be the only fiction on the page |
| Express checkout wallets + `OR` rule | dropped | `modules/payment/providers/` holds exactly one provider, `system` / "Manual Payment", `isTestOnly: true`. There is no wallet to render, so the divider has nothing to divide |
| `CONTACT` heading + email | ship | `UpdateCart.email`, and `complete-cart.ts` `validate-cart-email` makes it mandatory anyway |
| "Sign in" beside `CONTACT` | ship, **with a fix** | `/login` exists but `use-auth-success.ts` always navigates to `/account`, so today the link would eat the checkout. See decisions |
| Marketing consent checkbox | dropped | no `customer.acceptsMarketing` column and no consent flow — the same finding `04-footer.md` recorded against the email-signup tile |
| Privacy-policy box | dropped | `/privacy` does not exist. Blocked in `04-footer.md`, blocked here |
| `DELIVERY` address form | ship, **plus `address2`** | `CartAddressInput` carries all ten fields. `shipping-address-form.tsx` renders nine of them — `address2` is in the schema and in `EMPTY_ADDRESS` and has never been rendered, so an apartment number cannot be entered at checkout while `address-form.tsx` in the address book accepts one |
| Country as a `<select>`, first | ship | `CountryOptions` already exists and is already used here |
| Region as a `<select>` | dropped | no subdivision data for any country. Stays the free-text `State / Province` it is today |
| Saved-address picker | **deferred**, see Blocked | `addressesQueryOptions` is real, but the reference's own capture is a guest session and this is net-new UI, not a redesign of anything |
| `SHIPPING METHOD` + its dependency placeholder | ship, **and wire the dependency** | `listStoreCartShippingOptions(id, params)` already accepts `countryCode`/`province`/`city`/`postalCode`; the store passes none, so `route.ts` falls through to its `?? 'us'` default and lists US options for an empty address |
| Payment provider radio list | ship | `listStorePaymentProviders` is real; the `isTestOnly` warning already renders |
| Card fields, brand marks, PayPal row | dropped | there is no PSP. Manual Payment collects nothing |
| Billing-same-as-shipping checkbox | ship | `UpdateCart.billingAddress` is real and the checkbox exists today |
| Terms / privacy line above the button | **blocked** | `/terms` and `/privacy` do not exist. `review-step.tsx` prints "you agree to our terms of service and privacy policy" as unlinked plain text today — an assertion about documents nobody can read |
| `Pay Now` | ship as **"Place order"** | existing copy, and three e2e specs match `/place order/i` |
| Footer legal links | dropped | same blocker |
| Discount / gift card field + Apply | dropped | no promotion module, no discount column on the cart, and `StoreCartTotals` is `{ itemsTotal, shippingTotal, cartTotal }` — there is no line to move |
| "Remember me" / save-my-info | dropped | that is Shop Pay, a Shopify network feature |
| Summary line items with qty badge | ship | `items[]` carries `thumbnail`, `title`, `variantOptionValues`, `quantity`, `lineTotal` |
| Subtotal / Shipping / Total | ship | exactly the three fields `StoreCartTotals` has |
| Tax line | dropped | no tax module; totals have no tax field |
| Mobile summary disclosure | ship | `Collapsible` is already exported from `@proteus/ui` |

## Decisions

**One page, no steps.** `?step=` goes, and with it `constants.ts`, `checkout-step.tsx`,
`use-checkout-progress.ts`, `address-summary.tsx` and all five "Continue to …" buttons. Every
section is visible at once and the page has one submit.

The rejected alternative is keeping the accordion and only restyling it. It is cheaper and it is
what the current e2e specs are written against — but the accordion's cost is not cosmetic. A
shopper comparing a shipping rate against the address it was quoted for cannot see both. Deep
linking `?step=review` renders the place-order button with no address saved, and the only thing
stopping the order is a 400 from `complete-cart.ts`. And `stepNumber()` renumbers every step
depending on whether the shopper is a guest, so "step 3" means two different things to two
shoppers. One page removes the state that makes all three possible.

**The address commits on blur, not on a button.** This is what makes one page work. When the
address values are valid *and* differ from what is already on the cart, focus leaving a field fires
one `updateCart({ shippingAddress, billingAddress })`. That single write is what unlocks the
shipping-method list, exactly as the reference's placeholder copy promises. Same model for the
email field.

Rejected: a "Save address" button. It is a Continue button with a different label — the shopper
still has to press something before the rates appear, which is the interaction the ticket exists to
remove. Also rejected: committing per-field on every blur, which would fire eight `POST`s and eight
failed validations on the way to one valid address.

Two guards make this safe. The commit is skipped unless the values differ from the cart's — without
it `PREFILL_FORMS` in dev would fire a write on mount — and the comparison already has a shape to
copy: `isSameAddress` / `toAddressValues` in `shipping-address-form.tsx` exist for precisely this,
to tell whether two address rows hold the same fields.

**The commit reads validity by parsing the values itself, not from form state.** Every form in this
store validates `onSubmit` only — `use-shipping-address-form.ts:61`, `use-contact-form.ts:35`,
`use-create-address-form.ts:18` and seven more. Before a first submit, `state.isValid` is vacuously
true, so there is nothing on the form to subscribe to. The commit therefore runs
`shippingAddressSchema.safeParse(form.state.values)` for itself and writes on success.

The trigger is one `onBlur` on the element wrapping the fields, not a prop on each field: React's
`onBlur` is `focusout`, which bubbles, and neither `TextField` nor `SelectField` exposes `onBlur`
anyway — their prop `Pick`s stop at `type | disabled | autoComplete | autoFocus | className`.

Rejected: moving the schema to an `onBlur` validator so `isValid` becomes real. It looks like the
tidier fix and it breaks two things quietly. `isFieldRequired` reads `validators?.onSubmit`
specifically — `text-field.tsx:18`, `select-field.tsx:16` — so every required marker on the page
disappears unless that helper is widened too; and validating on blur means a shopper who tabs
through an empty form is shown eight errors for fields they have not filled yet. Parsing in the
commit keeps the change inside checkout and leaves the other nine forms alone.

**The guest's name moves from the contact section to the address commit.** The reference's `CONTACT`
is email only, and ours becomes email only too. But today `use-contact-form.ts` sends
`{ email, firstName, lastName }`, and `updateCartWorkflow` passes those two through to
`find-or-create-customer.ts`, which is what names the guest customer record. Dropping the fields
without moving them would silently start writing nameless guest customers.

So the address commit sends `firstName` and `lastName` alongside `shippingAddress` — the same two
names the shopper has just typed into the address block. `UpdateCart` already accepts all four keys
in one body, so this is one write, not two.

**The split is full-bleed; the grey runs to the viewport edge.** Today checkout is a `max-w-350`
container with `lg:grid-cols-[1fr_380px]` and the summary is a `rounded-lg border` card floating
inside it. The reference's summary is not a card, it is *the other half of the page* — and that is
the whole idea: the form is a white workspace and the order is a grey ledger beside it.

Mechanically the wrapper is full width, `lg:grid-cols-2`, and each pane holds its own inner column
hugging the centre line — `max-w-125` right-aligned on the left, `max-w-100` left-aligned on the
right. The rejected alternative is keeping the contained grid and just repainting the card; the
result is a grey rectangle floating on white, which reads as a widget, not a place.

Note this makes checkout the first store surface that is *not* `max-w-350`. That is deliberate and
it is only checkout: it has no nav, no footer and no product grid to line up with.

**Section headings use `type-heading`, which is heavier than the reference's.** The reference runs
16px · 600; `type-heading` is 20px · 800, both uppercase. We take ours. `type-heading` is the role
`01-token-foundation.md` defined for exactly this — a section title — and `cart-drawer.tsx` already
sets "Your Bag" and "Order summary" in it. Introducing a second, lighter section-heading role for
one screen would mean the store has two answers to the same question.

**Inputs stay 56px, fields stay `gap-4`.** The reference's checkout inputs are 48px and its field
gaps are 12px — denser than its own login, which `reference.md` measured at ~56px. Our
`FloatingLabelInput` is 56px and shipped in `02-auth-pages.md`; every form in the store uses it at
`gap-4`. Matching the reference here would give checkout inputs that are 8px shorter than the
address book's, on the same fields, with the same labels. Consistency wins over a 8px match.

**Country comes first in the address block.** The reference orders it Country → names → address →
locality → phone; ours currently buries Country between City and State. Country first is the honest
order — it is the field that determines which shipping options exist and what the rest of the
address means. It also makes the placeholder box's promise legible: the first thing you fill is the
first thing the rates depend on.

**Summary thumbnails are 4:5 `object-cover`, not the reference's 64×64 `contain`.** The reference
letterboxes a square. Every product image in this store is 4:5 — the PLP card, the PDP, the cart
drawer row — and `cart-drawer-item.tsx` already crops to it. A checkout that letterboxes the same
photo the drawer just cropped looks like a different site.

**The mobile disclosure and the desktop summary are two trees, both fed from one body.**
`CheckoutSummaryBody` renders items + totals and knows nothing about either. `CheckoutSummaryPanel`
(`hidden lg:block`) wraps it in the grey column; `CheckoutSummaryDisclosure` (`lg:hidden`) wraps it
in a `Collapsible` with the total in the trigger.

`spec.md` warns against structural switches across breakpoints and `04-footer.md` established the
exception: the switch is pure CSS, so the server renders both and the browser picks with no viewport
detection and no first-paint flash, and `display: none` keeps the hidden tree out of the
accessibility tree. A `Collapsible` forced open above `lg` is not something CSS can express — its
open state is a data attribute driving a height variable — so this is the same sanctioned case.

**The "Sign in" link gets a `redirect` search param, or it does not ship.** `/login` exists, but
`use-auth-success.ts` navigates to `/account` unconditionally. A shopper who taps Sign in from
checkout would sign in, watch their cart transfer, and land on the account dashboard with the
checkout gone. That is `04-footer.md`'s "no link points at `/` as a placeholder" rule in a different
costume — a link that quietly discards what you were doing.

The fix is small enough to be in scope: a `redirect` search param on `/login`, and
`useAuthSuccess` navigating to it when present. Rejected: dropping the link. Guest checkout works
without it, but a returning shopper's saved details are the reason they made an account, and the
reference gives it the most valuable slot on the page.

## Work

- **`src/routes/_checkout/checkout.tsx`** — drop `validateSearch` and the `checkoutSearchSchema`
  declared just above it at `checkout.tsx:9–13`; the schema is local to this file, not imported, so
  what goes with it are the `z` and `#/features/checkout/constants` imports at `checkout.tsx:3`
  and `:7`. The route keeps its `prefetchQuery` loader and its `<Suspense fallback={<CheckoutSkeleton />}>`.
  A bookmarked `?step=review` is then an unvalidated search param the route ignores; it must not
  throw, which is what removing the validator gets us.

- **`src/features/checkout/constants.ts`** — delete. `Step`, `STEPS`, `AUTHED_STEPS` and `LAST_STEP`
  have no reader left.

- **`src/features/checkout/components/checkout-step.tsx`** — delete. Everything it did goes:
  the numbered badge, the `CheckCircle2Icon` completion tick, the Edit button, the collapsed
  summary line, and the `Collapsible` itself. Nothing on a one-page checkout is collapsed, so
  none of it has a replacement — which is the point of naming them all here.

- **`src/features/checkout/components/address-summary.tsx`** — delete. It was the collapsed
  read-back of the address step; the filled fields are the read-back now.

- **`src/features/checkout/hooks/use-checkout-progress.ts`** — delete, but three of its seven
  return values must survive somewhere:
  - `isGuest` → read directly in `CheckoutContent`; it still decides whether the contact section
    renders at all.
  - `lastShippingMethod` → moves onto the shipping section, which needs
    `cart.shippingMethods.at(-1)?.shippingOptionId` to mark the selected radio on a cold load.
  - `hasAddress` → becomes the shipping section's gate.
  `hasContact`, `hasShipping`, `goToStep` and `stepNumber` have no successor and are gone.
  `hasShipping`'s only reader is the Delivery step's `isComplete` (`checkout-form.tsx:51`), which
  a one-page checkout has nothing to mark complete.

- **`src/features/checkout/components/checkout-content.tsx`** — rewrite as the split. Full-bleed
  `lg:grid-cols-2`; left pane `bg-surface` with a `max-w-125` column pushed to the split, right pane
  `bg-surface-subtle` with a `max-w-100` column and `lg:sticky lg:top-10`. Keeps the
  `!cart || cart.items.length === 0 → <Navigate to="/cart" />` guard. Loses the
  `!isGuest() && step === CONTACT` redirect, which has nothing left to redirect.

  Order in the DOM is summary-then-form, so the phone gets the disclosure first and `lg:` places
  them left and right.

- **`src/features/checkout/components/checkout-form.tsx`** — kept, and it is now honestly named: one
  form, one submit. It loses all four of its current imports — `Step`, `useCheckoutProgress`,
  `AddressSummary`, `CheckoutStep` — and becomes the left pane's section stack, `space-y-8`, ending
  in the place-order button.

  Keeping it rather than folding the sections into `CheckoutContent` is what gives `providerId`
  somewhere to live. `PaymentForm` selects a provider and `PlaceOrder` needs it to create the
  session; they are siblings, so the state belongs in the parent that renders both, and that parent
  should not also be the one owning the split, the cart guard and the summary. `CheckoutContent`
  keeps the layout; `CheckoutForm` keeps the flow.

  It also keeps the `isGuest()` gate on the contact section and the `currencyCode` /
  `selectedMethodId` it already passes into `ShippingMethodForm` — `selectedMethodId` now read as
  `cart.shippingMethods.at(-1)?.shippingOptionId` inline, since `useCheckoutProgress` is gone.

- **`src/features/checkout/components/checkout-section.tsx` (new)** — `type-heading` title, an
  optional right-hand slot (the Sign in link), optional muted description ("All transactions are
  secure and encrypted" has no equivalent here, but the shipping section wants one), and children
  at `mt-4`. Sections are separated by `space-y-8`, not rules — the reference uses space.

  Not `CheckoutStep`: that component's entire surface is `isOpen` / `isComplete` / `onEdit`, none of
  which exist any more.

- **`src/features/checkout/components/contact-form.tsx`** — rewrite to email only, no submit button.
  `useContactForm` loses `firstName`/`lastName` and gains the same `commit` — one field, so the
  `onBlur` sits on it directly rather than on a wrapper. The section header carries the Sign in
  link, rendered only when `isGuest()`.

- **`src/features/checkout/components/shipping-address-form.tsx`** — rewrite. No submit button; the
  commit-on-blur described above, sending `{ firstName, lastName, shippingAddress, billingAddress }`
  in one body. Field order becomes Country → First/Last → Address → `Apartment, suite, etc.`
  (`address2`, the label the address book already uses at `address-form.tsx:48`) → Company
  → City / Postal code → State / Province → Phone. Keeps the `sameAsBilling` checkbox and the
  `form.Subscribe` billing block underneath it verbatim — that logic is correct and nothing here
  changes it.

- **`src/features/checkout/hooks/use-shipping-address-form.ts`** — add `firstName`/`lastName` to the
  schema and to both defaults objects, add the `address2` label, and export a `commit` the component
  hangs on one wrapping `onBlur`. `commit` is where `safeParse` runs — the hook already closes over
  the schema, and the component should not be the thing deciding what "valid" means. The
  `isSameAddress` / `toAddressValues` pair moves here from the component too, since the hook is what
  now needs to know whether anything changed.

  `onSubmit` stays as the form's validator, untouched, so the required markers `isFieldRequired`
  derives from it keep rendering.

- **`src/features/checkout/components/shipping-method-form.tsx`** — rewrite as a gated radio list,
  no submit button. Selecting a radio fires `addShippingMethod` immediately. Four states, not the
  current two:
  1. no `cart.shippingAddress` → the placeholder box, "Enter your shipping address to view available
     shipping methods."
  2. address present, query in flight → the existing two `Skeleton` rows.
  3. address present, zero options → "No shipping options available for your address." — the current
     copy, which is finally *true*, because today it renders for an empty address too.
  4. options → the radio rows.

  Selected row is a 2px ink border rather than `has-data-checked:border-primary
  has-data-checked:bg-primary/5`; `--primary` is `--ink` now, so the tint is a 5% ink wash that reads
  as a disabled state.

- **`src/features/checkout/hooks/use-shipping-method-form.ts`** — delete, for the same reason
  `use-payment-form.ts` goes: a radio that fires `addShippingMethod` on select has no form to
  validate and no submit to hold. The section calls `useSelectShippingMethod` (`api/checkout.ts:73`)
  directly, which is what `useShippingMethodForm` was wrapping.

- **`src/features/checkout/api/checkout.ts`** — `useShippingOptions` takes the address, not just the
  cart id: `useShippingOptions(cartId, address)` passing `{ countryCode, province, city, postalCode }`
  through to the generated client's `params`, with `enabled: !!cartId && !!address`. The query key
  gains the address so a changed country refetches. No backend change — the flat params land in
  `validatedQuery.filters` via the standard query parser, and `route.ts`'s `?? 'us'` fallback stops
  being what answers.

- **`src/features/checkout/components/payment-form.tsx`** — restyle, and unwrap. Same providers query, same
  `isTestOnly` notice, same radio group; the border/tint treatment matches the shipping rows and the
  amber notice moves to tokens. Loses its submit button and its form entirely: it becomes a
  controlled radio group taking `value` and `onValueChange` from `CheckoutForm`, which is what holds
  `providerId`.

- **`src/features/checkout/components/review-step.tsx`** → **`place-order.tsx`**. The full-width
  "Place order" button plus its inline error, taking `providerId` as a prop. Its `useReviewStep`
  becomes `usePlaceOrder(providerId)`, which now owns the whole tail of the flow: create the payment
  collection, create the session for the selected provider, then `completeCart`. That sequencing is
  what `use-payment-form.ts` does today and it moves here wholesale — `complete-cart.ts`'s `validate-cart-payments` step demands a
  collection *and* a session before it will do anything, so the button cannot skip it.

  Drops the "you agree to our terms of service and privacy policy" sentence — see Blocked.

- **`src/features/checkout/hooks/use-payment-form.ts`** — delete once `usePlaceOrder` owns the
  collection/session pair. `usePaymentForm`'s only other job was holding `providerId`, which is now
  one `useState` in `CheckoutForm`.

- **`src/features/checkout/components/checkout-summary.tsx`** — split into three:
  `checkout-summary-body.tsx` (items + totals), `checkout-summary-panel.tsx` (`hidden lg:block`) and
  `checkout-summary-disclosure.tsx` (`lg:hidden`, `Collapsible`, total in the trigger). All three
  drop `rounded-lg border border-border` and `--foreground-muted` for `bg-surface-subtle` and
  `text-ink-muted`.

  The body's item row swaps its `variantTitle` line for `variantOptionValues` — `07-cart-drawer.md`
  widened `AddLineItem` to carry it and this is the second consumer. A swap, not an addition:
  `cart-drawer-item.tsx:59` renders `variantOptionValues` alone, and a summary printing both would
  put two spec lines under a title the drawer gives one. It also gains the quantity badge on the
  thumbnail corner, which is net-new — no row in the store draws one today. The
  `Shipping` row's fallback changes from "Calculated at next step" to "Enter shipping address": there
  is no next step to calculate at.

- **`src/features/checkout/components/checkout-skeleton.tsx`** — rewrite to the split. Its
  `rounded`/`rounded-lg`/`bg-(--bg-subtle)` all go; it should mirror the two-pane layout so the
  page does not jump when the cart resolves.

- **`src/routes/_auth/login.tsx` + `src/features/auth/hooks/use-auth-success.ts`** — a `redirect`
  search param, validated as an optional string, honoured in `handleSuccess` in place of the
  hardcoded `/account`. The `beforeLoad` redirect for an already-registered visitor should honour it
  too, otherwise a signed-in shopper who follows the link still lands on the account page.

## Responsive

Mobile-first: the base classes are the phone, `lg:` adds the split. Nothing is `lg:hidden`-ing a
desktop-first base except the summary pair, which is the sanctioned two-tree case above.

**Base (phone).** One column, `px-4`, in DOM order:

1. The summary disclosure — a 64px `bg-surface-subtle` row with a `border-line` rule under it,
   "Order summary" and a chevron on the left, the cart total on the right. Collapsed by default.
   Expanded it reveals the same body the desktop panel shows.
2. `CONTACT` — heading with the Sign in link on the same row, then the email field.
3. `DELIVERY` — every field full width, one per row. No `sm:grid-cols-2` pairs below `sm`.
4. `SHIPPING METHOD` — whichever of the four states applies.
5. `PAYMENT` — provider rows full width.
6. "Place order", full width.

**`sm:` and up.** The address block pairs up: First/Last, City/Postal code. Everything else stays
full width. The page is still one column — this is the phone layout at tablet width, not a
half-collapsed desktop.

**`lg:` and up.** The split. The disclosure is replaced by the grey panel on the right, which sticks
at `top-10`; the form column sits in the left pane pushed to the centre line. Section order in the
left pane is unchanged from the phone — only the summary moves.

Every radio row is the full column width at all three, which makes it the widest tap target on the
page. That is deliberate: shipping and payment selection are the two places a mis-tap costs the
shopper a page of scrolling to find what changed.

## States the reference cannot show you

- **Cold entry.** `/checkout` deep-linked with nothing in the query cache. The route's loader
  `prefetchQuery`s the cart and `CheckoutContent` reads it through `useSuspenseCart`, so the
  `<Suspense>` boundary already covers it — `CheckoutSkeleton` just has to be redrawn to the split
  so the page does not reflow underneath the shopper. This is the same SPA-route shape ADR 0013
  describes and `_main/cart.tsx` already uses.

- **Cold entry with a partly filled cart.** A shopper who abandoned at the address and came back has
  `cart.shippingAddress` set. The address form must hydrate from it — `getAddressDefaults` already
  does this — and the shipping section must render its options, not its placeholder, on first paint.
  The selected shipping radio hydrates from `cart.shippingMethods.at(-1)`.

- **Empty cart.** `<Navigate to="/cart" />`, unchanged. It fires only after the cart resolves, so it
  cannot race the skeleton.

- **Address commit in flight.** The gap between the last blur and the cart refetch. The shipping
  section must show the skeleton, not the placeholder, while `updateCart.isPending` — otherwise the
  shopper watches "Enter your shipping address" for a beat *after* entering their shipping address.

- **Shipping options empty.** Distinct from both loading and no-address, which is the bug this
  ticket fixes: today `options.length === 0` renders "No shipping options available for your address"
  for a shopper who has entered no address at all.

- **Place order in flight.** Three sequential mutations behind one button. It disables and reads
  "Placing order…" for the whole sequence — the existing copy — and the failure of any of the three
  surfaces in the same inline error slot. The mutation hooks already toast on error; the inline
  message is what stays on screen after the toast goes.

- **Place order with an incomplete cart.** No client-side gate stops the button; `complete-cart.ts`
  rejects with a `WorkflowTerminalError` naming what is missing — no shipping method, no email, an
  unavailable line item. Those messages reach the inline slot. Worth checking they read as
  shopper-facing copy before shipping; several are written for an API consumer.

- **Overflow.** A long product title in a 400px summary column, and a cart with more items than the
  panel's height. The reference caps the list and prints "Scroll for more items";
  `cart-drawer.tsx:92` is the pattern already in this codebase and is the one to reuse — one
  `min-h-0 flex-1 overflow-y-auto` region holding the rows *and* the totals, with the action below
  it as a flex sibling rather than sticky over it. Not a bottom mask: the drawer had one and dropped
  it for exactly this reason (`cart-drawer.tsx:130–132`) — a region that ends at the button's top
  edge never half-cuts a row, so there is nothing to fade.

- **A quantity past two digits.** The badge is a fixed circle on the thumbnail corner. `MAX_QUANTITY`
  is 10 in `cart-drawer-item.tsx`, so two digits is the ceiling — but the summary renders whatever
  the cart holds, and the cart is not the only thing that can write a line item.

## Blocked, and tracked elsewhere

**The terms line.** `/terms` and `/privacy` do not exist. `04-footer.md` already records this as a
launch blocker with two other symptoms — `register-form.tsx` asserting agreement to unreachable
documents, and Stripe/PayPal both requiring a published privacy policy. `review-step.tsx` is the
third: it prints the same assertion as unlinked plain text. This ticket deletes the sentence rather
than shipping it unlinked; the one ticket that writes those routes puts it back, linked, above the
button where the reference has it.

**The saved-address picker.** A signed-in shopper with addresses in `addressesQueryOptions` should
be able to pick one instead of retyping it. Everything needed exists —
`06-address-book.md` shipped the store endpoints and `address-lines.tsx` already renders one. It is
out of scope here because it is net-new UI rather than a redesign of anything on the reference
screen, and because it needs a decision this ticket has no reference for: what the picker does when
the shopper edits a filled-in address, and whether that edit writes back to the address book. Its
own ticket.

**Real payments.** The page ships a payment section with one test-only manual provider behind it.
`04-footer.md` records the same caveat for the payment marks strip: fine while the storefront is
pre-launch, and the payments gate in `.tasks/next-todos` already blocks going live. Checkout is the
screen where that gate matters most.

## Constraint

Three specs drive this surface: `checkout.spec.ts` and `cart.spec.ts` directly, and
`orders.spec.ts:39`, which only reaches checkout through `utils.ts` `placeOrder` — so it needs no
edit of its own, but it fails with `placeOrder` if the rewrite below is wrong.
Most of what they assert is `?step=` and "Continue to …", which is
exactly what the ticket deletes, so this is a large rewrite of test code — and every replacement
below must still be able to fail.

**Must keep working**

- `apps/store/tests/e2e/cart.spec.ts:85–99` — the layout assertions. `getByRole('link', { name: /back to cart/i })`
  visible, `getByLabel('Cart')` at count 0, `locator('footer')` not visible. The `_checkout` layout
  is untouched, so all four hold. Do not let the full-bleed split tempt anyone into moving the
  header.
- `getByRole('link', { name: /go to checkout/i })` — the cart drawer's and `/cart`'s entry points.
  Unchanged.
- `page.getByLabel('Email')` — the contact field keeps its label. It is now the only email field on
  the page rather than the only one in an open step, which makes the selector stronger, not weaker.
- `apps/store/tests/setup/utils.ts:5–16` `fillShippingAddress` — every one of its eight
  `getByLabel` calls survives: `First name`, `Last name`, `Address` (exact), `City`, `Country`,
  `State / Province`, `Postal code`, `Phone`. Field *order* changes and `Apartment` is added; neither
  is a selector. The `exact: true` on `Address` is still needed, and now guards against `Address`
  matching `Apartment, suite, etc.` as well as the billing checkbox.
- `getByRole('radio', { name: shipping.name })` and `getByRole('radio', { name: /manual payment/i })` —
  both stay radios with the same accessible names. They now select rather than select-and-continue.
- `getByRole('button', { name: /place order/i })` — the copy is deliberately kept.
- The confirmation assertions (`/thank you/i`, `Your order was placed successfully.`, the email) —
  `/order/$orderId/confirmed` is not in scope.

**Legitimately breaks**

- `await expect(page).toHaveURL(/step=contact/)` and the four `step=` assertions after it, in both
  `checkout.spec.ts` tests and in `utils.ts` `placeOrder`. There is no step in the URL. Replace each
  with an assertion on the thing the step used to prove:
  - `step=contact` → `await expect(page).toHaveURL(/\/checkout/)` plus
    `await expect(page.getByRole('heading', { name: 'Contact' })).toBeVisible()`.
  - `step=address` → the address heading visible. For the authenticated test, the *contact* heading
    not visible — which is the assertion that test already makes at line 113 and is now the whole
    of what "authenticated skips contact" means.
  - `step=delivery` → `await expect(page.getByRole('radio', { name: shipping.name })).toBeVisible()`,
    which the spec asserts on the next line anyway. Deleting the URL assertion loses nothing.
  - `step=payment`, `step=review` → same treatment.
- The four `getByRole('button', { name: /continue to …/i })` clicks in each spec and in `placeOrder`.
  Every one is deleted. What replaces the contact→address one is the blur that commits the email,
  which `fill()` does not fire on its own — the spec must `blur()` or move focus, and that is worth
  an explicit line with a comment, because it is the whole commit-on-blur decision expressed as a
  test.
- The address→delivery continue is likewise replaced by a blur after the last address field, and
  then waiting for the shipping radio to appear. That wait *is* the assertion that the address
  reached the cart and the rates were requested for it — a stronger claim than the URL ever made.

**Worth adding**

- One test that the shipping section shows its placeholder before an address is entered and its
  options after. That is the single behaviour this ticket adds that nothing else covers, and it is
  the one that silently regresses if `useShippingOptions` stops passing the address and starts
  answering from `?? 'us'` again.
- One at a phone viewport that the summary disclosure opens and reveals the line item. The two-tree
  split means `getByText('Order summary')` matches twice; scope with `.filter({ visible: true })`
  rather than `.first()`, per `04-footer.md`.
