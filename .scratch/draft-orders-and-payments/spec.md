# Draft orders, manual payments, calculated shipping and guest order status

## Problem Statement

Some stores built from Proteus don't take payment at checkout. They sell through a chat: the shopper builds a Cart,
hands it to the shop on WhatsApp, the shop confirms the pair is available, asks for a deposit by bank transfer,
ships, and collects the rest cash on delivery. Proteus can't express any of that:

- An Order only exists as a completed Cart, which requires an email, a card-style payment and a payment session
  whose amount equals the Cart total. There is no way to save a Cart as an order the shop hasn't confirmed yet.
- Manual payment is a test-only provider. The admin can mark a payment collection paid only for its full amount;
  capture always takes the full amount; neither writes the Order's transactions, so a paid Order still reads
  "awaiting". There is no way to record a deposit and later the rest.
- Shipping prices are flat per option. The fulfillment provider port can calculate a price, but nothing calls it;
  city and province geo-zone matching is disabled; a calculated option is stored at 0. A store whose courier charges
  by city, weight and declared value can't quote shipping in the Cart.
- A guest can't come back to an Order: the store order read assumes the confirmation page, shows no paid or
  outstanding amounts, and there is no lookup by order number.
- A fork that needs its own fulfillment provider (a courier's rate table) has to edit Proteus files, because
  extension-owned providers are deferred (ADR-0038).

The motivating store is the Pisos DJ fork, which built all of this inside Proteus files in its own branch and now
needs it upstream so its syncs stop conflicting.

## Solution

Proteus ports Medusa's draft orders, manual payments and calculated shipping, and adds two generic store features
a store that sells through a chat needs:

- A shopper turns a Cart, with its shipping address and shipping method, into a **Draft Order** from the store. The
  shop sees it in the admin, edits it after the chat (phone, shipping), and converts it to a pending Order when the
  deposit arrives, recording that payment in the same action. Stock is held only then.
- The admin records **manual payments** of any amount, as Medusa does: the Order has one payment collection for its
  total, authorized through the manual payment provider, and each recorded payment is a capture of part of it (the
  deposit, then the rest). Each capture writes an Order transaction, so the Order's paid total, outstanding amount
  and payment status (`partially_captured`, then `captured`) follow what was actually received. Because it is
  Medusa's model, a store can later take the same collection through a real payment provider instead. Refunds are
  recorded the same way; canceling an Order with money received asks how much of it to refund.
- **Calculated shipping**: shipping options are matched to the Cart's address down to the city, and a calculated
  option is priced by its fulfillment provider from the Cart's address and items, stored on the Cart's shipping
  method, re-priced when the Cart changes, and copied to the Order.
- **Guest order status**: anyone with an Order's link reads it, drafts included, with its status, payment status,
  fulfillment status, paid total and outstanding amount kept separate. A shopper who lost the link finds the Order
  by its number and the last 4 digits of the phone on its shipping address.
- **Extension-owned providers**: an extension can bring a fulfillment provider, registered and synced like core's.
  Payment and notification providers stay deferred.
- Store-side drafts and manual payment at checkout are both **opt-in**, so a card-only store exposes nothing new.

Each store maps the three statuses onto its own wording; Proteus stays generic.

## User Stories

### Shopper

1. As a shopper, I want to enter my city and department in the Cart, so that I see what shipping to my city costs before I order.
2. As a shopper, I want the Cart's shipping options to be the ones that deliver to my address, so that I never pick one that doesn't reach me.
3. As a shopper, I want a calculated shipping price to reflect my items, so that the price I see is the price the shop charges.
4. As a shopper, I want the shipping price to update when I change quantities or remove a pair, so that the Cart total stays right.
5. As a shopper, I want to know when no shipping option reaches my address, so that I can still order and agree shipping in the chat.
6. As a shopper, I want to optionally give my phone number in the Cart, so that I can later look up my order with it.
7. As a shopper, I want to send my Cart to the shop as an order without paying, so that the shop can confirm availability first.
8. As a shopper, I want sending the same Cart again to give back the same order, unchanged, so that the chat refers to one order and nothing the shop agreed with me is overwritten.
9. As a shopper, I want my Cart to close once I've sent it, and a new Cart to start, so that what I sent can't drift from what the shop sees.
10. As a shopper, I want the shop to refuse my order if a pair sold out, with the pair named, so that I can remove it and try again.
11. As a shopper, I want to send an order without an email address, so that a chat is enough to buy.
12. As a shopper, I want a link to my order right after sending it, so that I can see what I ordered and what happens next.
13. As a shopper, I want my order's link to work for anyone I share it with, without signing in, so that I don't need an account.
14. As a shopper, I want my order page to show the pairs, their size and colour, quantities, subtotal, shipping, total, what I've paid and what I still owe, so that I know where I stand.
15. As a shopper, I want my order page to show separately whether the shop has confirmed it, whether my payments arrived and whether my order shipped or was delivered, so that each part is clear.
16. As a shopper, I want to find my order with its number and the last 4 digits of my phone when I lost the link, so that I can check it any time.
17. As a shopper, I want a wrong number, wrong digits or an order without a phone to answer the same "not found", so that nobody can tell which orders exist.
18. As a shopper, I want my order page to show when it was canceled, so that I know I owe nothing.

### Shop (admin)

19. As a shop admin, I want to see draft orders in a list of their own, so that I can follow the chats that haven't confirmed yet.
20. As a shop admin, I want to open a draft and see its pairs, address, phone, shipping and totals, so that I can confirm it in the chat.
21. As a shop admin, I want to add or change the shopper's phone and address on a draft, so that I can record what the shopper told me in the chat.
22. As a shop admin, I want to set or override a draft's shipping amount, so that I can charge what I agreed in the chat when the Cart had no city.
23. As a shop admin, I want to add, change the quantity of and remove a draft's items, priced in the Cart's region, so that I can apply what the shopper changed in the chat.
24. As a shop admin, I want to record the deposit and convert the draft to an order in one action, so that stock is held exactly when the deposit arrives.
25. As a shop admin, I want the deposit amount prefilled from my store's deposit percentage, so that I don't compute it by hand.
26. As a shop admin, I want converting to fail if a pair sold out since the draft was made, so that I don't take a deposit for a pair I can't ship.
27. As a shop admin, I want to record a later payment of any amount up to what is outstanding, prefilled with the outstanding, so that I can record the cash-on-delivery rest.
28. As a shop admin, I want two admins recording a payment at the same time never to capture more than the total, so that the books stay right.
29. As a shop admin, I want each recorded payment to update the order's paid total, outstanding amount and payment status, so that the order shows what was received.
30. As a shop admin, I want to see an order's payment collections and payments, so that I know what was recorded and when.
31. As a shop admin, I want to record a refund of money already received, so that the order reflects the deposit I returned.
32. As a shop admin, I want canceling an order with money received to ask how much of it I return (from nothing to all of it, all by default), so that the refund and the cancel are one action and the books show what I kept.
33. As a shop admin, I want to cancel a draft the shop won't fulfil, so that the shopper's link shows it canceled.
34. As a shop admin, I want to delete a draft created by mistake, so that the list stays clean.
35. As a shop admin, I want the order's reference to carry my store's prefix (e.g. «PDJ-1042»), so that it matches what we say in the chat.
36. As a shop admin, I want drafts and orders without an email to work end to end, skipping the confirmation email, so that chat-only shoppers are first-class.
37. As a shop admin, I want to set up a shipping option whose price is calculated by a provider, so that my courier's rules price shipping.
38. As a shop admin, I want geo zones by city and province to be honoured, so that an option can serve only some cities.
39. As a shop admin, I want drafts kept out of the orders list, the customer's order history and order counts, so that only confirmed orders read as orders.
36b. As a shop admin, I want to turn on store-side drafts and manual payment at checkout only when my store sells that way, so that a card-only store offers neither.

### Store developer

40. As a store developer, I want my extension to bring a fulfillment provider that reads my extension's own module, so that my courier's rate table lives beside Proteus, not inside it.
41. As a store developer, I want my extension's providers registered in their module and synced to the database like core's, on Node and on workerd, so that they behave like built-in providers.
42. As a store developer, I want my provider identifiers checked for my extension's prefix, so that a later core provider can't collide.
43. As a store developer, I want my provider's `calculatePrice` to receive the Cart's shipping address and items and to answer an amount or "can't price this", so that I can price by city, weight and value.
44. As a store developer, I want my provider's `validateFulfillmentData` result stored on the shipping method, so that I can keep what the price was based on (e.g. a delivery estimate).
45. As a store developer, I want the store's deposit percentage and reference prefix in the store settings package, so that my store and admin read the same values.
46. As a store developer, I want the order read to expose status, payment status and fulfillment status separately, so that my storefront can word each the way my store speaks.
47. As a store developer, I want the store to turn a Cart into a draft order through one store route, so that my storefront's hand-off is one call.
48. As a store developer, I want the Order's payment collection to be Medusa's, so that I can later let the shopper pay it through a real provider without changing the Order model.
49. As a store developer, I want a draft order created from a Cart to reserve nothing and take no payment, so that abandoned chats never lock stock.
50. As a store developer, I want the payment, fulfillment and draft workflows to run on both workflow engines, so that they behave the same on workerd and on Node.

### Proteus maintainer

51. As a Proteus maintainer, I want draft orders, manual payments and calculated shipping shaped like Medusa's, so that the blueprint keeps following its reference.
52. As a Proteus maintainer, I want the store-side draft creation and the guest lookup recorded as Proteus additions, so that future readers know where Proteus departs from Medusa.
53. As a Proteus maintainer, I want the glossary to name Draft Order, Paid Total and Outstanding Amount, and to keep the three statuses apart, so that the domain language stays precise.
54. As a Proteus maintainer, I want a later job to archive stale drafts noted in the to-do list, so that it isn't forgotten.

## Implementation Decisions

### Extension-owned providers (fulfillment only)

- The extension registry carries fulfillment provider declarations. The fulfillment module's bootstrap merges an
  extension's declarations into its own, so they resolve from the module's container as core's do. The provider
  sync and seed scripts include them, so workerd gets their rows.
- An extension provider may depend on its own extension's module services (the rate table), resolved from the
  shared container like any module service; it may not reach core module internals.
- The generator checks that an extension provider's identifier carries the extension's prefix and doesn't collide
  with core's.
- Payment and notification providers, and providers that need secrets, stay deferred. ADR-0038's "Deferred" list
  narrows to them, and its sentence that an order's charges hook ships with draft orders is replaced: draft orders
  need no hook, because shipping is priced by a fulfillment provider and deposits are payments.

### Calculated shipping (Medusa port)

- Geo-zone matching by country, province, city and postal code is re-enabled with Medusa's rule: a service zone
  serves the address when any of its geo zones matches (a country zone matches the country; a province zone the
  country and province; a city zone those and the city; a postal-code zone those and the postal code). Province,
  city and postal code compare trimmed and case-insensitively.
- The provider port's `calculatePrice` contract, as Medusa: input the option's data, the method's data and a
  context (the Cart, its items with variant weight and dimensions, its shipping address); output the calculated
  amount and whether it includes tax. A provider that can't price the address throws a typed "can't calculate"
  error, and the option is left out.
- The fulfillment module prices calculated options through the provider service. The Cart's shipping-options read
  returns each option's price type and, for a calculated one, its amount.
- Setting a shipping method validates the option against the Cart's address, stores the calculated amount and the
  provider's `validateFulfillmentData` result in the method's data. Cart totals include it.
- When the Cart's items or shipping address change, calculated methods are re-priced or removed if no longer
  available (Medusa's refresh). Cart completion and draft creation copy the method as stored.
- A delivery estimate is the provider's business: it can live in the method's data. No core column.

### Draft orders (Medusa port plus a store addition)

- Order status gains `draft`. Email becomes optional on every Order; the confirmation email is skipped when there
  is none.
- The Order gains the region and sales channel ids, copied from the Cart (Medusa's order carries both), so a draft
  can be priced after the Cart closes. No new tables: a draft's items are Order line items, its address an Order
  address, its shipping an Order shipping method.
- Order line items copy the Cart line's titled options (option title, render-as, value), as Cart lines already
  carry them.
- Order reads expose a reference: the store's optional prefix followed by the display id.
- Drafts are left out of the admin orders list, the customer's order history, order counts and the order placed
  event; the admin has a drafts list of its own.
- **Store addition (not in Medusa), opt-in:** a store route, off unless the store settings enable it, turns a Cart,
  with its shipping address (phone included when given) and shipping method, into a Draft Order, and completes the
  Cart in the same transaction, so the shopper can no longer change it and the storefront starts a new Cart. The
  Cart can't then be checked out. Sending the same Cart again returns its existing draft unchanged (through the
  existing order–cart link), so an admin's edits are never overwritten. Unsellable lines (sold out, deleted variant)
  are refused with the line named. Nothing is reserved; no payment is taken.
- **Admin (Medusa):** list drafts; edit a draft's shipping address (phone included), shipping method (with a custom
  amount) and items. Item edits add a variant priced in the draft's region and sales channel, change a quantity or
  remove a line; a calculated shipping method is re-priced after an item or address edit unless the admin set a
  custom amount. Delete a draft; convert a draft. Converting reserves inventory (failing if a pair sold out), sets
  the status to pending, creates the Order's payment collection and emits order placed.
- **Convert with a payment:** the convert action can record a payment in the same step (the deposit), so a store
  that takes deposits holds stock only once the deposit is paid. Converting without a payment stays possible.
- Cancel accepts drafts as well as pending Orders.

### Manual payments (Medusa's model)

- The system payment provider becomes a real manual payment provider (not test-only). As in Medusa, a Region
  offers it at checkout only when the admin links it to that Region, so a card-only store offers nothing new.
- One payment collection per Order, for its total, created at conversion (or by completing a Cart, as today). The
  first recorded payment opens a manual session and authorizes the collection's amount; every recorded payment
  captures part of it (Medusa's capture with an amount, restored in Proteus). A later store can let the shopper pay
  the same collection through a real provider instead, with no change to the Order.
- Every capture and every refund writes one Order transaction, keyed by the payment-module row it records, so a
  retried workflow step never writes it twice. Paid Total is the sum of the Order's transactions; Outstanding
  Amount is its total minus Paid Total.
- Recording a payment locks the payment collection's row, so two concurrent captures can't exceed the authorized
  amount. An amount above the outstanding is refused.
- The Order's payment status is aggregated from its payment collection and payments as Medusa does (`not_paid`,
  `awaiting`, `authorized`, `partially_authorized`, `partially_captured`, `captured`, `partially_refunded`,
  `refunded`, `canceled`, `requires_action`), independent of its status and fulfillment status. The shared HTTP
  schemas carry the widened payment status.
- The admin order detail returns its payment collection, payments, captures and refunds.
- Canceling an Order with money received asks for the amount to refund, from nothing to all of it (all by default);
  the cancel records that refund, cancels what remains authorized and cancels the Order (Medusa's cancel refunds
  captured payments; Proteus lets the admin choose how much).
- Admin UI: «record payment» on an Order (and on convert) asks for an amount, prefilled with the store's deposit
  share of the total for the first payment when the store has one, and with the outstanding amount afterwards. The
  deposit share is rounded to the currency's precision; nothing else is rounded. Medusa's dashboard only captures
  full amounts; this goes beyond it on purpose.
- Events and feature keys follow the existing payment and order ones (capture, refund, draft converted, draft
  canceled); no new permission keys beyond what the admin draft and payment routes need.

### Guest order status

- The store order read by Order id is readable by anyone with the id (it can't be guessed), drafts included.
- It returns an allowlisted set of fields: status, payment status and fulfillment status separately, the reference,
  the lines with their options, the shipping address's city and province, the shipping methods, and totals with
  Paid Total and Outstanding Amount (today's store reads compute totals without transactions). No email, street or
  full phone.
- A lookup by display id answers the Order id only when the last 4 digits of the shipping address's phone match,
  digits compared after stripping everything but numbers. Wrong digits, no phone and an unknown number answer the
  same 404 from the same single query. Attempt limiting is a to-do, accepted for this MVP.
- A signed-in customer's reads are unchanged.

### Settings

- The store settings package gains an optional deposit percentage (prefills the first recorded payment; no prefill
  when unset), an optional order reference prefix (a bare display id when unset), and a flag that enables store-side
  drafts (off by default). Proteus ships neutral values. The admin reads the package too.

### Schema

- Migrations are regenerated in place, as Proteus does before production, so the widened order status enum and the
  optional email need no hand-written migration.

### Docs

- An ADR for draft orders and manual payments: store-side drafts that close the Cart, converting on a deposit,
  Medusa's single payment collection with partial captures, refund amount at cancel, the public order link and the
  digits lookup, independent statuses, opt-in store drafts, extension fulfillment providers.
- Glossary: **Draft Order** (an Order the shop hasn't confirmed; reserves nothing, holds no payment collection),
  **Paid Total**, **Outstanding Amount**; the **Order** entry no longer says an Order is only a completed Cart or
  that a guest's Order is reached only from the confirmation page, lists the draft status and the widened payment
  status, and keeps its three statuses apart. Order transactions are named so they don't clash with the term
  "transaction" the glossary reserves for the payment module's rows.
- The payment module's README (manual provider, partial captures), the fulfillment module's README (calculated
  options, geo-zone matching), the extensions docs (fulfillment providers).
- To-do: a job that archives drafts older than a set age; attempt limiting on the order lookup.

## Testing Decisions

- Good tests assert behaviour through the highest seam: what the HTTP API answers and what the database holds
  afterwards, never which internal function ran. Each new test is proven by breaking its behaviour once and seeing
  it fail.
- **Main seam: one long HTTP journey** through the existing API test harness (as the cart and order API tests do),
  with a **fixture-extension fulfillment provider** that prices by city from its extension's module, and store
  drafts enabled:
  store Cart → shipping address with phone → calculated options listed for that city (and none for an unserved one)
  → shipping method stored with the provider's price and data → quantity change re-prices it → draft order from the
  Cart (Cart completed, further Cart edits refused) → sent again returns the same draft unchanged → public read by id
  (draft, reference, totals, paid 0, no email) → lookup by display id with the right digits (id) and wrong digits
  (404) → drafts absent from the admin orders list → admin edits the draft (phone, an added item priced in the
  region, custom shipping) → admin converts with a deposit payment (stock reserved, status pending, one collection,
  payment status `partially_captured`, Paid Total and Outstanding Amount) → admin records the rest (`captured`,
  outstanding 0) → a second draft: cancel → a third order with a deposit: cancel refunding part of it
  (`partially_refunded`, canceled).
  The same fixture proves the extension provider is registered and synced.
- **Temporal parity** for the new and changed workflows (draft from Cart, convert with payment, record payment,
  refund, cancel), with the existing parity harness, including a retried capture writing one Order transaction.
- **Refusal tests** beside the journey: the store draft route when disabled, unsellable lines at draft creation,
  converting after a pair sold out, a payment above the outstanding amount, two concurrent payments exceeding the
  total, a refund above what was received, an option that doesn't serve the address.
- **Admin UI**: component tests where the admin already has them (record payment amount prefill, convert with
  payment, refund amount at cancel). No Playwright unless asked.
- **Acceptance**: `pnpm run verify`; the Pisos DJ branch (its extension provider, storefront hand-off and order
  status page) tested end to end against this branch before it merges.
- Prior art: the cart API journey, the order and payment module tests, the extension fixture journey, the Temporal
  parity harness.

## Out of Scope

- One payment collection per recorded payment (Medusa's alternative); Proteus keeps one collection per Order.
- Admin creation of a draft from scratch (Medusa's admin "create draft"); drafts come from store Carts here.
- Order edits after conversion (Medusa's order changes), returns, exchanges, claims.
- Attempt limiting on the digits lookup (to-do).
- Extension payment and notification providers, providers that need secrets, extension permissions and admin
  routes (still deferred by ADR-0038).
- A carrier tracking integration; a delivery estimate column.
- Notifications for status changes (the shop messages the shopper).
- The archive-stale-drafts job (to-do).
- Any store-specific pricing rule, wording or page (forks own them).

## Further Notes

- Reference: Medusa's `OrderStatus` (draft), draft-order workflows and admin routes, `markPaymentCollectionAsPaid`,
  `capturePaymentWorkflow` (capture with an amount; each capture adds an Order transaction), the payment status
  aggregation, the system payment provider, `cancelOrderWorkflow`, `listShippingOptionsForCartWithPricingWorkflow`,
  `addShippingMethodToCartWorkflow`, `refreshCartShippingMethodsWorkflow`, and the fulfillment provider's
  `calculatePrice`. Medusa's dashboard was checked on 15 Nov 2026: its «Capture payment» takes only the full amount.
- Proteus departs from Medusa in four places, recorded in the ADR: drafts created from the store; recording a
  payment while converting; choosing the refund amount at cancel; the guest lookup by number and phone digits.
- One implementation PR, merged only after the Pisos DJ branch has tested the whole flow (hand-off, deposit, rest,
  cancel, order page) against it.
- Decisions recorded with the owner on 15 Nov 2026: payments not stored charges; Medusa's draft status; store-side
  drafts, opt-in, closing the Cart; one payment collection per Order with partial captures (Medusa's model, so a
  real provider can take it later); refund amount chosen at cancel; independent statuses; core guest lookup with
  attempt limiting deferred; optional phone in the Cart, else added by the admin; draft items edited as Order line
  items priced in the copied region; manual payment at checkout only where a Region links it; extension providers
  for fulfillment only; cancel drafts, archive job later; settings in the store settings package; email optional;
  convert on deposit; public order link; one spec and one PR.
