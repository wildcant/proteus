# 05 — Account page

`/account` today is a heading, a two-row `<dl>` of name and email, and two buttons. It is the only
signed-in surface in the storefront and it shows the customer nothing they did not already know.

The reference turns the page into a dashboard: a large Orders panel on the left, a stack of
tappable panels on the right, everything on `#f4f5f6` blocks with uppercase headings. The
interesting part is that we already have the endpoint the biggest panel needs and it is wired to
nothing.

Depends on `01-token-foundation.md`.

## The reference

```
┌───────────────────────────────┐   ┌──────────────────────────────────────────┐
│ ORDERS                        │   │ ADDRESS BOOK                          ›  │
│                               │   └──────────────────────────────────────────┘
│          [illustration]       │   ┌──────────────────────────────────────────┐
│                               │   │ RETURNS                               ›  │
│  You haven't made any orders  │   │ Quick, easy and simple returns…          │
│  yet. When you make an order  │   └──────────────────────────────────────────┘
│  it'll show up here.          │   ┌──────────────────────────────────────────┐
│                               │   │ REFER A FRIEND                        ›  │
│  ▓ Shop Womens ▓ ▓ Shop Mens ▓│   │ Introduce your friends and…              │
└───────────────────────────────┘   └──────────────────────────────────────────┘
```

Below the panels, a full-bleed rule runs the width of the page and `⇥ Sign Out` sits under it at
the left — icon then label, bold, no button chrome. It is the only thing below that rule.

At phone width the two columns become one, the panels lose their side-by-side relationship, and the
sign-out row keeps exactly the same treatment: rule, icon, label, left-aligned.

Two columns, roughly 1:2 at desktop. Panels are square `#f4f5f6` blocks with ~40px padding and
~16px between them — the same filled-utility treatment as the header search field, at a larger
scale. Headings uppercase bold ink; the optional sub-line is muted body; the chevron is vertically
centred on the whole panel, and the whole panel is the hit target, not just the heading. The Orders
panel is one tall block with its empty state centred in it.

## What we can actually back

| Panel | Us | Why |
|---|---|---|
| Orders | **ship, in full** | `GET /store/orders` exists, is customer-scoped and paginated, and returns `displayId`, `status`, `fulfillmentStatus`, `createdAt`, `total` and item thumbnails — everything a row needs |
| Address Book | **ship** | unblocked by `06-address-book.md`, which adds `/store/customers/me/addresses`. The panel links to `/account/addresses` |
| Returns | **blocked** | there is no returns concept anywhere — `apps/backend/src/modules/order/models/` is address, line-item, order, shipping-method, transaction |
| Details | ship, read-only | `GET /store/customers/me` is the only method on that route; there is no update endpoint, so the panel shows name and email and does not pretend to edit them |
| Password | ship | `useRequestPasswordReset` already exists and the emailed-link flow works for a signed-in customer too. This is the same pattern Shopify uses, and it needs no new endpoint |
| Refer a friend / app | dropped | no referral programme, no app |

## Decisions

**`useSuspenseOrders` already exists and nothing calls it.** `features/orders/api/orders.ts` exports
both `ordersListQueryOptions` and `useSuspenseOrders`, written for a page that was never built. The
Orders panel is the page they were for, so this is mostly wiring, not new API work.

**Orders paginate inside the panel; there is no separate orders route.** The reference has one, but
a second page for a list that already has a home is chrome for its own sake. Limit 5 with the
Previous/Next pair `ProductList` already uses, so the two paginated surfaces in the store behave the
same way.

**Order rows link to a new `/account/orders/$orderId`, not to the confirmation page.**
`/order/$orderId/confirmed` opens with "Thank you!" and "Your order was placed successfully" — right
after checkout, wrong six months later. The detail rendering is already extracted as `OrderDetails`,
so the new route is a file and a thin wrapper, and the confirmation page keeps its own copy. Rows
that go nowhere would make the panel a dead end.

**No bespoke illustration for the empty state.** The reference draws one; we have no illustration
system, and a one-off SVG is an orphan the moment the empty state changes. A single muted lucide
`PackageIcon` over the copy carries it, and the type does the rest.

**One "Shop all products" button, not two.** Same reason the header rail ships with one link: there
is no category taxonomy, so "Shop Womens / Shop Mens" has nothing behind it.

**Sign out gets its own band below a rule, not a button in the column.** The reference puts it
under a full-bleed `border-line` rule at the foot of the page: `LogOutIcon` then "Sign out",
left-aligned, bold, no fill and no border. That is better than the outline button it is today for
the reason the reference presumably chose it — every panel above navigates, so the one action that
ends the session should not sit among them competing for the same tap. It renders as a real
`<button>`, styled as a row: `Button variant="link"` with the icon, so the underline-on-hover
affordance still says it is interactive.

## Work

- **`features/account/components/account-panel.tsx` (new)** — the block: `bg-surface-subtle`,
  square, `p-8 lg:p-10`, `type-heading` title, optional muted description, optional chevron.
  Renders as a `Link` when given a `to` and a plain block otherwise, so the read-only Details panel
  and the navigating ones share one component without a nav panel that goes nowhere.
- **`features/account/components/orders-panel.tsx` (new)** — the list, its empty state, and the
  Previous/Next pair. Rows show `displayId`, date, item thumbnails, fulfillment status and total.
- **`features/account/components/password-panel.tsx` (new)** — a panel whose action posts the
  signed-in customer's email through `useRequestPasswordReset` and swaps to a confirmation line in
  place. No form; the email is already known.
- **`features/account/components/account-detail.tsx`** — becomes the two-column grid and the page
  header. `type-display` greeting, tokens throughout (`text-ink-muted`, `border-line`), and the
  inline `<dl>` moves into the Details panel.
- **`routes/_main/_authed/account.tsx`** — prefetch `ordersListQueryOptions` alongside the existing
  customer prefetch, so the panel does not waterfall behind the greeting.
- **`routes/_main/_authed/orders/$orderId.tsx` (new)** — `useSuspenseOrder` into `OrderDetails`,
  under the existing auth guard.
- **the sign-out band** — inside `account-detail.tsx`, after the grid: a `border-line` top rule
  spanning the container, then the icon-and-label button. `useLogout` is already wired.

## Responsive

Written phone-first: the base classes are the single column, and `lg:` introduces the split.

- **Base (phone).** One column, panels stacked in reading order: Orders, then Details, then
  Password. Panels go edge-to-edge within the page gutter (`px-4`) with `p-6` inside and `gap-4`
  between. The greeting drops to the smaller end of the `type-display` clamp, which it already does
  on its own. Order rows go two-line — number and date above, status and total below — rather than
  squeezing four columns into 360px. The Previous/Next pair stays centred and keeps a 44px tap
  target.
- **`lg:` and up.** `lg:grid-cols-3` with Orders spanning two, panel padding to `lg:p-10`, order
  rows back to a single line.
- **The sign-out band does not change.** Rule, icon, label, left-aligned, at every width.

The reference does something we deliberately are not copying: at phone width its heading-only
panels lose their fill and become plain navigation rows to separate pages, so Orders is an inline
panel on desktop and a link on mobile. That is a structural switch, and under selective SSR the
server has no viewport to switch on — it would mean shipping both trees or detecting the
breakpoint on the client and flashing the wrong one. With three panels instead of six, stacking
reads fine and costs nothing.

## Blocked, and tracked elsewhere

Returns needs a returns concept in the order module, which does not exist — the order module is
address, line-item, order, shipping-method and transaction. That is a backend ticket of its own.

Address Book was blocked here for the same shape of reason and is not any more: `06-address-book.md`
shipped `/store/customers/me/addresses`, and the panel links to `/account/addresses`. The right
column is Address Book, Details and Password, with sign out below the rule.

## Constraint

No e2e test touches the account page's content. `auth.spec.ts` and `checkout.spec.ts` only assert
that `/account` is where a successful sign-in lands and that an unauthenticated visit redirects to
`/login`; both are properties of `_authed/route.tsx`, which this ticket does not change.

That also means the page has no coverage at all, and this ticket is the first thing on it worth
asserting. Add a test that a customer with an order sees it in the panel and can open its detail —
`factories.create` has the pieces, and `checkout.spec.ts` already shows how an order gets made.
