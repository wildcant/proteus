# 07 — Cart drawer

The bag in the header is a hover popover (`features/cart/components/cart-dropdown.tsx`, 171 lines)
that lists five items, a subtotal and a "Go to cart" button — a preview of a page rather than a
place to do anything. It is also the last piece of chrome still on pre-foundation styling:
`text-(--foreground-muted)`, `border-border`, `rounded-lg` on a system whose `--radius` is `0`, and
a `bg-orange-300` sibling banner one file over. It renders twice — an `sm:hidden` `<Link to="/cart">`
and a `hidden sm:block` popover — so the bag behaves differently depending on the width, and two
elements answer to `aria-label="Cart"`, which is what forces `.last()` in three e2e specs.

Its auto-open is an effect watching the item count (`cart-dropdown.tsx:21`), so it fires on any
increase, including a background refetch that has nothing to do with the shopper.

The reference replaces all of it with one slide-over bag. **This ticket is the drawer only.**
`/cart` is left exactly as it is; see *Decisions*.

Depends on `01-token-foundation.md` and `03-header.md` (the modal-as-URL-state model and the
`Drawer` composition both come from there).

## The reference

A right-edge panel over a dimmed page. Desktop is the same panel, narrower than the viewport;
mobile is the same panel at full width.

```
┌────────────────────────────────────────────────┐
│ YOUR BAG                     [🛍] [♡]       ✕ │  ← tab pair + close
├────────────────────────────────────────────────┤
│ You're US$40 away from Free Standard Shipping ⓘ│
│ ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← progress to free shipping
│ US$0                                    US$100 │
│                                                │
│ ⓘ Your items aren't reserved, checkout quickly │  ← unreserved-stock notice
│                                                │
│ ┌──────┐  Sport Hybrid 6" Shorts            ♡ │
│ │ img  │  Black · S · Slim Fit                 │  ← variant options line
│ │ 4:5  │                                       │
│ └──────┘  US$60                    ─   1   ＋ │
├────────────────────────────────────────────────┤
│ ADD A LITTLE EXTRA                    (#f4f5f6)│
│ Add one or more of these items to get free…    │
│ ┌───────────────────────┐ ┌────────────────    │  ← cross-sell rail, scrolls
│ │ [img] Sale|Save US$12 │ │ [img] New          │
│ │ Mode Hybrid Tote  ＋Add│ │ <Brand> Crew So    │
│ │ US$28  U̶S̶$̶4̶0̶          │ │ US$22              │
│ └───────────────────────┘ └────────────────    │
├────────────────────────────────────────────────┤
│ ORDER SUMMARY                                  │
│ Sub Total                              US$60   │
│ Estimated Shipping                     US$9.50 │
│ Total                                US$69.50  │
│                    ⋮ (desktop: empty, pinned)  │
│ ┌────────────────────────────────────────────┐ │
│ │        🛍  Checkout securely               │ │
│ └────────────────────────────────────────────┘ │
│        VISA  MC  AMEX  PayPal  Pay             │
└────────────────────────────────────────────────┘
```

The one structural difference between the two widths is where the footer sits. On desktop the
summary block, the button and the payment strip are pinned to the bottom edge with dead space
between them and the totals; on mobile everything scrolls in one column and the button arrives
after the content.

### Measured

Both captures are scaled, so absolute pixels off them are meaningless — ratios are what transfer.
Solving for the scale against a value `reference.md` already has from the live site (the 52px
primary button) puts the mobile capture at **1.5×** and the desktop at **1.33×**, and every other
reading below is consistent with that, which is the check that the numbers are real.

| | Capture | ÷ scale | We use |
|---|---|---|---|
| Gutter, mobile | 24px | 16px | `px-4` — the header's gutter |
| Gutter, desktop | 32px | 24px | `lg:px-6` |
| Panel header row | 86px | 57px | `h-14` (56px) — the header bar's mobile height |
| Item thumbnail | 102 × 145 | 68 × 97 | `w-18` at 4:5 (72 × 90) |
| Checkout button | 75px | 50px | `h-13` (52px) — the system's primary button height |
| Panel width, desktop | 754 of 1722 | 567px | `lg:w-144` (36rem / 576px) |

Colour, type and spacing come from `reference.md`; nothing new is scraped here. The
`ADD A LITTLE EXTRA` band is `--surface-subtle` (`#f4f5f6`) — the same filled-utility treatment as
the header search field and the account panels.

## What we can actually back

| Slot | Us | Why |
|---|---|---|
| Bag / wishlist tab pair | **dropped**, bag only | no wishlist — same call as `03`'s side-menu heart |
| Free-shipping progress bar | **dropped** | no threshold anywhere; shipping is two flat options applied at any cart value |
| "Your items aren't reserved" | **ship** | it is literally true — see below |
| Item thumbnail, title, price | ship | `thumbnail` is resolved server-side at add time; `unitPrice`, `lineTotal` are on the line item |
| Variant options line | **ship, after a schema change** | the data exists on the PDP and `AddLineItem` throws it away — see *Work* |
| Per-item wishlist heart | dropped | as above |
| Quantity stepper | ship | `PATCH /store/carts/:id/line-items/:lineId` takes `quantity` |
| Sale price / strikethrough | **dropped** | `StoreCalculatedPrice` is `{ id, currencyCode, calculatedAmount }`. There is no original amount to strike through, and `cart_line_item.compare_at_unit_price` is written by nothing |
| "ADD A LITTLE EXTRA" rail | dropped | no recommendations, no product groups, no collections — the same gap `03` left a `TODO(product-groups)` for |
| Sub Total | ship | `cart.totals.itemsTotal` |
| Estimated Shipping | **dropped** | `shippingTotal` sums the cart's shipping *methods*, and a cart has none until the delivery step. It is `0` for every cart this panel will ever render |
| Total | ship | `cart.totals.cartTotal`, which equals the subtotal here for the same reason |
| Payment marks strip | dropped | see below |

The audit that decides most of this:

- **`AddLineItem`** (`packages/http-schemas/src/store/cart/payloads.ts:45`) accepts exactly
  `title`, `quantity`, `unitPrice`, `variantId`, `productId`, `productTitle`, `variantSku`. Zod
  strips the rest, so `variantTitle` and `variantOptionValues` are `null` on every line item in the
  database today — which is why `cart-item.tsx:28` and `checkout-summary.tsx:30` both guard the
  subtitle with `!!item.variantTitle` and neither has ever rendered it.
- **`StoreCalculatedPrice`** carries one amount. `add-to-cart.tsx:28` sends
  `selectedVariant.calculatedPrice.calculatedAmount` as `unitPrice` and there is no second price to
  send.
- **Reservations happen at completion, not at add.** `createReservationItems` is called once, from
  `complete-cart.ts:307`. Nothing else in the codebase reserves anything. Items sitting in a cart
  are not held.
- **No free-shipping rule exists.** `shipping_option` is `{ name, priceType, amount, … }` with no
  threshold column, `listShippingOptionsForContext` filters on geography only, and `seed-dev.ts:613`
  creates Standard (500) and Express (1500) flat. There is no cart value at which shipping becomes
  free.
- **Payment providers**: `payment/providers/` holds one, `system`, labelled "Manual Payment",
  `isTestOnly = true`.

## Decisions

**The drawer replaces the popover; `/cart` is untouched by this ticket.** The route keeps its
current two-column layout, stays linked from the side menu and the footer, and keeps its e2e
journey passing unmodified — which is the point of leaving it alone: it is the regression net while
the drawer is new. The header's bag no longer navigates there at any width.

The alternative was one `CartPanel` hosted by both the drawer and the route. Rejected for now
because it makes the route's rewrite a precondition of the drawer's, and doubles the surface the
first version has to get right. It stays the likely end state; see *Decisions still open*.

**Both bag triggers collapse into one.** The `sm:hidden` link and the `hidden sm:block` popover
become a single button that sets `?modal=cart` at every width. This is what removes the `.last()`
from three specs — deliberately, so a second `aria-label="Cart"` can never silently reappear.

**Opening is caused by the mutation, not observed from the count.** `useAddLineItem`'s `onSuccess`
opens the panel. The current effect watches `itemCount` and fires on any increase, so a refetch
that picks up a cart mutated in another tab pops the panel open in this one. Reacting to the
`onSuccess` of the click the shopper actually made has no such failure mode, and it deletes the
`previousCountRef` / `timerRef` / `isHoveredRef` trio along with the 5-second auto-close.

There is no auto-close. The panel is URL state, so closing it is a navigation, and a modal that
navigates on a timer takes the back button with it.

**The panel is `?modal=cart` on the same enum as `menu` and `search`.** `MODAL_NAMES` gains a third
member and everything else — the root schema, `useModal`, push-to-open / replace-to-close, hardware
back — is inherited. Two overlays open at once stays unrepresentable, so tapping the bag while the
side menu is open swaps them in one navigation rather than stacking.

It also means the drawer mounts in `Header`, which only `_main` renders. `/checkout` therefore
cannot open it, and `?modal=cart` typed against a checkout URL does nothing — the right behaviour,
for free.

**No auto-open on `/cart`.** The current code guards on `isOnCartPage`. That guard is dead — the
only caller of `useAddLineItem` is the PDP's `AddToCart` — so it goes rather than being ported.

**A cold open shows skeletons, not the empty state.** `useCart` is non-suspending and returns
`cart: null` until the first read resolves, so "Your cart is empty" is what a shopper with items
would see for the width of a request. The popover being deleted has an `isLoading` branch
(`cart-dropdown.tsx:83`); dropping it silently would be a regression. Three skeleton rows while
`isLoading`, and the empty state only once the cart has resolved and is genuinely empty.

It rarely fires on the common path — the panel is usually opened by the mutation that just
populated the cache — but `?modal=cart` is linkable, so a cold open is a real entry point.

**The stepper disables while its mutation is in flight.** `cart-item.tsx:11` already establishes
the pattern for the page: `isMutating = updateLineItem.isPending || removeLineItem.isPending`
passed to `disabled`, with the trash swapping to a `Loader2Icon`. The panel reuses it rather than
inventing a second one. Without it the two buttons sit close enough together that a spammed tap
fires overlapping `PATCH`es, and the panel is small enough that the resulting flicker is the whole
view.

**The toast goes; the panel is the confirmation.** "Added to cart" appearing on top of a panel that
just slid in and shows the item is the same message twice. Shopify's Dawn opens its cart drawer and
does not toast; Medusa's starter does neither. Error toasts stay — `useAddLineItem`'s `onError`
is untouched, because a failure has nothing to show a panel about.

This breaks a real assertion in three places. See *Constraint*.

**We say "Cart", not "Bag".** The reference's panel is "YOUR BAG". Everything in this codebase says
cart: the route, `aria-label="Cart"`, "Add to cart", the footer column, `cartQueryKeys`, four e2e
specs. Introducing a second noun for one surface buys the reference's voice at the cost of the
storefront's consistency, and the shopper is the one who pays. Title reads **"Your cart"** at
`type-heading`.

**The unreserved-stock notice ships, and it is the honest line on the panel.** Nothing reserves
cart stock — and per `.tasks/next-todos`, nothing reserves order stock either, so the same unit can
be sold repeatedly. The reference's copy is a nudge; here it is a disclosure. Copy:
*"Items in your cart aren't reserved. Check out soon to make sure you don't miss out."* Muted body
beside an `InfoIcon`, no border, no tinted panel — it is a note, not an alert, and `--sale` is
reserved for things that have gone wrong.

**The free-shipping bar is dropped, not stubbed.** It is the largest element in the reference and
the one with least behind it. A bar that fills toward a reward checkout will not grant is a promise
the shopper walks into. Rejected: a store-side `FREE_SHIPPING_THRESHOLD` constant — it would render
correctly and still be a lie, because the delivery step charges $5 or $15 whatever the cart is
worth. It comes back with a shipping-rules ticket, and it needs the backend to own the threshold so
the panel and the delivery step cannot disagree.

**"Estimated Shipping" is dropped for the same reason, and its absence changes the summary.** With
no shipping line, `Sub Total` and `Total` are always the same number, and printing one value twice
under two labels reads like a bug. The summary is therefore a single **Total**, with
*"Shipping calculated at checkout"* as a muted line beneath it — which is what
`checkout-summary.tsx:47` already says in the one place a shipping figure genuinely is unknown.

**This makes the panel and `/cart` label the same cart differently, and that is temporary.**
`cart-content.tsx:35` prints `Items total` and then `Total`. Those are the same number for the
same reason the panel's would have been, so the page has the problem the panel just avoided — but
fixing it means editing the page, which this ticket does not touch. It is a real inconsistency,
not a considered split; see *Decisions still open* so the `/cart` pass inherits it.

**No payment strip on the panel.** The footer ships one and `04` recorded it as aspirational — one
test-only manual provider, no card acceptance. Repeating an unbacked claim directly beside the
primary conversion button is where it does the most persuading and the most damage. The footer's
strip is a signal about the store; a strip at the checkout button is a claim about what will happen
next, and that claim is currently false. It ships when a real provider does.

The button reads **"Checkout"**, not "Checkout securely", for the same reason.

**`−` at quantity 1 removes the item.** The reference's row has no remove control — the stepper is
the only affordance, and this is what Dawn does too. The button swaps its icon to a trash and its
label to `Remove {title}`, so the destructive action is announced as destructive and the row does
not carry a permanently-armed delete where the reference put a wishlist heart. Rejected: keeping a
separate trash button in that corner, which puts a one-tap destructive action at the top of every
row with nothing between it and a mis-tap.

**The footer block is pinned at both widths, which is a divergence.** The reference pins the
summary and button to the bottom edge on desktop and lets them scroll on mobile. A phone bag with
six items would bury the checkout button below three screens of scroll, so ours is
`sticky bottom-0` at every width, on `bg-surface` with a `border-line` top edge. The item list is
the only region that scrolls.

## Work

### Backend — carry the variant onto the line item

- **`packages/http-schemas/src/store/cart/payloads.ts`** — `AddLineItem` gains
  `variantTitle: z.string().optional()` and `variantOptionValues: z.string().optional()`. Both
  columns already exist on `cart_line_item` and both are already on `StoreCartLineItem`; the
  payload is the only thing dropping them. No migration.
- **`npm run openapi:generate`** — regenerates `AddStoreCartLineItemBody` for the store and admin
  clients. Nothing else in the spec moves.

`productHandle` is deliberately not added: the store's PDP route is `/products/$productId` and
`productId` is already carried, so the item title can link back without it.

### Store

- **`lib/modal-state.ts`** — `MODAL_NAMES` gains `'cart'`. Nothing else in the file changes; the
  schema, `useModal` and the push/replace behaviour are already generic over the enum.
- **`features/cart/components/cart-drawer.tsx` (new)** — the panel. `Drawer` with
  `swipeDirection="right"`, which the primitive already supports (`right-0`, `rounded-l-xl`,
  `border-l`, and an x-axis swipe handle). `--drawer-content-width: 100%` inline below `lg` for the
  same attribute-specificity reason `side-menu.tsx:34` documents, `lg:w-144` above it. Header row,
  notice, item list, footer block. Reads `useModal('cart')` and `useCart`, takes no props.
  Branches three ways: `isLoading` → skeleton, resolved and empty → empty state, otherwise rows.

  The visible "Your cart" heading **is** the `DrawerTitle` — `search-drawer.tsx:36` and
  `side-menu.tsx:38` render theirs `sr-only` because those panels have no visible title; this one
  does, so it carries the styling rather than duplicating the text. It is what names the dialog.
- **`features/cart/components/cart-drawer-item.tsx` (new)** — one row: 4:5 thumbnail, title as a
  `<Link to="/products/$productId">`, the options line, unit price, stepper. Not `CartItem`: that
  component is the `/cart` page's row — 20×20 thumbnail, `NativeSelect`, line total, separate trash
  — and this ticket does not touch that page, so sharing would mean one component serving two
  layouts before either has settled.
- **`features/cart/components/quantity-stepper.tsx` (new)** — the `−  N  ＋` control, lifted
  verbatim out of `add-to-cart.tsx:47-70` where it already exists as a private `QuantityButton`
  plus an `<output>`. `add-to-cart.tsx` then consumes it, so the PDP and the panel cannot drift.
  Takes `value`, `onChange`, `min`, `max`, `disabled` and a `label` for the `aria-label`s; at
  `value === min` and a supplied `onRemove`, the decrement becomes the remove.

  The row passes `disabled={updateLineItem.isPending || removeLineItem.isPending}`, and the
  decrement renders `Loader2Icon` in place of the trash while removing — the same treatment
  `cart-item.tsx:41-44` gives the page's button. The PDP passes neither and is unaffected.
- **`features/cart/components/cart-drawer-empty.tsx` (new)** — bag icon, "Your cart is empty", and
  a `Browse products` link that closes the panel by navigating. Not `EmptyCart`: that renders a
  `<main>` with page padding.
- **`features/cart/components/cart-drawer-skeleton.tsx` (new)** — three rows at the item row's
  metrics, `Skeleton` from `@proteus/ui`. Replaces the branch at `cart-dropdown.tsx:83` rather than
  losing it.
- **`features/cart/components/cart-trigger.tsx` (new)** — the one bag button, with the badge.
  `aria-label="Cart"`, `onClick` sets `?modal=cart`. `CartBadge` moves here unchanged, comment
  included — it is the only consumer of `--accent`.
- **`features/cart/api/cart.ts`** — no change. `useCart` is already the non-suspending read the
  always-mounted trigger needs, and the drawer reads the same hook rather than suspending, because
  a suspending read inside a panel that is already animating in has nothing to fall back to.
- **`features/cart/components/add-to-cart.tsx`** — send `variantTitle: selectedVariant.title` and
  `variantOptionValues` (the variant's `optionValues` record, joined `Black · S · Slim Fit` order —
  serialise with `Object.values(...).join(' · ')`, matching what the reference prints). Drop the
  success toast. Call `setOpen(true)` from `useModal('cart')` in `onSuccess`. Consume
  `QuantityStepper`.
- **`components/header/header.tsx`** — `<CartDropdown />` becomes `<CartTrigger />`, and
  `<CartDrawer />` joins `<SideMenu />` and `<SearchDrawer />` at the bottom.
- **`features/cart/components/cart-dropdown.tsx`** — deleted.

Nothing in `packages/ui` changes. `Drawer`, `Skeleton` and `formatPrice` are all already exported
and already used by this app.

## Responsive

Phone-first: the base classes are the full-width panel, and `lg:` narrows it.

**Base (phone).** Full-bleed, `100dvh`, square (`data-[swipe-direction=right]:rounded-none`), swipe
right to dismiss. `px-4` gutters. In order:

1. Header row, `h-14`, `border-line` bottom: "Your cart" as the `DrawerTitle` at `type-heading` on
   the left, close `✕` at the far right, `aria-label="Close cart"`. Sticky.
2. The unreserved notice, `text-xs` `text-ink-muted`, icon inline-start.
3. The item list — `flex-1 overflow-y-auto`, the only scrolling region. Rows separated by
   `border-line`, no card chrome, matching the PLP's no-border treatment.
4. The footer block — `sticky bottom-0`, `bg-surface`, `border-line` top: Total, the muted
   shipping line, then the `h-13` full-width primary button.

**`lg:` and up.** `w-144` off the right edge, `px-6`, page dimmed behind. Same DOM, same order —
the panel is one tree at both widths, unlike the footer's sanctioned two. The desktop dead space
between the totals and the button falls out of `flex-1` on the list; nothing is positioned for it.

Tap targets: the stepper buttons are 36px in `add-to-cart.tsx` today and go to 44 in the panel,
where they are the primary interaction and sit next to each other. The close button gets the
standard `size="icon"` 44.

## Blocked, and tracked elsewhere

**Shipping amounts are in the wrong unit, and any shipping figure on this panel would inherit it.**
`seed-dev.ts:614` writes Standard as `amount: 500` (cents), the shipping-methods route wraps it as
`new BigNumber(shippingOption.amount ?? 0)` and `computeCartTotals` adds it straight to an
`itemsTotal` built from decimal strings like `"25.00"`. A $5 option therefore renders as `$500.00`
in `shipping-method-form.tsx:49` and adds $500 to `cartTotal`. Dropping "Estimated Shipping"
sidesteps it here; it is a live bug on the delivery step and belongs in `.tasks/next-todos` under
the checkout fixes, not in this ticket.

**The cross-sell rail** needs the same thing `03`'s `Best sellers` needs — product groups a
merchandiser fills, or a recommendations read model. Same `TODO(product-groups)`; when it lands it
serves the nav rail, the search panel's empty state and this rail together.

**The free-shipping bar** needs a threshold the backend owns and the delivery step honours. One
ticket: a column on `shipping_option` (or a store-level setting), the rule in
`listShippingOptionsForContext`, and the remaining amount exposed on `cart.totals` so the panel
computes nothing itself.

**Sale pricing** needs `StoreCalculatedPrice` to carry an original amount and `AddLineItem` to
accept `compareAtUnitPrice`. The line-item column is already there and already unused.

## Decisions still open

**Whether `/cart` and the panel become one component.** The drawer ships standalone so the route
stays a working regression net while the panel is new, but two components rendering the same cart
is not the end state. A shared `CartPanel` the route hosts full-width and the drawer hosts at
`w-144` is the likely shape. That pass owns the question below with it.

**Which totals vocabulary wins.** The panel says `Total`; `cart-content.tsx:35` says `Items total`
then `Total`, and those are the same number until shipping is real. One of the two has to move,
and it should be decided once rather than per surface.

**Whether the panel ever shows a shipping figure.** Everything dropped here — the free-shipping
bar, `Estimated Shipping` — comes back together the day the backend owns a threshold and the unit
bug below is fixed. Worth reopening as one ticket, not three.

## Constraint

Four specs bind to this surface. Split by what survives:

**Must keep working.**

- `cart.spec.ts` steps 2–8 — the whole `/cart` journey: `$25.00 each`, the `aside` summary with
  `Items total` and `Total`, `Quantity for {title}`, the `$75.00` line total, `Remove {title}`,
  `Go to checkout`, and the checkout-layout assertions. The page is untouched, so all of it passes
  unmodified, and that is the regression net for the mutations the drawer now drives.
- `checkout.spec.ts` — both journeys navigate to `/cart` by URL. `navigate` is a `page.goto`, so
  `?modal=cart` never survives into them.
- `header.spec.ts:77` — `sideMenu.getByText('Cart')` still resolves; the side menu still links to
  the route.
- `checkout.spec.ts` / `cart.spec.ts`'s `getByLabel('Cart')).toHaveCount(0)` on `/checkout` — the
  checkout layout renders no header, so one trigger instead of two still counts zero.

**Legitimately breaks.**

- `page.locator('[data-slot="toast-title"]')).toHaveText('Added to cart')` at `cart.spec.ts:36`,
  `checkout.spec.ts:35` and `checkout.spec.ts:93`. The toast is gone by decision. Replace with an
  assertion on the panel, which is the stronger test — it proves the item reached the cart, not
  just that a mutation resolved:
  ```ts
  const cartPanel = page.locator('[data-slot="drawer-popup"]')
  await expect(cartPanel).toBeVisible()
  await expect(cartPanel.getByText(productA.title)).toBeVisible()
  ```
  In `checkout.spec.ts` both call sites then need the panel dismissed, or the following
  `navigate({ to: '/cart' })` does it for them — it is a full page load. Prefer the explicit close
  in at least one of them so the close control is covered.
- `header.getByLabel('Cart').last()` at `header.spec.ts:14` and `cart.spec.ts:88`. One trigger now,
  so `.last()` becomes a no-op that hides a regression rather than catching one. Drop it: the
  assertion should fail the day a second `aria-label="Cart"` reappears.
- `page.locator('header [aria-label="Cart"] span').filter({ hasText: '1' })` at `cart.spec.ts:38`.
  The selector survives — the badge is still a `<span>` inside the labelled button — but the
  `.last()` on the following line goes for the same reason.

**Worth adding**, in `cart.spec.ts`, as its own test rather than bolted onto the journey:

- Adding from the PDP opens the panel and the URL carries `?modal=cart`.
- `page.goBack()` closes it, and the ✕ closes it without leaving an entry to go forward into —
  the same pair `header.spec.ts` already asserts for the search panel, and the reason those two
  behaviours are worth a test at all is that they come from `useModal`'s push/replace asymmetry.
- The stepper: `＋` raises the quantity and the total follows; `−` at 1 is labelled
  `Remove {title}` and empties the panel to its empty state.
- The variant line renders. This one only bites once `AddLineItem` carries `variantTitle`, so it is
  also the test that proves the schema change took.
- A cold open — `?modal=cart` navigated to directly with items already in the cart — never shows
  the empty state. This is the one the skeleton branch exists for, and the only way to catch that
  branch regressing is to enter the panel without the add mutation having primed the cache.
