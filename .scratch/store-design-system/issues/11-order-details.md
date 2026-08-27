# 11 — Order details

Two routes render one body. `/order/$orderId/confirmed` is where checkout lands;
`/account/orders/$orderId` is where the dashboard's order rows go. Both mount `OrderDetails`, which
is four sections separated by `Separator`s, and it is the last surface in the store still wearing
pre-redesign classes:

- `order-summary.tsx`, `delivery-details.tsx`, `payment-details.tsx`, `need-help.tsx` — every
  heading is `font-bold text-foreground text-xl`, not a type role, and every muted line is
  `text-(--foreground-muted)`, which `CLAUDE.md` forbids outright: the token is registered in
  `@theme`, so the canonical form is `text-ink-muted`.
- `order-items.tsx:12` — `rounded` thumbnails, against `--radius: 0`.
- `order-confirmed-content.tsx:31` — `text-blue-600`, a hue that exists in no token in the store.
- `order-confirmed-skeleton.tsx` — hand-rolled `animate-pulse` divs with `rounded-lg border` instead
  of `Skeleton`.

Depends on `01-token-foundation.md`. Inherits `Panel` from `05-account-page.md` and the summary row
from `08-checkout.md`; both are shipped.

## The reference

**It has nothing to give here.** Checked 2026-08-26, before writing this, and recorded so nobody
spends the afternoon again:

- `/account/orders` redirects to a hosted identity-provider login. Order history is fully gated and
  there is no guest order-detail view anywhere on the site.
- The public "track your order" page is a **third-party tracking product** wearing their logo — an
  order-number-plus-email lookup on a shell that is not their design system.
- Returns is a **second third-party portal**, also not theirs.
- Their support centre carries no screenshot of the page, and its articles tell customers the orders
  section lives in the app rather than on the web.

So two of the reference's three post-purchase surfaces are somebody else's design, and the third is
behind a real order we cannot place. There are no measurements to take and none to add to
`reference.md`.

That is survivable because this page introduces no new visual vocabulary. Every piece of it has
already been measured on a surface that shipped:

| Piece | Already specced in |
|---|---|
| Square filled block, uppercase `type-heading`, `p-6 lg:p-10` | `05-account-page.md` (`components/panel.tsx`) |
| Line-item row: 4:5 cover thumbnail, quantity badge, line total | `08-checkout.md` (`checkout-summary.tsx`) |
| Totals `<dl>`: muted `<dt>`, `tabular-nums` `<dd>`, rule above the total | `08-checkout.md` |
| Address rendering including `address2` | `08-checkout.md` |
| Fulfilment status wording | `05-account-page.md` (`orders-panel.tsx:13`) |
| Page shell: eyebrow, display heading, `max-w-350` grid | `05-account-page.md` (`account-detail.tsx`) |
| Colour, type roles, radius | `reference.md` |

**Do not re-scrape the reference for this ticket.** The decisions below are the whole of what we are
choosing on our own.

## What we can actually back

| Slot | Us | Why |
|---|---|---|
| Summary — items and totals | **ship, in full** | `GET /store/orders/:id` already returns `lineItems`, `totals` and `currencyCode` |
| Status | **ship** — new | `fulfillmentStatus` is on the response and the detail page shows it nowhere today. It is the most useful line on an order page and it is the one currently missing |
| Delivery | **ship, wider than today** | `StoreOrderAddress` carries `address2`, `province` and `phone`; `delivery-details.tsx` renders none of them |
| Payment | ship, thin | `paymentStatus` and totals only. Nothing in the order module stores a card brand or last four — `transaction` records amounts, not instruments — so the panel says what was paid and when, and does not imply a method |
| Need help | **dropped** | there is no contact route and no returns concept. `04-footer.md` shipped a footer with no help column for exactly this reason; a panel of two bold non-links is the same placeholder in a bigger frame |
| Track parcel | dropped | grepped: no `trackingNumber` or `trackingUrl` column exists in `modules/fulfillment/models/` or `modules/order/models/`. There is nothing to link to |
| Return / Reorder / Invoice | dropped | no returns concept, no reorder endpoint, no invoice generation |

## Decisions

**Each route keeps its own header; the body stays one component.** `05-account-page.md` already
settled this and nothing here revisits it. `/order/$orderId/confirmed` opens with "Thank you!";
`/account/orders/$orderId` opens with the eyebrow-and-number header it has today. Below that line
both mount the same `OrderDetails`.

**"Thank you!" and the success sentence do not change.** Four assertions in `checkout.spec.ts`
(lines 69, 136, 224, 281) match `getByRole('heading', { name: /thank you/i })` and two match the
exact string `Your order was placed successfully.` This is the contract `02-auth-pages.md` set with
the auth spec: those assertions passing *unmodified* is the proof the redesign moved classes and not
behaviour. Putting the heading in `type-display` uppercases it, which is safe on both counts — the
heading matcher carries `/i`, and `getByText` reads DOM text, which `text-transform` does not touch.

**Both routes print the order number the same way, and that moves a test helper.** Today the
confirmed page says `Order number: 1042` in `text-blue-600` while the account route says `#1042` in
`type-title` under an "Order" eyebrow. The blue has to go regardless — it matches no token in the
store — and one order number rendered two ways across two pages is the exact inconsistency this
redesign exists to remove. Both become the eyebrow-and-`#1042` block; on the confirmed route the
`h1` is "Thank you!", so the number is an `h2` beneath it.

That is not free. `placeOrder` in `tests/setup/utils.ts:66` reads the display id out of
`page.getByText(/order number:/i)`, and every checkout spec plus `orders.spec.ts` goes through it.
The replacement is `getByRole('heading', { name: /^#\d+$/ })`, which then works on both pages — one
line in the helper, no spec edited. Rejected: keeping the `Order number:` line alive purely to
protect a helper. That is a test dictating the design, and the helper's read is one line.

**The body becomes `Panel`s, and the page takes the dashboard's width.** Today it is `max-w-170`
with `font-bold text-xl` headings and `Separator`s between them, which reads as a document. The
account dashboard next door is square grey blocks with uppercase headings, and this page is what a
shopper reaches by tapping a row *on that dashboard*. Grey already means "read-only record" in this
system — it is what `08-checkout.md` made the summary pane — and an order detail is nothing but a
read-only record.

So: `max-w-350 px-4 sm:px-6 lg:px-8` and `lg:grid-cols-3` with Summary spanning two, identical to
`account-detail.tsx`. The panels line up with the ones on the page the shopper just left, so opening
an order does not reflow the column under them.

Rejected: keeping the 680px reading column and only repainting the sections. It is a defensible
receipt layout on its own, but it makes the detail page the one signed-in surface at a different
width, and going from a three-column dashboard to a narrow column reads as a different site.

**Line items gain the variant options line, and it costs one key.**
`apps/backend/src/modules/order/models/line-item.ts:31` already has the `variantOptionValues`
column, `complete-cart.ts:226` already copies it off the cart at order creation, the admin schema
already exposes it, and `enrichLineItems` spreads the row untouched. The only thing dropping it is
`StoreOrderLineItem` in `packages/http-schemas/src/store/order/entities.ts`, which does not declare
the key, so Zod strips it on the way out.

Add the key, run `npm run openapi:generate`, and the order row can say `M · Olive` — the same string
the cart drawer and the checkout summary showed the shopper twice already. Fall back to
`variantTitle` when it is null, which is what orders placed before that column will have, and drop
the `Variant:` prefix — neither of the other two rows prefixes it.

**Line items also gain `id`, and that one is a bug fix.** `order-items.tsx:10` keys rows by
`item.title`. An order holding two variants of one product — the ordinary case the options line is
being added *for* — renders two rows under the same React key. The table has carried
`id text().primaryKey()` (`ordli_…`) since it was created and `OrderLineItemDTO` exposes it; only
the store schema drops it. Same file, same regenerate, so it lands with `variantOptionValues` rather
than as a separate ticket.

`StoreOrderItemSummary` has the identical defect — `orders-panel.tsx`'s thumbnail strip keys by
`item.title` too — and gets the identical fix.

**The row is the checkout summary's row, plus a unit price when it earns one.** 4:5 `object-cover`
thumbnail at `w-16`, quantity in the `-top-2 -right-2` badge, line total right-aligned in
`tabular-nums` — copied from `checkout-summary.tsx`, because the shopper saw that exact row at
checkout and this is the record of it.

The one addition: a muted `text-xs` unit-price line when `quantity > 1`. The checkout summary can
leave it out because the shopper is still holding the cart that set it; a receipt read six months
later cannot, and `{quantity} × {unitPrice}` is the arithmetic behind the only number on the row.
At `quantity === 1` it is noise and it is omitted.

**Status is a line, not a badge.** `orders-panel.tsx:13` already maps the wire values to phrases
(`unfulfilled → Preparing`, `fulfilled → Ready to ship`, `shipped → Shipped`, `delivered →
Delivered`). The list renders that in muted `text-xs`; the detail renders the same phrase in the
header block, beside the placed date. Introducing a pill here would give the store a status
treatment that exists on one page and disagrees with the list it was opened from.

The map moves out of `features/account/components/orders-panel.tsx` and into `features/orders/`,
because two features now read it and it describes an order, not a panel.

**The address renders in full, and the country renders as a name.** `delivery-details.tsx` prints
`countryCode.toUpperCase()` — `US` — and skips `address2`, `province` and `phone` entirely.
`08-checkout.md` fixed the same omission in the checkout address block; the order that address
produced should not print less than the form that captured it.

`components/form/country-options.tsx` already holds the one list checkout and the address book agree
on. Export a `countryName(code: string): string` lookup from it rather than adding a second list —
the comment on that constant says why it lives in one place, and a second copy is the failure it
warns about. An unknown code falls back to the uppercased code, so an order placed before a country
left the list still renders.

**`need-help.tsx` is deleted, not restyled.** Two `font-semibold` lines that look like links and are
not is worse than nothing: it invites a tap that does nothing. `04-footer.md` set the rule — no link
without something behind it — and shipped a footer with no help column under it. When there is a
contact route or a returns concept, this comes back as a `Panel` with a real `chevron`.

**Payment stops implying a method.** `paymentStatus === 'captured' ? 'Payment received' : 'Awaiting
payment'` under a heading that says "Payment method" is a lie of placement — that is a status, not a
method, and we have no method to show. The panel becomes two labelled lines: the status phrase, and
the amount with the date it was taken.

**`email` is not nullable, and the checkout workflow has always said so.** `complete-cart.ts:176` is
a `validate-cart-email` step that rejects with `INVALID_DATA` **before any side effect** if the cart
has no email — its own comment says "every order needs an email for receipts and communication".
An order that reached the database through checkout therefore always has one, and checkout is the
only thing that writes an order.

So three declarations are describing a state the system forbids: `email: text()` on
`modules/order/models/order.ts:22`, `email: string | null` on `OrderDTO`
(`core/types/order/common.ts:12`), and `email: z.string().nullable()` on `StoreOrder`. All three
become non-null, and three guards written against the impossible state go with them:
`if (!order.email) return` at `complete-cart.ts:410`, `!!order.email &&` in `delivery-details.tsx`,
and the sentence-guard this ticket's own States section proposed a draft ago.

The **cart's** email stays nullable, and the asymmetry is the point: a cart legitimately has no
email until the shopper types one, and an order is the record of a cart that had one. Making both
non-null would put a `notNull` on the column the checkout form fills in progressively.

Migration: the order module's migration is regenerated in place under its existing tag, per the
repo's one-migration-per-module convention. `.notNull()` on a populated column needs every existing
row to have a value — on a dev database that is `db:migrate:dev` after a reset, and the order DTO
generators at `tests/factories/order-dto.ts:19,62,113` already set an email on every fixture, so no
test data needs backfilling.

**A rolled-back checkout tells an admin, and that is exactly what `notifyOnFailureStep` is for.**
`workflows/notification/steps/notify-on-failure.ts` is compensation-only: the forward action is a
no-op returning its payload, and the *compensation* writes the notifications. That fires on rollback
and only on rollback — which is the one event in checkout nobody currently hears about. A workflow
that authorizes payment and then fails a later step unwinds the order, the link, the reservations
and the cart lock (`complete-cart.test.ts:98` asserts each), and the merchant never learns a
customer tried to buy something and the system ate it.

The step is registered **after `validate-cart-email` and before `create-order`**. Registration order
is what decides compensation order: `simple-adapter.ts:36` unwinds `compensations.reverse()`, so
registering first means notifying *last*, once the state is actually restored — the notification
describes a completed rollback rather than one in progress. Compensation errors there are swallowed
by design (`simple-adapter.ts:40`), so a notification failure cannot break the unwind it is
reporting on.

Its input is built by a step in front of it that resolves the admin recipients, because the
container is only reachable from inside a step (`StepContext` is the only thing carrying it).

**A failed confirmation email also tells an admin, and `notifyOnFailureStep` cannot be the one to
do it.** Same goal, different event, and the distinction matters: `send-order-confirmation` is
deliberately built never to throw (`complete-cart.ts:439`) because the payment is authorized by then
and throwing would compensate the workflow and refund a valid order. No throw means no rollback,
which means no compensation — wiring `notifyOnFailureStep` to this case would read as coverage and
deliver silence.

So this one writes from inside the existing `catch`, beside the two `logger.error` lines that are
the only trace of it today. Both notifications carry `resourceType: 'order'`, `resourceId`, and an
`idempotencyKey` so a retried workflow cannot duplicate them — the guard the success path already
uses one line above.

**Feed notifications go to one configured admin address, and RBAC will replace it.**
`notification-bell.tsx:18` queries `{ channel: 'feed', to: [user.id, user.email] }` and
`notification-list.tsx` takes the same pair, so a feed row lands in a bell when `to` is an admin's
id or their email. That is the contract, and `scripts/seed-dev.ts:860-978` is the proof it works
end to end — eight feed rows addressed to `DEV_ADMIN_ID` and `DEV_ADMIN_EMAIL`, behind a
`--notifications` flag, which is how the admin feed was verified.

Both writers here address **one** admin email, read from a new `ADMIN_NOTIFICATION_EMAIL` in
`env.ts`, defaulting to the seed's `admin@example.com` so a fresh dev environment works without
editing `.env`. It sits beside `RESEND_FROM` and `ADMIN_URL`, which are the same shape of thing: a
configured address the system sends to.

This is deliberately a placeholder, and it carries `TODO(rbac)` so it reads as one. The right answer
is "notify the users who hold the role that cares about failed checkouts", and there are no roles
yet. Rejected for now: fanning out over `IUserModuleService.listUsers()`. It needs no configuration
and it is closer to the eventual shape, but every seeded environment has ten `user{n}@example.com`
rows in it — so today it means ten notifications per failure to nine people who are not
administrators. A single configured address is the honest placeholder until a role can be asked for.

The default is the part to watch: a production deploy that never sets the variable sends its
failure alerts to `admin@example.com`, which is nobody. That is the cost of not making it required,
and it is taken knowingly — a required variable breaks every existing `.env` and the test
environment for a feature that is a placeholder anyway.

**No runtime code path writes a feed notification today.** Every `createNotification` caller in
`src/` is `channel: 'email'` — auth verification, password reset, user invite, order confirmation.
The seed writes feed rows and the admin renders them correctly; what has never existed is the
backend deciding on its own that something is worth telling an operator about. These two are the
first.

## Layout

Phone — one column, panels stacked in reading order:

```
 ─────────────────────────────
  ‹ Account                        ← account route only
  Order                            ← muted eyebrow, 14px
  #1042                            ← type-title
  Placed 26 Aug 2026 · Preparing   ← muted; status is the new half
 ─────────────────────────────
 ▒ SUMMARY                      ▒
 ▒  ┌───┐③ Pumper Pants  $60.00 ▒
 ▒  │img│  M · Olive             ▒   ← the options line, newly available
 ▒  └───┘  $20.00 each           ▒   ← only when quantity > 1
 ▒  ───────────────────────────  ▒
 ▒  Subtotal            $60.00   ▒
 ▒  Shipping             $4.99   ▒
 ▒  Total               $64.99   ▒
 ─────────────────────────────
 ▒ DELIVERY                     ▒
 ▒  Jane Doe                     ▒
 ▒  221B Baker Street            ▒
 ▒  Flat 2                       ▒   ← address2, never rendered until now
 ▒  London, Greater London       ▒
 ▒  NW1 6XE                      ▒
 ▒  United Kingdom               ▒   ← name, not GB
 ▒  +44 7700 900000              ▒
 ▒  ───────────────────────────  ▒
 ▒  Standard Delivery    $4.99   ▒
 ▒  jane@example.com             ▒
 ─────────────────────────────
 ▒ PAYMENT                      ▒
 ▒  Payment received             ▒
 ▒  $64.99 on 26 Aug 2026, 14:02 ▒
 ─────────────────────────────
```

`lg:` and up — the dashboard's grid, Summary spanning two:

```
┌───────────────────────────────────────┐  ┌──────────────────────┐
│ SUMMARY                               │  │ DELIVERY             │
│  ┌───┐③ Pumper Pants          $60.00  │  │  Jane Doe            │
│  │img│  M · Olive                     │  │  221B Baker Street   │
│  └───┘  $20.00 each                   │  │  …                   │
│  ┌───┐  Legacy Tee            $28.00  │  └──────────────────────┘
│  │img│  L · Black                     │  ┌──────────────────────┐
│  └───┘                                │  │ PAYMENT              │
│  ───────────────────────────────────  │  │  Payment received    │
│  Subtotal                     $88.00  │  │  $92.99 on 26 Aug…   │
│  Shipping                      $4.99  │  └──────────────────────┘
│  Total                        $92.99  │
└───────────────────────────────────────┘
```

On the confirmed route the header block above the grid is "Thank you!" in `type-display`, the
success sentence, the emailed-to line, then the same eyebrow-and-`#1042` block as an `h2`. No back
link: there is nothing behind it to go back to.

## Work

**Backend — two keys and a regenerate**

- **`packages/http-schemas/src/store/order/entities.ts`** — add `id: z.string()` and
  `variantOptionValues: z.string().nullable()` to `StoreOrderLineItem`; add `id: z.string()` to
  `StoreOrderItemSummary`. The routes already return both values; the schema is the only thing
  dropping them.
- **`packages/http-schemas/src/store/order/entities.ts`** — `StoreOrder.email` goes from
  `z.string().nullable()` to `z.string()`.
- **`apps/backend/src/modules/order/models/order.ts:22`** — `email: text().notNull()`.
- **`apps/backend/src/core/types/order/common.ts:12`** — `email: string`.
- **`apps/backend/src/modules/order/migrations/`** — regenerated in place under the existing tag,
  per the one-migration-per-module convention.
- **`apps/backend/src/workflows/cart/complete-cart.ts:410`** — `if (!order.email) return` deleted;
  it guards a state `validate-cart-email` already forbids.
- **`apps/backend/src/env.ts`** — `ADMIN_NOTIFICATION_EMAIL: z.email().default('admin@example.com')`,
  in the same block as `ADMIN_URL` and `STORE_URL`, with the `TODO(rbac)` on it.
- **`apps/backend/src/workflows/cart/complete-cart.ts`** — `notifyOnFailureStep(ctx, {
  notifications })` after `validate-cart-email` and before `create-order`, so it compensates last.
  One `channel: 'feed'` row to `env.ADMIN_NOTIFICATION_EMAIL`, `data.title` / `data.description`
  naming the cart and what failed, `resourceType: 'cart'`, `resourceId: input.cartId`,
  `idempotencyKey: \`checkout-failed:${input.cartId}\``. No recipient-resolving step is needed —
  the address is configuration, not a query.
- **`apps/backend/src/workflows/cart/complete-cart.ts:439`** — the `catch` keeps its two
  `logger.error` lines and gains the same row with `resourceType: 'order'`, `resourceId: order.id`
  and `idempotencyKey: \`order-confirmation-failed:${order.id}\``. It stays inside the `catch` —
  the step must not start throwing.
- **`npm run openapi:generate`** — regenerates the store and admin Orval clients.
- **`apps/backend/src/api/store/orders/__tests__/order.api.test.ts`** — assert the detail response
  carries `id` and `variantOptionValues` per line item, so neither can be dropped from the schema
  again silently.
- **`apps/backend/src/workflows/cart/__tests__/complete-cart.test.ts`** — two tests, both using the
  fault-injection pattern already in the file at `:98`: `vi.spyOn(container.resolve(...), method)`
  with `mockRejectedValueOnce(new Error(...))`, a plain `Error` standing in for a code bug rather
  than a `WorkflowTerminalError`.
  1. **An unexpected failure mid-workflow leaves a feed notification in the database.** Inject on
     `authorizePaymentSession`, the same seam `:98` uses, assert the workflow rejects, then read the
     notifications back and assert a `channel: 'feed'` row addressed to
     `env.ADMIN_NOTIFICATION_EMAIL`, carrying the `data.title` / `data.description` that
     `notification-item.tsx:7-8` renders. Asserting the row is what makes it a feed test rather than
     a rollback test — `:98` already covers the unwind.
  2. **A failed confirmation send writes a feed notification and still returns the order.** Inject
     on the notification service's create, assert the workflow *resolves* with the order, and assert
     the feed row. This one is the pair to the first: same outcome, opposite path through the
     workflow, and the reason both mechanisms exist.

**Store**

- **`features/orders/fulfillment-labels.ts` (new)** — the `Record<StoreOrderFulfillmentStatus,
  string>` map, moved out of `orders-panel.tsx` with its comment.
- **`features/account/components/orders-panel.tsx`** — import the map instead of declaring it, and
  key the thumbnail strip by `item.id`. No other change.
- **`components/form/country-options.tsx`** — export `countryName(code: string): string` off the
  existing `COUNTRIES` constant, uppercased code as the fallback.
- **`features/orders/components/order-items.tsx`** — the checkout summary's row: `key={item.id}`,
  4:5 `w-16` `object-cover` thumbnail, quantity badge, `variantOptionValues ?? variantTitle` as the
  options line, unit price when `quantity > 1`, line total in `tabular-nums`. Not the checkout
  summary's scroll region — see States.
- **`features/orders/components/order-summary.tsx`** — becomes a `Panel title="Summary"` wrapping
  `OrderItems` and the totals `<dl>`, with the totals shaped like the checkout summary's: `gap-3`,
  muted `<dt>`, `tabular-nums` `<dd>`, `border-line border-t pt-6` above the total, total in
  `font-bold text-base`. The "(excl. shipping and taxes)" parenthetical goes — the shipping line is
  directly beneath it.
- **`features/orders/components/delivery-details.tsx`** — becomes a `Panel title="Delivery"`, one
  column at every width. Address in full (`address2`, `province`, `countryName`, `phone`), then a
  hairline, then the shipping method and the contact email. **Keeps its null-address branch**; see
  States. The three-column `sm:grid-cols-3` goes: in a 1/3-width panel it was never going to be
  three columns.
- **`features/orders/components/payment-details.tsx`** — becomes a `Panel title="Payment"`, two
  labelled lines, no "Payment method" heading over a status.
- **`features/orders/components/order-details.tsx`** — the `lg:grid-cols-3` grid with `gap-4`, no
  `Separator`s. Summary at `lg:col-span-2`; Delivery and Payment stacked in the third column.
- **`features/orders/components/need-help.tsx`** — deleted. It has no branches and no props; nothing
  moves with it.
- **`features/orders/components/order-content.tsx`** — header keeps its tokens, gains the status
  half of the placed line; `main` goes `max-w-350 … lg:px-8`.
- **`features/orders/components/order-confirmed-content.tsx`** — `type-display` on "Thank you!",
  tokens throughout, `text-blue-600` gone, the `#1042` block as an `h2`, same `max-w-350` shell. The
  dead not-found branch is deleted and the emailed-to sentence is guarded; both in States.
- **`features/orders/components/order-content-skeleton.tsx`**,
  **`order-confirmed-skeleton.tsx`** — match the new shells; the confirmed one swaps its
  `animate-pulse` divs for `Skeleton`, which is what the other one already uses.
- **`features/orders/components/order-error.tsx` (new)** — the shared error body: `type-title`
  heading, the muted line naming the order id from the route params, and a slot for the way out.
  Both routes render it with their own action.
- **`routes/_main/_authed/account/orders/$orderId.tsx`**,
  **`routes/_main/order/$orderId/confirmed.tsx`** — each gains `errorComponent`, with the
  `TODO(monitoring)` on both.
- **`tests/setup/utils.ts`** — `placeOrder` reads the display id from the heading. One line; see
  Constraint.

## Responsive

Written phone-first: the base classes are the single column, and `lg:` introduces the split.

- **Base (phone).** One column, panels edge-to-edge within `px-4`, `p-6` inside, `gap-4` between.
  DOM order is Summary, Delivery, Payment — which is also the stacking order, so nothing is
  reordered by CSS. The header block sits above them at `type-title` (account route) or
  `type-display` (confirmed), both of which already shrink on their own clamp. Line-item rows keep
  the badge quantity rather than a separate column, which is what lets the row survive 360px.
- **`sm:`** — gutter to `px-6`. Nothing else moves.
- **`lg:` and up.** `lg:grid-cols-3`, Summary at `lg:col-span-2`, panel padding to `lg:p-10`, gutter
  to `lg:px-8`. Grid rows stretch, so the Summary panel matches the height of the stack beside it
  without a hand-picked `min-height` — the mechanism `account-detail.tsx` already relies on.
- **No structural switch at any breakpoint.** Every panel is one tree; only the grid changes.

## States the reference cannot show you

- **Cold entry.** Neither route is `ssr: true`; both `prefetchQuery` in the loader and read through
  `useSuspenseOrder` inside a `<Suspense>`, which is the SPA pattern ADR 0013 sets for signed-in
  surfaces. So the skeleton *is* the first paint on a direct hit, and both skeletons must describe
  the new panel grid. A skeleton that resolves into a different shape is worse than no skeleton.
- **Order not found.** `useSuspenseOrder` **rejects** on a 404 — it does not resolve with
  `order: undefined`. `StoreOrderResponse.order` is non-optional, so the `if (!order)` branch at
  `order-confirmed-content.tsx:17` is unreachable and always has been. The branch is deleted, and
  **both routes gain a real `errorComponent`** in its place — the pattern is `_auth/verify.tsx:35`,
  the only one in the store today. A dead branch that looks like error handling is why nobody
  noticed there was none; deleting it without replacing it would leave a rejected read falling
  through to the router default, which is a stack trace where a shopper is standing.

  The two differ in the way out, because the routes differ: the account one offers "Back to account",
  the confirmed one offers "Continue shopping" — a guest whose confirmation failed to load has no
  account to go back to. Copy says the order could not be loaded, not that it does not exist: a 404
  and a 500 arrive here identically and guessing between them in the copy would be a lie half the
  time. The order number is in the URL, so the message names it — it is the one thing a shopper can
  quote to support.

  Each carries a `TODO(monitoring)`: an error boundary that renders and reports nothing is a silent
  failure with better manners. There is no client error-reporting transport in the store yet, so the
  TODO is the honest placeholder rather than a `console.error` pretending to be one.
- **No shipping address.** `shippingAddress` is `StoreOrderAddress | null` on the response and
  `delivery-details.tsx:14` renders "No address provided" for it today. **That branch survives the
  rewrite** as the same muted line inside the Delivery panel. It is the branch most likely to be
  dropped, because seeded and hand-placed orders always have one.
- **No shipping method.** `shippingMethods[0]` undefined → the method line is omitted entirely, as
  it is today. A digital-only order is exactly this shape, and the hairline above it goes with it
  rather than leaving a rule over nothing.
- **No email — impossible, and now typed that way.** `complete-cart.ts:176` rejects a cart without
  one before any side effect, so no order can exist without an email. The column, the DTO and
  `StoreOrder` are all being made non-null to match, which deletes the `!!order.email &&` guard in
  `delivery-details.tsx` and the unguarded interpolation at `order-confirmed-content.tsx:28`
  together. See the decision; the state that replaces it is the one below.
- **The confirmation email fails to send.** The order exists, the payment is captured, and the
  shopper is looking at this page — which is why the page itself changes nothing: it still says the
  confirmation went to their address, because at render time nothing here knows it did not. What
  changes is that an admin is told, from inside the `catch` at `complete-cart.ts:439`. This is the
  only failure on the whole surface, and it is not one the surface can show.
- **Checkout fails and unwinds.** The shopper never reaches this page at all — they are still on
  `/checkout` looking at an error, and the order that briefly existed has been compensated away. It
  is in this ticket because it is the same question as the one above asked one step earlier: when
  the system loses a customer, someone should know. `notifyOnFailureStep` covers it.
- **No thumbnail.** `PackageIcon` on the 4:5 tile, `text-ink-subtle`, as `order-items.tsx` and
  `orders-panel.tsx` both already do. `PackageIcon` and not the checkout summary's `ShoppingBagIcon`
  — a bag is the thing you are still carrying, a package is the thing that shipped.
- **Many line items.** The Summary panel grows with them. It deliberately does **not** inherit the
  checkout summary's `overflow-y-auto` region: that exists because the checkout summary is pinned in
  a sticky `max-h-[calc(100dvh-5rem)]` column. This page is a document, and a scroll box inside a
  scrolling page is two gestures doing one job.
- **Long title, long option string.** Both wrap. No `line-clamp` — truncating what someone bought on
  the record of them buying it is not a trade worth making, the same call `09-product-detail.md`
  made for the product title.
- **In flight, and failure.** There are none. This is the only surface in the store with no mutation
  on it: nothing to disable, nothing to toast, no optimistic update. Stated so the next reader does
  not go hunting for the pattern.
- **Deep entry.** `/account/orders/$orderId` sits inside `_authed`, so a signed-out deep link
  redirects to `/login` — already handled by `_authed/route.tsx` and unchanged here.
  `/order/$orderId/confirmed` sits outside it by design, because a guest who just checked out has no
  session; it is therefore linkable cold by anyone holding the UUID. That is the `TODO` in Blocked.
- **A product deleted after the order.** Nothing breaks. Line items are denormalised copies — title,
  thumbnail, `unitPrice` and now `variantOptionValues` all live on `order_line_item` — so the page
  needs no product join and a soft-deleted product leaves the order intact. This is why the ticket
  can drop the `Variant:` prefix without worrying about where the string comes from.

## Blocked, and tracked elsewhere

**Returns.** No returns concept exists — the order module is address, line-item, order,
shipping-method and transaction. `05-account-page.md` blocked its Returns panel on the same thing.
Until that module lands, `need-help.tsx` stays deleted rather than restyled.

**Tracking.** Grepped: no `trackingNumber` or `trackingUrl` column in
`modules/fulfillment/models/` or `modules/order/models/`. A "Track parcel" affordance would have
nothing to point at, so the Delivery panel names the method and stops there.

**A store-wide catch boundary.** This ticket gives the two order routes an `errorComponent` each,
which is the second and third in the app after `_auth/verify.tsx:35`. Every other route in the store
still lands on the router default when a suspense read rejects. Deciding where the shared boundary
belongs — per-route, on `_main`, or on `__root__` — is a real ticket with a real decision in it, and
three hand-placed boundaries is the evidence for it rather than a substitute.

**Client error monitoring.** The `TODO(monitoring)` in both error components has no transport behind
it: the store has no error-reporting client. An error boundary that renders politely and reports
nothing is still a silent failure, and the TODO is there so the next person adding Sentry or its
equivalent has the two call sites already marked.

**Every other workflow that can roll back.** `complete-cart` gets `notifyOnFailureStep` here, and it
is the first production caller the step has ever had. Nothing else that compensates — the cart
workflows, the user invite flows — tells anyone when it unwinds. Whether they should is a decision
per workflow, not a sweep, and it is not this ticket's to make.

**Order details are readable by UUID without a session.**
`apps/backend/src/api/store/orders/[id]/route.ts:9` carries the `TODO`: the confirmed route has to
work for a guest, so the endpoint only checks ownership when there *is* a session. The fix is a
signed order-access token and it is a backend ticket of its own. This ticket does not widen the
exposure — it adds `id` and `variantOptionValues` to a payload that already carries the shipping
address and the email — but it does not close it either.

**Reorder and invoice.** No endpoint behind either. Recorded so their absence is not mistaken for an
oversight.

## Constraint

`tests/e2e/orders.spec.ts` is the spec for this surface; `checkout.spec.ts` reaches it through
`placeOrder`; `account.spec.ts` touches the panel that links to it.

**Must keep working, unmodified:**

- `checkout.spec.ts` lines 69, 136, 224, 281 — `getByRole('heading', { name: /thank you/i })`. The
  heading stays an `h1` and stays first. `type-display` uppercases it presentationally; the `/i`
  flag is what makes that safe.
- `checkout.spec.ts` lines 70, 137 — `getByText('Your order was placed successfully.')`, exact
  string. `getByText` reads DOM text, which `text-transform` does not touch, so this holds whatever
  role the line ends up in. It stays body copy.
- `orders.spec.ts:47` — `toHaveURL(/\/account\/orders\/ord_/)`. No routing changes.
- `orders.spec.ts:48` — `getByRole('heading', { name: '#${displayId}' })`. Already a heading, already
  `#1042`; `type-title` uppercase does nothing to a numeral. This is the assertion the "one order
  number treatment" decision is built to satisfy on *both* routes.
- `orders.spec.ts:49` — `getByText(product.title).first()`. The title stays rendered in the row.
- `account.spec.ts:13` — `getByText(/you haven't made any orders yet/i)`. The empty state is not
  touched by this ticket.

**Legitimately breaks, with the replacement:**

- `tests/setup/utils.ts:66-67` — `page.getByText(/order number:/i)` then `.replace(/\D/g, '')`. The
  `Order number: 1042` line is gone. Replacement: `getByRole('heading', { name: /^#\d+$/ })`,
  reading the digits out of its text the same way. This is a helper, not an assertion, so it is the
  one file that changes and no spec is edited — which is the point: if a spec needs editing, the
  redesign changed behaviour and something is wrong.

**To add, inside the existing `orders.spec.ts` test rather than a new one** — it places a real order
through the UI at a 60s timeout and there is no order factory to make a second one cheaply:

- the options line renders on the detail row, which is the one thing on this page that needed a
  backend change to exist at all;
- the shipping address `fillShippingAddress` submitted comes back on the page — `123 Main St`,
  `Austin`, and `United States` rather than `US`, which is the `countryName` decision made
  falsifiable.

Both read values `fillShippingAddress` already hardcodes at `tests/setup/utils.ts:19-33`; export
them as a constant from that file rather than retyping the strings in the spec.

**Backend suites this touches:**

- `apps/backend/src/workflows/cart/__tests__/` — `complete-cart` already covers the
  `validate-cart-email` rejection. That test is what makes `email: text().notNull()` safe to assert,
  and it must keep passing unmodified: if the column becomes non-null and that test still passes,
  the guarantee is real at both layers.
- The order DTO generators at `tests/factories/order-dto.ts:19,62,113` already set an email on every
  fixture, so no factory changes with the column.
- `complete-cart.test.ts:145` — `refuses a cart with no email`, driven through
  `service.create.checkoutReadyCart(container, { cart: { email: null } })`. It must keep passing
  unmodified: it is the workflow-layer half of the guarantee the column is about to encode, and a
  `notNull` column that passes while this test still passes is the proof both layers agree.
- `complete-cart.test.ts:98,115` — the two rollback tests. `notifyOnFailureStep` is registered in
  front of the steps they fail, so both now also unwind through it. They assert on restored state
  and not on call counts, so neither should notice — if either breaks, the step was registered in
  the wrong place.

