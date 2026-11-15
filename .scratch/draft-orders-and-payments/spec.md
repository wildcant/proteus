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
- The admin records **manual payments** of any amount: each recorded payment is its own payment collection marked
  paid, and each writes an Order transaction, so the Order's paid total, outstanding amount and payment status
  (`partially_captured`, then `captured`) follow what was actually received. Refunds are recorded the same way, and
  an Order with money received can only be canceled after it is refunded.
- **Calculated shipping**: shipping options are matched to the Cart's address down to the city, and a calculated
  option is priced by its fulfillment provider from the Cart's address and items, stored on the Cart's shipping
  method, re-priced when the Cart changes, and copied to the Order.
- **Guest order status**: anyone with an Order's link reads it, drafts included, with its status, payment status,
  fulfillment status, paid total and outstanding amount kept separate. A shopper who lost the link finds the Order
  by its number and the last 4 digits of the phone on its shipping address.
- **Extension-owned providers**: an extension can bring a fulfillment provider (and, with the same shape, payment and
  notification providers), registered and synced like core's.

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
8. As a shopper, I want the order I send to keep the same number if I send the Cart again, so that the chat refers to one order.
9. As a shopper, I want the shop to refuse my order if a pair sold out, with the pair named, so that I can remove it and try again.
10. As a shopper, I want to send an order without an email address, so that a chat is enough to buy.
11. As a shopper, I want a link to my order right after sending it, so that I can see what I ordered and what happens next.
12. As a shopper, I want my order's link to work for anyone I share it with, without signing in, so that I don't need an account.
13. As a shopper, I want my order page to show the pairs, their size and colour, quantities, subtotal, shipping, total, what I've paid and what I still owe, so that I know where I stand.
14. As a shopper, I want my order page to show separately whether the shop has confirmed it, whether my payments arrived and whether my order shipped or was delivered, so that each part is clear.
15. As a shopper, I want to find my order with its number and the last 4 digits of my phone when I lost the link, so that I can check it any time.
16. As a shopper, I want a wrong number or wrong digits to answer the same "not found", so that nobody can probe which orders exist.
17. As a shopper, I want my order page to show when it was canceled, so that I know I owe nothing.

### Shop (admin)

18. As a shop admin, I want to see draft orders in a list of their own, so that I can follow the chats that haven't confirmed yet.
19. As a shop admin, I want to open a draft and see its pairs, address, phone, shipping and totals, so that I can confirm it in the chat.
20. As a shop admin, I want to add or change the shopper's phone and address on a draft, so that I can record what the shopper told me in the chat.
21. As a shop admin, I want to set or override a draft's shipping amount, so that I can charge what I agreed in the chat when the Cart had no city.
22. As a shop admin, I want to change a draft's items, so that I can apply what the shopper changed in the chat.
23. As a shop admin, I want to record the deposit and convert the draft to an order in one action, so that stock is held exactly when the deposit arrives.
24. As a shop admin, I want the deposit amount prefilled from my store's deposit percentage, so that I don't compute it by hand.
25. As a shop admin, I want converting to fail if a pair sold out since the draft was made, so that I don't take a deposit for a pair I can't ship.
26. As a shop admin, I want to record a later payment of any amount up to what is outstanding, prefilled with the outstanding, so that I can record the cash-on-delivery rest.
27. As a shop admin, I want each recorded payment to update the order's paid total, outstanding amount and payment status, so that the order shows what was received.
28. As a shop admin, I want to see an order's payment collections and payments, so that I know what was recorded and when.
29. As a shop admin, I want to record a refund of money already received, so that the order reflects the deposit I returned.
30. As a shop admin, I want canceling an order with money received to be refused until I record the refund, so that the books never show money I kept for a canceled order.
31. As a shop admin, I want to cancel a draft the shop won't fulfil, so that the shopper's link shows it canceled.
32. As a shop admin, I want to delete a draft created by mistake, so that the list stays clean.
33. As a shop admin, I want the order's reference to carry my store's prefix (e.g. «PDJ-1042»), so that it matches what we say in the chat.
34. As a shop admin, I want drafts and orders without an email to work end to end, skipping the confirmation email, so that chat-only shoppers are first-class.
35. As a shop admin, I want to set up a shipping option whose price is calculated by a provider, so that my courier's rules price shipping.
36. As a shop admin, I want geo zones by city and province to be honoured, so that an option can serve only some cities.

### Store developer

37. As a store developer, I want my extension to bring a fulfillment provider, so that my courier's rate table lives beside Proteus, not inside it.
38. As a store developer, I want my extension's providers registered in their module and synced to the database like core's, on Node and on workerd, so that they behave like built-in providers.
39. As a store developer, I want my provider identifiers checked for my extension's prefix, so that a later core provider can't collide.
40. As a store developer, I want my provider's `calculatePrice` to receive the Cart's shipping address and items, so that I can price by city, weight and value.
41. As a store developer, I want my provider's `validateFulfillmentData` result stored on the shipping method, so that I can keep what the price was based on (e.g. a delivery estimate).
42. As a store developer, I want the store's deposit percentage and reference prefix in the store settings package, so that my store and admin read the same values.
43. As a store developer, I want the order read to expose status, payment status and fulfillment status separately, so that my storefront can word each the way my store speaks.
44. As a store developer, I want the store to turn a Cart into a draft order through one store route, so that my storefront's hand-off is one call.
45. As a store developer, I want a draft order created from a Cart to reserve nothing and take no payment, so that abandoned chats never lock stock.
46. As a store developer, I want the payment, fulfillment and draft workflows to run on both workflow engines, so that they behave the same on workerd and on Node.

### Proteus maintainer

47. As a Proteus maintainer, I want draft orders, manual payments and calculated shipping shaped like Medusa's, so that the blueprint keeps following its reference.
48. As a Proteus maintainer, I want the store-side draft creation and the guest lookup recorded as Proteus additions, so that future readers know where Proteus departs from Medusa.
49. As a Proteus maintainer, I want the glossary to name Draft Order, Payment Collection, Paid Total and Outstanding Amount, and to keep the three statuses apart, so that the domain language stays precise.
50. As a Proteus maintainer, I want a later job to archive stale drafts noted in the to-do list, so that it isn't forgotten.

## Implementation Decisions

### Extension-owned providers

- The extension registry carries provider declarations per module; fulfillment first, payment and notification
  with the same shape. The module bootstrap merges an extension's declarations into its module's own, so providers
  resolve from that module's container as core's do. The provider sync and seed scripts include them, so workerd gets
  their rows.
- The generator checks that an extension provider's identifier carries the extension's prefix and doesn't collide
  with core's.
- Providers that need secrets stay out of scope (no extension entries in the environment schema).
- Amends ADR-0038's "Deferred" list.

### Calculated shipping (Medusa port)

- Geo-zone matching by country, province, city and postal code is re-enabled (narrowest to broadest, as Medusa).
- The fulfillment module prices calculated options through the provider service, with Medusa's context: the Cart, its
  items (with variant weight and dimensions), its shipping address.
- The Cart's shipping-options read returns each option's price type and, for a calculated one, its calculated
  amount; an option the provider can't price for that address is left out.
- Setting a shipping method validates the option against the Cart's address, stores the calculated amount and the
  provider's `validateFulfillmentData` result in the method's data. Cart totals include it.
- When the Cart's items or shipping address change, calculated methods are re-priced or removed if no longer
  available (Medusa's refresh). Cart completion and draft creation copy the method as stored.
- A delivery estimate is the provider's business: it can live in the method's data. No core column.

### Draft orders (Medusa port plus a store addition)

- Order status gains `draft`. Email becomes optional on every Order; the confirmation email is skipped when there
  is none.
- Order line items copy the Cart line's titled options (option title, render-as, value), as Cart lines already
  carry them.
- Order reads expose a reference: the store's optional prefix followed by the display id.
- **Store addition (not in Medusa):** a store route turns a Cart, with its shipping address (phone included when
  given) and shipping method, into a Draft Order. One draft per Cart through the existing order–cart link; sending
  again refreshes it while it is still a draft, and is refused once it isn't. Unsellable lines (sold out, deleted
  variant) are refused with the line named. Nothing is reserved; no payment is taken.
- **Admin (Medusa):** list drafts; edit a draft's shipping address (phone included), shipping method (with a custom
  amount) and items; delete a draft; convert a draft. Converting reserves inventory (failing if a pair sold out),
  sets the status to pending and emits order placed.
- **Convert with a payment:** the admin action that converts can record a payment in the same step (the deposit),
  so a store that takes deposits holds stock only once the deposit is paid. Converting without a payment stays
  possible.
- Cancel accepts drafts as well as pending Orders.

### Manual payments (Medusa API "option A")

- The system payment provider becomes a real, configurable manual payment provider (not test-only).
- An admin route creates a payment collection for an Order with an amount no greater than its outstanding amount;
  marking a collection paid opens a manual session, authorizes and captures its amount.
- Every capture and every refund writes an Order transaction, so paid total and outstanding amount follow them.
- The Order's payment status is aggregated as Medusa does (`not_paid`, `awaiting`, `authorized`,
  `partially_authorized`, `partially_captured`, `captured`, `partially_refunded`, `refunded`, `canceled`,
  `requires_action`), independent of its status and fulfillment status.
- The admin order detail returns its payment collections and payments.
- Canceling an Order with captured money is refused until a refund is recorded (Medusa's rule).
- Admin UI: «record payment» on an Order (and on convert) asks for an amount, prefilled with the store's deposit
  share of the total for the first payment when the store has one, and with the outstanding amount afterwards; it
  creates the collection and marks it paid in one action. Medusa's dashboard only captures full amounts; this goes
  beyond it on purpose. Partial capture of a single payment is not needed.

### Guest order status

- The store order read by Order id is readable by anyone with the id (it can't be guessed), drafts included.
- It returns status, payment status and fulfillment status separately, the reference, the lines with their options,
  the shipping address city, the shipping methods, and totals with paid total and outstanding amount (today's store
  reads compute totals without transactions).
- A lookup by display id answers the Order id only when the last 4 digits of the shipping address's phone match;
  wrong digits, no phone and an unknown number answer the same 404. No rate limiting in this work.
- A signed-in customer's reads are unchanged.

### Settings

- The store settings package gains an optional deposit percentage (prefills the first recorded payment; no prefill
  when unset) and an optional order reference prefix (a bare display id when unset). Proteus ships neutral values.

### Docs

- An ADR for draft orders and manual payments: store-side drafts, converting on a deposit, one payment collection per recorded payment,
  the public order link and the digits lookup, independent statuses, extension-owned providers.
- Glossary: **Draft Order** (an Order the shop hasn't confirmed; reserves nothing), **Payment Collection** (one per
  recorded payment), **Paid Total**, **Outstanding Amount**; the **Order** entry no longer says an Order is only a
  completed Cart, and keeps its three statuses apart.
- The payment module's README (manual provider), the fulfillment module's README (calculated options), the
  extensions docs (providers).
- To-do: a job that archives drafts older than a set age.

## Testing Decisions

- Good tests assert behaviour through the highest seam: what the HTTP API answers and what the database holds
  afterwards, never which internal function ran. Each new test is proven by breaking its behaviour once and seeing
  it fail.
- **Main seam: one long HTTP journey** through the existing API test harness (as the cart and order API tests do),
  with a **fixture-extension fulfillment provider** that prices by city:
  store Cart → shipping address with phone → calculated options listed for that city (and none for an unserved one)
  → shipping method stored with the provider's price and data → quantity change re-prices it → draft order from the
  Cart → sent again refreshes the same draft → public read by id (draft, reference, totals, paid 0) → lookup by
  display id with the right digits (id) and wrong digits (404) → admin edits the draft (phone, custom shipping) →
  admin converts with a deposit payment (stock reserved, status pending, payment status `partially_captured`, paid
  and outstanding) → admin records the rest (`captured`, outstanding 0) → a second draft: cancel → a third order with
  a deposit: cancel refused, refund recorded (`refunded` / `partially_refunded`), cancel accepted.
  The same fixture proves the extension provider is registered and synced.
- **Temporal parity** for the new and changed workflows (draft from Cart, convert with payment, record payment,
  refund, cancel), with the existing parity harness.
- **Refusal tests** beside the journey: unsellable lines at draft creation, converting after a pair sold out, a
  payment above the outstanding amount, cancel with captured money, an option that doesn't serve the address.
- **Admin UI**: component tests where the admin already has them (record payment amount prefill, convert with
  payment). No Playwright unless asked.
- **Acceptance**: `pnpm run verify`; the Pisos DJ branch (its extension provider, storefront hand-off and order
  status page) tested end to end against this branch before it merges.
- Prior art: the cart API journey, the order and payment module tests, the extension fixture journey, the Temporal
  parity harness.

## Out of Scope

- Partial capture of a single payment (Medusa's option B).
- Admin creation of a draft from scratch (Medusa's admin "create draft"); drafts come from store Carts here.
- Order edits after conversion (Medusa's order changes), returns, exchanges, claims.
- Rate limiting the digits lookup.
- Extension providers that need secrets; extension permissions and admin routes (still deferred by ADR-0038).
- A carrier tracking integration; a delivery estimate column.
- Notifications for status changes (the shop messages the shopper).
- The archive-stale-drafts job (to-do).
- Any store-specific pricing rule, wording or page (forks own them).

## Further Notes

- Reference: Medusa's `OrderStatus` (draft), draft-order workflows and admin routes, `markPaymentCollectionAsPaid`,
  `capturePaymentWorkflow` (each capture adds an Order transaction), the payment status aggregation, the system
  payment provider, `listShippingOptionsForCartWithPricingWorkflow`, `addShippingMethodToCartWorkflow`,
  `refreshCartShippingMethodsWorkflow`, and the fulfillment provider's `calculatePrice`. Medusa's dashboard was
  checked on 15 Nov 2026: its «Capture payment» takes only the full amount.
- Proteus departs from Medusa in three places, recorded in the ADR: drafts created from the store; recording a
  payment while converting; the guest lookup by number and phone digits.
- One implementation PR, merged only after the Pisos DJ branch has tested the whole flow (hand-off, deposit, rest,
  cancel, order page) against it.
- Decisions recorded with the owner on 15 Nov 2026: payments not stored charges; Medusa's draft status; store-side
  drafts; one collection per recorded payment with an amount field; independent statuses; core guest lookup;
  optional phone in the Cart, else added by the admin; cancel drafts, archive job later; settings in the store
  settings package; email optional; convert on deposit; public order link; refund before cancel; one spec and one PR.
