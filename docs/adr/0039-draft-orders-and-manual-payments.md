# 39. Draft Orders Come from the Store, and an Order Is Paid by Partial Captures of One Payment Collection

**Status:** Accepted. Amends [ADR-0038](0038-extensions-are-a-forks-backend-code-beside-proteus.md):
an extension may bring a fulfillment provider, and draft orders ship with no hook.

## Context

Some stores built from Proteus don't take payment at checkout. They sell through a chat: the
shopper builds a Cart and sends it to the shop in a message, the shop confirms the items are
available and asks for a deposit by bank transfer, then ships and collects the rest cash on
delivery. A fork that sells this way had to build all of it inside Proteus files on its own
branch, so every sync with Proteus conflicted.

Proteus could not express any step of that sale:

- An Order existed only as a completed Cart. Completing one needs an email, a payment session for
  the Cart's whole total and an authorized payment. Nothing could save a Cart as an order the shop
  had not confirmed yet.
- The manual payment provider was test-only. The admin could mark a payment collection paid only
  for its full amount, capture always took the full amount, and neither wrote the Order's
  transactions, so a paid Order still read "awaiting". A deposit and then the rest had no shape.
- Shipping options had flat prices. The fulfillment provider port could calculate a price, but
  nothing called it, geo zones by province and city were not matched, and a calculated option was
  stored at 0.
- A guest could reach an Order only from the confirmation page, which showed no paid or outstanding
  amount, and had no way back to it.
- A fork that needed its own courier's rate table had to edit Proteus files, because
  extension-owned providers were deferred (ADR-0038).

**Prior art.** Medusa has all three of the pieces such a sale needs: draft orders (an Order with the
`draft` status, created and edited in the admin and converted to a pending Order), the system
payment provider as a real manual provider, and calculated shipping options priced by their
fulfillment provider. An Order has one payment collection; `capturePaymentWorkflow` captures an
amount of it and adds an Order transaction for each capture; the Order's payment status is
aggregated from its collections and payments. Its dashboard's «Capture payment» takes only the full
amount (checked 15 Nov 2026). Medusa has no store route that creates a draft, and no guest lookup.

## Decision

Proteus ports Medusa's draft orders, manual payments and calculated shipping, and adds the two store
features a store that sells through a chat needs. Both store features are opt-in, so a card-only
store exposes nothing new.

### A Draft Order is an Order with the `draft` status

The Order's status gains `draft`. A Draft Order is an Order the shop has not confirmed: it reserves
no stock and holds no payment collection. There are no new tables. A draft's items are Order line
items, its address an Order address, its shipping an Order shipping method. The Order carries the
region and sales channel ids copied from the Cart, as Medusa's does, so the admin can still price a
draft's items after the Cart has closed. Email is optional on every Order, and the confirmation
email is skipped when there is none, so a shopper can order without giving one.

Drafts are left out of the admin orders list, a Customer's order history, order counts and the
order placed event. The admin lists them on their own, edits a draft's shipping address (phone
included), shipping method (with a custom amount) and items, deletes one made by mistake, cancels
one the shop won't fulfil, and converts one.

**Converting** reserves inventory and fails if an item sold out since the draft was made. It sets the
status to pending, creates the Order's payment collection and emits order placed.

### A store creates a draft from a Cart, and the Cart closes

One store route, off unless the store settings enable it, turns a Cart with its shipping address
(phone included when given) and shipping method into a Draft Order. It completes the Cart in the
same transaction, so the shopper can no longer change it, it can't be checked out, and the
storefront starts a new Cart. Sending the same Cart again returns its existing draft unchanged,
through the order–cart link, so an admin's edits are never overwritten. A line that can't be sold
(sold out, deleted variant) refuses the draft with the line named. Nothing is reserved and no
payment is taken, so an abandoned draft never locks stock.

### A deposit converts the draft

The convert action may record a payment in the same step. A store that takes deposits converts a
draft when the deposit arrives, so stock is held exactly once the deposit is paid. Converting
without a payment stays possible.

### One payment collection per Order, paid by partial captures

The system payment provider is a real manual payment provider. As in Medusa, a Region offers it at
checkout only when the admin links it to that Region.

An Order has one payment collection, for its total, created when a draft converts or a Cart
completes. The first payment the admin records opens a manual payment session and authorizes the
collection's amount; every recorded payment then captures part of it: the deposit, later the rest.
Refunds are recorded against the captures the same way. Each capture and each refund writes one
Order Transaction, keyed by the payment-module row it records, so a retried workflow step never
writes it twice.

- **Paid Total** is the sum of the Order's transactions. **Outstanding Amount** is its total minus
  its Paid Total.
- Recording a payment locks the payment collection's row, so two admins recording at once can't
  capture more than was authorized. An amount above the Outstanding Amount is refused, and so is a
  refund above what was received.
- The admin's «record payment» is prefilled with the store's deposit share of the total for the
  first payment, when the store settings give a deposit percentage, and with the Outstanding Amount
  afterwards. The deposit share is rounded to the currency's precision; nothing else is rounded.

Because this is Medusa's model, a store can later let the shopper pay the same collection through a
real provider, with no change to the Order.

### Canceling asks how much to refund

Canceling an Order with money received asks for the amount to refund, from nothing to all of it,
all by default. The cancel records that refund, cancels what remains authorized and cancels the
Order, in one action, so the books show what the shop kept. Cancel accepts drafts as well as
pending Orders.

### Three statuses, kept apart

An Order has three independent statuses:

- its **status**: `draft`, `pending`, `completed`, `canceled`, `archived`;
- its **payment status**, aggregated from its payment collection and payments as Medusa does:
  `not_paid`, `awaiting`, `authorized`, `partially_authorized`, `partially_captured`, `captured`,
  `partially_refunded`, `refunded`, `canceled`, `requires_action`;
- its **fulfillment status**, computed from its fulfillments (ADR-0030).

Each read returns them separately, and the shared HTTP schemas carry the widened payment status.
Each store maps them onto its own wording; Proteus names none of them for the shopper.

### The order link is public, and a lost link is found by number and phone digits

The store's order read by Order id answers anyone holding the id, drafts included. The id is a
random UUID with a prefix (ADR-0003), so it can't be guessed. The read returns an allowlisted set of
fields: the three statuses, the reference, the lines with their options, the shipping address's
city and province, the shipping methods, and the totals with Paid Total and Outstanding Amount. It
returns no email, no street and no full phone. When the reader is the signed-in Customer who
placed the Order, the read adds an `owner` block with the email and the full shipping address; any
other reader, signed in or not, gets the public view.

A shopper who lost the link looks the Order up by its display id and the last 4 digits of the phone
on its shipping address, compared after stripping everything but digits. A match answers the Order
id. Wrong digits, an Order without a phone and an unknown number all answer the same 404, from the
same single query, so the lookup says nothing about which Orders exist. Attempt limiting is
deferred.

An Order's **reference** is the store's optional prefix followed by its display id (`ORD-1042`),
or the bare display id when the store sets no prefix.

### Calculated shipping

Geo zones match as Medusa's do: a service zone serves an address when any of its geo zones matches
it. A country zone matches the country; a province zone the country and province; a city zone those
and the city; a postal-code zone those and the postal code. Province, city and postal code compare
trimmed and case-insensitively.

A calculated shipping option is priced by its fulfillment provider's `calculatePrice`, from the
option's data, the method's data and the Cart with its items and shipping address. A provider that
can't price the address throws a typed "can't calculate" error, and the option is left out of the
Cart's options. Setting a shipping method stores the calculated amount and the provider's
`validateFulfillmentData` result on the method. When the Cart's items or shipping address change,
calculated methods are re-priced, or removed when no longer available (Medusa's refresh). Completing
a Cart and creating a draft copy the method as stored. A delivery estimate is the provider's
business and lives in the method's data.

### An extension may bring a fulfillment provider

The extension registry carries fulfillment provider declarations. The fulfillment module's
bootstrap merges them into its own, so they resolve from the module's container as core's do, and
the provider sync and seed scripts include them, so workerd gets their rows. An extension provider
may depend on its own extension's module services (the rate table), resolved from the shared
container; it may not reach core module internals. `extensions:generate` checks that its identifier
carries the extension's prefix and doesn't collide with core's.

Draft orders need no hook. Shipping is priced by a fulfillment provider, and deposits are payments,
so nothing about an order's charges is left for a store to compute.

### Store settings

The store settings package (`packages/store-config`) gains an optional deposit percentage, an
optional order reference prefix and a flag that enables store-side drafts, off by default. Proteus
ships neutral values, and the admin reads the same package. The backend reads the flag
(`STORE_DRAFT_ORDERS_ENABLED`) as `projectConfig.store.draftOrders`; with it off, the store draft
route answers 404.

### Events and permissions

No event is added. The working spec planned events for a recorded capture, a recorded refund, a
converted draft and a canceled draft. None ships, because the event map adds an event only together
with the subscriber that consumes it (`apps/backend/src/core/event-bus/events.ts`,
`standards/rules/backend/subscribers/__docs__/events.md`), and nothing consumes these yet. A
draft's conversion publishes the existing `order.placed`, as a checkout does. Nothing is published
when a draft is created, edited or canceled, or when the admin records a payment or a refund; the
existing `payment.captured` stays the gateway webhook's event. The first subscriber that needs one
of these adds the event with it.

One permission key is added, `order.edit`, for editing and deleting drafts. Listing and reading
drafts take `order.read`, converting takes `order.complete`, canceling takes `order.cancel`, and
recording a payment or a refund takes `payment.capture` or `payment.refund`.

## Where Proteus departs from Medusa

1. **Drafts are created from the store.** Medusa creates drafts only in the admin. Proteus turns a
   shopper's Cart into a draft through an opt-in store route that also closes the Cart. Admin
   creation of a draft from scratch is not ported.
2. **Converting can record a payment.** Medusa converts a draft and records payments separately.
   Proteus records the deposit in the same action, so stock is held only once the deposit is paid.
3. **The refund amount is chosen at cancel.** Medusa's cancel refunds every captured payment.
   Proteus asks the admin how much to return, from nothing to all of it.
4. **A guest looks an Order up by its number and phone digits.** Medusa has no such lookup.
5. **The store's order read depends on who reads it.** Medusa's store order read answers one shape.
   Proteus answers an allowlisted public view to anyone holding the id, and adds the `owner` block
   (email, full shipping address) only for the signed-in Customer who placed the Order. A signed-in
   reader who didn't place it gets the public view.
6. **Payments are recorded on the Order, and mark-as-paid is gone.** Medusa's admin marks a payment
   collection paid in full (`POST /admin/payment-collections/:id/mark-as-paid`). Proteus deletes
   that route and records a payment of any amount with `POST /admin/orders/:id/payments`, which
   authorizes the Order's one collection on the first payment and captures each amount against it.
7. **The store's shipping options read takes the address in the query.** Medusa prices a Cart's
   shipping options from the address saved on the Cart. Proteus's store read also accepts
   `province`, `city` and `postalCode` query values that stand in for the saved ones, so a
   storefront can quote calculated shipping for a city the shopper is still typing, before the
   address is saved.

Recording a capture of any amount from the admin also goes beyond Medusa's dashboard, which captures
only the full amount; its workflows already take an amount.

## Amendments

**ADR-0038 (extensions).** Extension-owned fulfillment providers are supported, as set out above.
Payment and notification providers, and providers that need secrets, stay deferred. The first hook
does not ship with draft orders, since draft orders need none.

## Considered Options

**Storing an order's charges, through a hook an extension handles.** This was ADR-0038's plan: a
draft order would compute its charges (shipping, deposit) through a core hook, and the store's
extension would supply its own rule. Rejected. Shipping already has a port, the fulfillment
provider's `calculatePrice`, and a deposit is money received, which is a payment. A charges hook
would have been a second place to price shipping and a second ledger beside the payment collection.

**One payment collection per recorded payment.** Medusa's model allows several collections on one
Order, each created for an amount and marked paid in full. Rejected. The Order's total would be split across collections whose amounts are only known
after the fact, and a later real provider could not take "the rest" as one collection.

**A draft that reserves stock.** Rejected. Most drafts end without a sale, and a reservation per
abandoned draft would show items as sold out that are on the shelf. Stock is held at conversion,
which can fail when an item sold out in between.

**A draft that leaves the Cart open.** Rejected. The shopper could keep editing a Cart the shop
was already confirming with the shopper, and the two would drift. Closing the Cart, and returning
the same draft when it is sent again, keeps one order per Cart.

**A draft order table of its own.** Rejected. Medusa's draft is an Order with a status, and every
Order read, edit and total already works on it.

**Attempt limiting on the lookup now.** Deferred. The answer is the same 404 for every failure, the
digits narrow a display id to one phone, and the MVP accepts the remaining guessing risk.

## Deferred

- Attempt limiting on the order lookup.
- A job that archives drafts older than a set age.
- Order edits after conversion (Medusa's order changes), returns, exchanges and claims.
- Admin creation of a draft from scratch.
- Extension payment and notification providers, and providers that need secrets.
- A carrier tracking integration, and a delivery estimate column.
- Notifications for status changes; the shop messages the shopper.

## Consequences

- A store that sells through a chat runs end to end on Proteus: Cart, draft, deposit, conversion,
  the rest on delivery, cancel with a partial refund, and an order page the shopper can share.
- A card-only store sees nothing new: store drafts are off, and the manual provider is offered only
  where a Region links it.
- Every Order read that shows money computes Paid Total from the Order's transactions, so a store
  read and an admin read agree with what was received.
- Anyone with an Order's id can read its allowlisted fields. The id is the bearer token, as the
  Cart's id already is.
- An Order without an email gets no confirmation email, and nothing else treats it differently.
- An extension's fulfillment provider runs on Node and on workerd like core's, so a courier's rate
  table lives in the fork's extension instead of in the fulfillment module.

## References

- `.scratch/draft-orders-and-payments/spec.md`: the working spec
- `CONTEXT.md`: Order, Draft Order, Order Transaction, Paid Total, Outstanding Amount, Reference
- `apps/backend/src/modules/payment/README.md` and `apps/backend/src/modules/fulfillment/README.md`
- `standards/rules/backend/extensions/__docs__/extensions.md#a-fulfillment-provider`
- Medusa: `OrderStatus`, the draft-order workflows and admin routes, `markPaymentCollectionAsPaid`,
  `capturePaymentWorkflow`, the payment status aggregation, the system payment provider,
  `cancelOrderWorkflow`, `listShippingOptionsForCartWithPricingWorkflow`,
  `addShippingMethodToCartWorkflow`, `refreshCartShippingMethodsWorkflow`, and the fulfillment
  provider's `calculatePrice`
