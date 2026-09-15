# Inventory Module Completion

## Problem Statement

The shop can sell the same last unit an unlimited number of times, and the shopkeeper has no screen
that would tell them.

Placing an order does not reduce what the storefront offers. A reservation row is written at
checkout and nothing else happens: `reservedQuantity` on the inventory level is written by no code
path at all, so its value is the column default forever. Available quantity is stocked minus
reserved, which means it ignores every order that has been placed and not yet fulfilled. Two
shoppers buying the last unit both succeed, and the product page keeps offering it to a third.

The reservations that would have prevented this are written against the *cart*'s line item ids and
read back by *order* line item id, so they never match. Cancelling an order therefore never
releases its stock — the reservation is stranded and the units stay unsellable. Fulfilling an order
whose variant is tracked throws before it can adjust anything, so fulfillment is impossible for any
tracked variant at all.

Around that, four things are missing rather than broken. There is no Stock Location entity, so the
location a level or a reservation names is free text: the seed writes one constant, the test
factories mint another, and the admin fulfillment route takes whatever the client sends. There is
no admin surface — a shopkeeper cannot see what they have, set a number after a stock count, or see
what is committed to orders; only the seed script has ever written stock. Creating a variant
creates no inventory at all, so every variant added through the admin is silently untracked and
treated as infinitely available. And the two flags that would let a shopkeeper opt out of tracking
or allow a backorder are columns nothing reads.

## Solution

Make the numbers true, then give the shopkeeper the screens to set them and the shopper the answers
to render.

`reservedQuantity` becomes a counter maintained in the same transaction as the reservation that
moves it, with the coverage check in front of it — so a reservation cannot be written for stock
that is not there, and available quantity finally reflects orders in flight. Reservations move to
the order's line item ids, which the checkout workflow already has when it writes them, which makes
cancellation and fulfillment work for the first time.

A new Stock Location module gives the location something to resolve against. It holds one location,
created by the seed, with no screen to create a second — but the tables are multi-location from the
first migration, and the column and table names match Medusa's exactly so that a future schema diff
shows which pieces are missing rather than which have been renamed.

Tracking and backorder start being read. An untracked variant is skipped before confirmation and
before reservation and stays permanently buyable; a backorder variant skips the coverage check but
still reserves. Creating a variant creates its Inventory Item, its link and its level; untracking
one soft-deletes the item and re-tracking restores it, so the toggle is lossless in both
directions.

The shopper gets answers rather than numbers: the product list says whether a product is sold out,
the product page says sold out, or how few are left, and the Add to cart button reflects it. The
shopkeeper sets stock on the variant, where they already set prices, and scans it on one read-only
Inventory list with a Reservations tab beside it. When available quantity crosses a store-wide
threshold, a subscriber writes a notification into the admin feed that already exists.

## User Stories

1. As a shopper, I want a variant that has sold out to stop being offered, so that I do not pay for something that will never ship.
2. As a shopper, I want to see how few are left when stock is low, so that I can decide now instead of losing it.
3. As a shopper, I want the Add to cart button to be disabled and say so when a variant is sold out, so that I find out before checkout rather than at it.
4. As a shopper, I want a sold-out product to still appear in the product list, so that I can find it again and it keeps its place in search results.
5. As a shopper, I want a variant the shop does not track to stay buyable, so that a made-to-order item is not falsely reported as sold out.
6. As a shopper, I want the option picker to strike through combinations I cannot buy, so that I do not select my way into a dead end.
7. As a shopper, I want my order to hold the stock it needs the moment it is placed, so that another shopper cannot take it between my payment and my shipment.
8. As a shopper, I want checkout to refuse rather than half-succeed when the last unit went while I was typing my card details, so that I am not charged for something that cannot ship.
9. As a shopkeeper, I want to see what I have in stock across the whole shop on one page, so that I can decide what to reorder without opening every product.
10. As a shopkeeper, I want that page to distinguish what is on the shelf from what is committed to orders, so that I do not count units that are already sold.
11. As a shopkeeper, I want to filter that page to what is running low, so that reordering is a short list rather than a scan.
12. As a shopkeeper, I want to set a stock number on the variant, next to where I set its price, so that I do not have to learn a second vocabulary to correct a stock count.
13. As a shopkeeper, I want a variant I create to start being tracked without any extra step, so that I cannot accidentally publish something with infinite stock.
14. As a shopkeeper, I want to mark a variant as not tracked, so that a digital or made-to-order item is always available.
15. As a shopkeeper, I want to turn tracking back on and find my stock number still there, so that untracking something for a day is not a destructive act.
16. As a shopkeeper, I want to let a specific variant be ordered past zero, so that I can take pre-orders on something I know is coming.
17. As a shopkeeper, I want to be told when a variant drops low, so that I reorder before it sells out rather than after.
18. As a shopkeeper, I want to set the threshold that counts as low, so that it matches my own lead times.
19. As a shopkeeper, I want that notification to take me to the variant it is about, so that acting on it is one click.
20. As a shopkeeper, I want cancelling an order to put its stock back, so that a cancelled order does not make the shop look emptier than it is.
21. As a shopkeeper, I want fulfilling an order to take its stock off the shelf, so that the numbers match the warehouse.
22. As a shopkeeper, I want fulfilling an order to work at all for a tracked variant, so that I can ship the things I sell.
23. As a shopkeeper, I want a fulfillment request that covers only some of an order's items to be refused, so that I am not told the whole order shipped when it did not.
24. As a shopkeeper, I want to see every reservation the shop is holding and which order each belongs to, so that I can explain where the missing units went.
25. As a shopkeeper, I want a stock number I could not have meant — below what is already committed — to be refused, so that available quantity cannot go negative behind my back.
26. As a shopkeeper, I want deleting a variant to take its inventory with it, so that the inventory list does not fill with rows pointing at nothing.
27. As a shopkeeper, I want a variant that is not tracked to show no stock number rather than zero, so that untracked and sold out are visibly different.
28. As a developer, I want the location a level and a reservation name to resolve to a real Stock Location, so that a typo fails at the write rather than silently at fulfillment.
29. As a developer, I want the inventory schema's table and column names to match Medusa's, so that diffing the two tells me which features are missing rather than which names differ.
30. As a developer, I want the oversell race to be recorded as a test that demonstrably fails, so that the need for locking is proved on every run rather than remembered.
31. As a developer, I want the two workflow test files still on hand-written mocks to run against a real container, so that the test-infrastructure migration is finished.

## Implementation Decisions

Every decision below was settled by reading Medusa's implementation in `medusa-source`. Where Medusa
has no answer — low stock, the storefront projection, the single-location model — that is called
out.

### The Stock Location module

A new module owning one table. It carries an id, a name and timestamps, matching Medusa's column
names exactly.

Medusa's `stock_location` also has an `address_id` pointing at a `stock_location_address` table.
Neither is built: nothing in this codebase records a ship-from address, nothing would read one, and
`address_id` is nullable in Medusa anyway. When the shipping work needs an origin address it adds
the column and the table under Medusa's names, and the schema diff shows exactly that gap. Medusa's
`metadata` column is not built either, for the same reason.

The shop has exactly **one** Stock Location, created by the seed the way the store, the regions and
the default shipping profile already are. There is no create or delete endpoint and no screen that
would offer one. The tables remain multi-location — the level's uniqueness is still per item *and*
location — so a second location is an additive change rather than a schema split across live order
history.

The location a level or a reservation names stays plain text with no foreign key, because it
crosses a module boundary. Integrity comes from a validation step that resolves the ids before
either row is written, which is how Medusa does it and how every other cross-module reference in
this codebase already works.

### `reservedQuantity` is a maintained counter

Rejected alternative: deriving availability by summing live reservation rows. The column already
exists, Medusa maintains it, and a sum over reservations turns every availability read on a product
page into a join against a table that grows with order volume.

Three operations move it, each inside the transaction that writes the reservation it belongs to:
creating a reservation adds, soft-deleting one subtracts, restoring one adds back. Medusa also has
an update path that moves the delta and handles a location change; it is **not** built, because
nothing calls it — the only caller would be partial fulfillment, which is out of scope.

Creating a reservation gains two guards, in order:

1. every item/location pair has a level row, else a not-found error naming both;
2. unless the reservation allows backorder, available quantity covers the requested quantity, else
   a not-allowed error.

Backorder skips only the second. It still requires a level row at the location, matching Medusa,
which is what guarantees the fulfillment adjustment is never handed a location it cannot find.

`reservedQuantity` is removed from the level's create and update DTOs. Medusa strips it from the
input at runtime with a comment saying it must only move through reservations; typing it out is the
stronger form of the same rule.

### Reservations are keyed to the order's line items

The checkout workflow's reserve step already runs after the order exists, so it builds its input
from the order's line items rather than the cart's. Cancellation and fulfillment then find what
they look for, with no mapping table and no extra column on the order line item. This is exactly
what Medusa does.

The inventory confirmation workflow keeps taking a generic line item shape and keeps being handed
cart line items — it only checks coverage and never writes a reservation.

This unblocks the last two workflow test files still running against hand-written mocks; both move
onto the real container as part of the same work.

### Location selection

Available locations for an inventory item are the locations where it has a level; the first is the
one a reservation is written against. Medusa ranks a larger candidate set — locations that already
cover the demand, then locations with any level, then all of them — but at one location every tier
selects the same element, so the ranking is not built.

The current fallback to an empty string is deleted. A tracked variant with no location is an
invalid-data error, matching the error type Medusa raises for the equivalent case.

### Tracking and backorder

Both flags keep their current defaults, which match Medusa: tracking on, backorder off. The admin
payloads already accept both; today they do nothing.

- **Untracked** — the variant is dropped before confirmation and before reservation, and the
  storefront renders it as available. It is never sold out and never low.
- **Tracked with no linked Inventory Item** — an invalid-data error. Today this is silently treated
  as buyable, which is what lets an admin-created variant oversell without limit.
- **Backorder** — skips the coverage check when confirming and when reserving, and the flag is
  carried onto the reservation row so the release path is symmetric.

A backorder variant renders to the shopper as plain available: the button says Add to cart and
nothing mentions a wait. A distinct shopper-facing backorder state is deliberately deferred; it is
a conversion decision rather than a technical one and is recorded as a TODO.

### The variant lifecycle creates and destroys inventory

**On create**, a tracked variant gets an Inventory Item seeded from the variant — sku, title,
description, origin country, hs code, mid code, material, the four dimensions, requires-shipping —
linked at a required quantity of one. This is Medusa's field map.

It also gets an inventory **level** at the one location with a stocked quantity of zero. This is a
deliberate divergence: Medusa creates no level, because its admin has a flow for adding a location
to an item, and ours will not render one. Without the level the variant would have nowhere to put a
number and no way to become sellable.

**On untrack**, the variant's inventory link is dismissed and the Inventory Item is soft-deleted.
**On re-track**, both are restored. Medusa dismisses the link only, orphaning the item and its
stock, and re-tracking creates nothing at all — so under Medusa a variant untracked once can never
be tracked again. The divergence is named: *Medusa orphans the Inventory Item on untrack and cannot
re-track; we soft-delete it and restore on re-track, so the toggle is lossless both ways.*

**On delete**, the Inventory Item is deleted when no surviving variant links to it, matching
Medusa, alongside the price-set cleanup the delete workflow already performs.

### Fulfillment stays whole-order

The admin fulfillment payload already accepts an arbitrary subset of items, and the workflow
already ignores the subset: it de-reserves and adjusts every line item on the order and marks the
whole order fulfilled. That silent mismatch is closed by **validating that the requested items
cover every line item** — a partial request becomes a rejection rather than a full fulfillment
reported as a partial one.

Medusa's partial semantics — deduct the requested quantity, reduce the reservation, delete it only
at zero — are not implemented. Per-item fulfillment is already a named future item, and half of it
(a correctly reduced reservation on an order marked fully fulfilled) is worse than none.

The fulfillment payload's location becomes **optional**, resolved from the reservation when absent.
That is the only location that can hold the stock, because a reservation can only be written where
a level exists. Medusa instead falls back through the shipping option's fulfillment set to a linked
Stock Location; that link exists to decide *which* location ships, a question one location does not
raise.

### The storefront is handed answers, not numbers

Per ADR-0015, the backend answers the question and the client renders the answer. The storefront
does no thresholding and no arithmetic.

The list and detail schemas already diverge — the list item carries no variants at all, only a
starting price — so each gets the answer at its own grain.

**Product list** gains a single product-level boolean: sold out, true when no variant is
purchasable. Sold-out products stay in the list and render the badge pill the reference design
already places at the image's bottom left. They are not filtered out: unlike a product with no
price in the current currency, which cannot be rendered at all, a sold-out product renders fine and
delisting it discards an indexed URL.

**Product variant** replaces its boolean with a discriminated union. The shape, which encodes the
decision more precisely than prose:

```ts
stock:
  | { state: 'available' }
  | { state: 'low'; remaining: number }
  | { state: 'soldOut' }
```

`remaining` exists only in the branch that renders it. Untracked, backorder and in-stock all
collapse to `available`, because the storefront has no reason to tell them apart. The disabled Add
to cart button reading Sold out is a render of the sold-out state, not a second field — two fields
that must agree is the drift risk that justified removing the old boolean in the first place.

The option picker's projection keeps its internal boolean; it is now derived from quantities rather
than from a wire field. Medusa's equivalent is a raw number on the variant and a purchasability
rule left to the storefront, which is the shape ADR-0015 exists to reject.

The store-facing cart inventory endpoint is deleted. It runs the confirmation workflow and returns
inventory item ids and location ids to shoppers, the storefront has never called it, and Medusa has
no store-facing inventory route at all.

### Low stock

Medusa has no low-stock concept anywhere — no threshold, no event, no notification — so this is
ours end to end.

A store-wide threshold lives on the store record, nullable, editable in store settings. There is no
Medusa column to name it after, so it is visibly an addition in any schema comparison. The same
number drives both the shopkeeper's alert and the shopper's "only N left" line: one setting, one
meaning, splitting it is a second setting nobody has asked for.

A new event is emitted wherever available quantity moves down: reserving at checkout, adjusting at
fulfillment, and the admin stock write. It carries the level id plus the resulting stocked and
reserved quantities, and its dispatch key is all three. The quantities are part of the change's
*identity*, not a snapshot for the subscriber — the subscriber re-reads the level — which follows
the existing precedent where a payment event keys on its id and its action together. Keying on the
id alone would mean once-per-level-forever: a variant that dips low, is restocked and dips again
would be deduped into permanent silence.

The event is **not** given Medusa's name. Medusa's level-updated event fires on stocked changes
only and explicitly not on reservations; reusing the name for something with a wider trigger is the
one case where matching names makes a comparison lie.

A subscriber does the threshold comparison and writes a feed-channel notification, idempotent on
its own key, which the admin's existing notification bell renders. Most deliveries are no-ops,
which keeps the threshold in exactly one place. The seed's hand-written low-stock notification —
currently a fixture for a feature that does not exist — is replaced by the real thing.

### The admin surface

Two jobs, deliberately separated: *setting* a number, which belongs next to the thing it describes,
and *scanning* for what needs reordering, which is inherently cross-product.

**Setting** happens on the variant. The product's variant table gains a stock column showing
available quantity, with an em dash rather than a number for an untracked variant, and a write
route scoped to the variant. That route resolves the Inventory Item through the link and the
location server-side, so the client makes one request; Medusa's route is keyed by item and
location, which would cost the admin two lookups to set one number. The value is absolute, not a
delta, matching Medusa, and the server refuses a value below the committed quantity — Medusa
enforces that in its form only, so its API can drive availability negative.

**Scanning** happens on one read-only Inventory list, under Medusa's endpoint name, joined with the
variant and its level: product, variant, sku, stocked, reserved, available. Sortable, filterable to
low stock, each row linking back to its variant. There is no Inventory Item detail page, because
the variant page already is one.

A read-only Reservations list sits beside it as a sibling route under a single Inventory nav entry
— reservations are a lens on inventory rather than a peer of it. Each row links to its order.

Not built, for want of a caller: an Inventory Item create endpoint (items come from variant
creation and nothing else), any level-delete endpoint (levels come and go with variants), reservation
creation (Medusa's exists for draft orders, which do not exist here), and an Inventory Item detail
page.

The Locations settings page is deferred to the shipping work. With a name and nothing else, the
page is a rename box, and when shipping lands it will be rebuilt around service zones anyway. The
one location is renameable through the API in the meantime.

### The `metadata` columns

The three inventory tables carry a `metadata` text column written by nothing and read by nothing, a
Medusa mirror. They are dropped, along with their DTO fields. Under the naming rule this is the
correct outcome: a diff against Medusa showing the column missing is the rule working.

This is the only reason the inventory migration changes at all — the counter needs no schema
change. Eleven identically dead `metadata` columns on other modules are recorded as a separate
sweep rather than swept here.

`incomingQuantity` is **kept** as it is: a column nothing writes, with the restock concept recorded
as a TODO. In Medusa it is a number a shopkeeper types by hand that blocks level deletion, and
neither half has a home here yet.

### Concurrency

Two concurrent checkouts can still both reserve the last unit: the counter makes availability true,
it does not make check-then-act atomic. Medusa wraps reserve and release in a distributed lock over
the inventory item ids; there is no locking module here and "investigate locking" is an existing
separate item.

This is recorded as a test that demonstrably fails rather than as a comment, and the existing
locking item stays where it is.

### Vocabulary

`CONTEXT.md` gains the inventory terms it has no entry for — Stock Location, Inventory Item,
Inventory Level, Reservation, Available Quantity, Stocked Quantity — with the `_Avoid_` lines the
rest of the glossary carries. Several of these have two plausible names (stock versus inventory,
committed versus reserved) and the admin, the storefront and the module currently pick differently.

## Testing Decisions

A good test here asserts what a shopper or a shopkeeper can observe, not how the module reached it.
Assert the badge, the disabled button and the refusal — not that a repository method was called.
Per the repo's rule, every assertion added must have a named mutation that turns it red, and that
mutation must actually be run and then reverted before the work is called done; the same applies to
the schema and import gates this touches.

The seams, highest first, preferring the ones that already exist:

**Store product API** — the existing product API test file is already the seam for stock
availability; it asserts the old boolean against real stocked and reserved quantities today. It
becomes the primary seam for the whole projection: seed stock, reserve some of it, and assert the
shopper-visible answer. This single seam covers the maintained counter, untracked variants,
backorder variants, the sold-out flag on the list and the low state with its remaining count. Most
of the feature's behaviour is provable here without a second seam.

**Store cart API** — the existing cart API test file already holds the checkout concurrency test.
It gains the cases where reserving is refused because the stock went, and the case where completing
a cart leaves the level's reserved quantity raised. Note what the existing concurrency test
actually proves: one cart completes once, on the order/cart unique index — not that stock is
respected across different carts. That gap is what the product API seam above closes.

**Workflow tests against a real container** — the checkout, cancellation and fulfillment workflows
already have test files; the latter two are the last on hand-written mocks and move onto the real
container as part of this work, which is the deliverable that unblocks the test-infrastructure
migration. Cancellation asserts the stock comes back; fulfillment asserts it comes off and that a
partial request is refused.

**Inventory module tests** — the one genuinely new file. Prior art is the other modules' service
tests, which run against real Postgres with manually constructed services. This seam exists because
the counter's invariants are laborious to drive through HTTP and because the lost-update proof
needs two transactions held open at once, which no higher seam can express. It covers: reserving
lowers available; releasing restores it; restoring a released reservation re-reserves; reserving
beyond coverage throws; a backorder reservation does not; reserving at a location with no level
throws.

**The oversell proof** lives here as a deliberately failing test with a TODO above it. It is written
at the transaction level rather than as a race — two connections, both read the reserved quantity,
both write it incremented, both commit, then assert two units are reserved and watch one appear.
That is a deterministic lost update rather than a timing race, so it runs identically on every
machine. The day a row lock lands, the second transaction blocks, the assertion starts passing, and
the failing-test marker is what goes red to say so.

**Admin API** — new test files alongside the existing admin route tests, for the Inventory list's
join and filter, the Reservations list, and the variant stock write including its refusal below
committed quantity.

**Store component tests** — the existing browser-mode seam, props in and render out, for the sold-out
badge, the low-stock line and the disabled button. No new seam; these are pure renders of the union.

**Not tested through a new seam**: the low-stock subscriber is covered the way the existing
notification subscriber is, and the variant lifecycle is covered through the product workflow tests
that already exist.

No test may fake our own API. A wallet-style shortcut — stubbing the availability endpoint to
produce a sold-out state — would delete the projection, the counter and the reservation from the
test while leaving it green.

## Out of Scope

- **Multi-location operation.** The schema is multi-location and the location ranking is not built;
  the admin ships one location with no way to create a second.
- **A ship-from address.** No address column and no address table; both arrive with the shipping
  work, under Medusa's names.
- **Locking.** Two concurrent checkouts can both reserve the last unit. The defect is proved by a
  failing test; the fix stays the existing separate item.
- **A restock or purchase-order concept.** `incomingQuantity` stays a column nothing writes.
- **Partial and per-item fulfillment.** Whole-order only; a partial request is refused rather than
  mishandled.
- **Returns restocking.** No return flow exists.
- **A shopper-facing backorder state.** Backorder is honoured by the backend and renders as plain
  available.
- **The Locations settings page**, and the admin shipping tree that will nest under it.
- **The eleven remaining dead `metadata` columns** on other modules.
- **An ADR.** Three named divergences from Medusa are recorded here — the lossless tracking toggle,
  the level created with a variant, and the single-location model. Whether they warrant an ADR of
  their own is a call to make once the shape has survived implementation.

## Further Notes

**Two corrections to the original todo item**, both load-bearing:

- `incomingQuantity` is not "read by the availability projection". It is read by nothing anywhere.
  Availability is stocked minus reserved and always has been.
- The store-facing boolean is not dead either: the option picker's projection consumes it
  server-side before the response is assembled. It is the copy on the wire that no client reads.

**A third finding not in the todo item**: the admin fulfillment payload accepts a subset of an
order's items and the workflow ignores the subset entirely, so a shopkeeper can request two of five
items and be told all five shipped. That is closed here.

**The sequencing seam.** The work splits cleanly into correctness — the Stock Location module, the
counter, the order line item keying, the tracking flags, the variant lifecycle, whole-order
fulfillment, the two blocked test files, the oversell proof — and surfaces — the storefront states,
the admin stock column and lists, the low-stock event and threshold. The first half is independently
shippable and fixes three live defects on its own. Tickets are ordered in those two phases; the spec
is one document because the design is one argument.
