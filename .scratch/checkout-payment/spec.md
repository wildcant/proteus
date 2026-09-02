# Card checkout — payment provider port and storefront payment selector

**Status:** ready-for-agent

**Phase:** 1 of 2. Phase 2 (Mercado Pago) is out of scope here; this spec's job is to make Phase 2 an adapter, not a rewrite.

Reference implementation: `@medusajs/payment-stripe` at `/Users/willo/learn/medusa/medusa-source/packages/modules/providers/payment-stripe`, plus its consumption path in the payment module, core-flows and the webhook subscriber.

Other reference material read for this spec:

- `MISSION.md` and `learning-records/0001`–`0005` in the `accept-a-payment` workbench — the requirement source and the decisions already taken there (Payment Intents over Checkout Sessions; Elements options stay on the client).
- `accept-a-payment` `server/server.js`, `server/db.js`, `client/src/{Payment,CheckoutForm,PaymentMethodsSelector,PaymentResult,Completion,paymentErrors,money}.{jsx,js}` — the patterns to port.
- `@medusajs/payment-stripe` `src/core/stripe-base.ts` and the Medusa storefront's `payment-container` / `payment-wrapper` — the provider-port shape Proteus already copied.
- Proteus: `docs/adr/0010-payment-provider-driven-port.md`, `apps/backend/src/modules/payment/**`, `apps/backend/src/providers/payment-stripe/stripe-provider.ts`, `apps/backend/src/api/store/payment-providers/route.ts`, `apps/backend/src/api/hooks/payment/[provider]/route.ts`, `apps/backend/src/workflows/cart/complete-cart.ts`, `apps/store/src/features/checkout/**`, `.scratch/guest-checkout/spec.md`.
- The storefront layout reference: a Shopify checkout payment step, attached to issue ILLO-18. See *Layout and visual reference*.

---

## Problem Statement

A shopper cannot pay for a Proteus order with a card, and the storefront has no code that could let them. The failures are in two layers, and fixing either alone changes nothing observable.

**The gateway boundary does not work.** The Stripe payment provider exists and has the right shape, but no payment can complete end to end:

- **Every charge is wrong or rejected.** Amounts are stored as decimals in the major unit (`19.99`), and they are handed to Stripe unchanged — `stripe-provider.ts:58` passes the major-unit decimal straight to `paymentIntents.create`. Stripe requires an integer in the smallest unit, so a total of `19.99` is rejected outright and a total of `20` is charged as twenty cents.
- **No Stripe webhook can be trusted.** `api/hooks/payment/[provider]/route.ts:27` re-serialises the parsed request body before handing it to the provider for signature verification. Stripe signs the exact bytes it sent, so verification fails for every real event and the store learns nothing about payments that settle out of band.
- **Webhook capture throws even if the first two were fixed.** The amount extracted from a webhook is in the smallest unit and is passed straight into a capture, where it is compared against a Payment recorded in the major unit. The capture is always rejected as exceeding the capturable amount.

Beyond that, roughly half the port is unreachable or unfinished. Three provider methods have no delegate on the provider facade and can never be called. Every write to Stripe goes out without an idempotency key, so a retry after a timeout can double-charge. A cart total that changes after the Payment Session is created never reaches Stripe, so the shopper is charged the stale amount. Account Holders are not implemented at all, yet the saved-payment-method methods read a customer id that nothing ever creates. And a card that transits Stripe's `processing` state fails the whole cart, because that state is mapped to a deferred-authorization status the checkout flow treats as a hard failure.

A developer adding a second payment provider also has no working example to copy, because the one adapter in the repo does not survive contact with the real gateway.

**The storefront has no payment surface.** `apps/store/src/features/checkout/components/payment/payment-form.tsx` renders a radio group of provider ids and nothing else — no Stripe.js, no Payment Element, no card entry, no confirmation step. `useCheckoutForm` places an order by calling `updateCart` then `completeCart`, so the shopper is never asked for payment details and `completeCart` authorizes a PaymentIntent that has never been confirmed.

**The intent is created at the wrong moment.** `payment-form.tsx:43` creates the payment collection and session the instant the shopper touches the radio button. A PaymentIntent therefore exists — priced at whatever the cart totalled then — before the shopper has entered a card, chosen shipping that changes the total, or decided to buy at all. That is the exact drift `MISSION.md` names as a success criterion to prevent, and it is a step worse than the Stripe sample's intent-on-page-load, because the amount is frozen earlier in the flow.

**There is no notion of a returning customer's wallet.** `IPaymentProvider` declares `listPaymentMethods`, `savePaymentMethod` and `deletePaymentMethod` optional; the Stripe adapter's implementations read an account-holder id nothing creates; no store-facing route exposes any of them. A logged-in shopper cannot save a card, see one, choose one, or remove one. The three states the mission is built around — guest, authenticated, authenticated with saved cards — collapse into one.

**Nothing is provider-shaped on the client.** Adding Mercado Pago later means writing a second checkout, not a second adapter.

## Goal

A shopper can pay for a Proteus order by card, in a form the store designed, in all three customer states, with no PaymentIntent existing before "Place order" is pressed — and the storefront's payment step is structured so that adding Mercado Pago is one adapter plus one registry entry.

## Solution

### What must become true

Bring the Stripe provider and the payment module wiring around it to behavioural parity with the reference implementation, and build the storefront half on top of it, so that:

- A shopper pays by card and is charged the correct amount, in any currency the store sells in, including currencies with zero or three decimal places.
- A shopper whose bank requires a 3D Secure challenge completes it and the order is created.
- A shopper paying with a method that settles later (bank transfer, voucher, redirect) gets an order immediately, and the Payment is recorded when the funds are confirmed.
- A returning customer can save a card and pay with it next time.
- A merchant captures, refunds, partially refunds and cancels payments, and every one of those operations is safe to retry.
- A Stripe webhook is cryptographically verified, is ignored when it belongs to another integration sharing the same Stripe account, and does not race the shopper's own checkout request.
- A developer misconfiguring the provider finds out when the server boots, not when the first shopper tries to pay.

### The four pieces, in dependency order

**1. The gateway boundary.** Unit conversion, raw-body verification, idempotency, status mapping, Account Holders, error classification — specified under *Implementation Decisions* below. Nothing above this layer is verifiable until it lands.

**2. A client-side payment-provider port, mirroring ADR 0010's server-side one.** The storefront gains a `StorePaymentAdapter` contract and a registry keyed by provider id. The checkout knows about *adapters*, never about Stripe. The contract's central idea is the same opaque-data pattern the backend already uses: the checkout owns the call to our own API and hands the adapter a `createSession` callback; the adapter interprets the provider data blob that comes back and owns the confirmation sequence, because Stripe's and Mercado Pago's sequences genuinely differ and no shared "give me a client secret" abstraction can cover both.

**3. A provider-neutral payment method selector**, laid out to the supplied reference. Ported from `accept-a-payment`'s `PaymentMethodsSelector`: saved methods as rows, expiry computed client-side, remove behind an inline confirmation, and the Payment Element's own accordion styled so the whole thing reads as one flat list.

**4. The wallet**, at two surfaces: inline in checkout, and at `/account/payment-methods`.

### The submit sequence

This is the load-bearing change and the one that reshapes existing code.

1. Shopper presses **Place order**. Nothing has been created at Stripe yet.
2. The adapter validates locally — for Stripe, `elements.submit()`. A validation error stops here and never reaches our server.
3. The checkout POSTs to create the payment collection and session. **The server prices the cart itself**; the browser sends no amount. The session's provider data blob comes back.
4. The adapter confirms. Stripe: `stripe.confirmPayment({ clientSecret, elements | payment_method, redirect: 'if_required' })`.
5. On an in-place success or a `processing` result, the checkout calls `completeCart`, which authorizes the session and creates the order exactly as it does today.
6. On a redirect method, the tab leaves. `return_url` lands on a checkout return route that resumes at step 5.

`complete-cart.ts` needs no surgery: its `validate-cart-payments` step already requires a session to exist, and `authorize-payment` already runs last. What changes is *when* the session is created — moved from radio-select to submit — and that the cart total is re-read server-side at that moment.

### Why the adapter owns confirmation

Stripe returns a client secret and the browser confirms against Stripe. Mercado Pago's Payment Brick hands you a `formData` containing a card token, which your server exchanges for a payment and returns a terminal status — the browser never confirms anything. A port that assumed either shape would need rewriting for the other. A port whose only contract is *"here is a function that creates a session and returns its opaque data; give me back a terminal outcome"* fits both, and matches how the backend port already works.

## User Stories

Stories 1–40 are the gateway and payment-module half. Stories 41–73 are the storefront and wallet half.

**Gateway and payment module**

1. As a shopper, I want the amount Stripe charges me to equal the total I saw at checkout, so that I am not silently overcharged or undercharged by a factor of a hundred.
2. As a shopper buying in a zero-decimal currency such as yen, I want the correct amount charged, so that a ¥1000 order does not become ¥100000.
3. As a shopper buying in a three-decimal currency such as Kuwaiti dinar, I want the amount rounded the way the gateway requires, so that my payment is not rejected for invalid precision.
4. As a shopper, I want my card charged exactly once even if the checkout request times out and is retried, so that I am not double-charged.
5. As a shopper, I want a declined card to tell me the payment failed rather than leaving my cart in an unclear state, so that I can try another card.
6. As a shopper whose bank requires a 3D Secure challenge, I want to be sent to the challenge and returned to a completed order, so that I can buy from banks that mandate strong authentication.
7. As a shopper whose card briefly sits in the gateway's processing state, I want my order to complete normally, so that a transient gateway state does not lose me my basket.
8. As a shopper paying by bank transfer or voucher, I want an order confirmation immediately, so that I know what to pay against before the funds have moved.
9. As a shopper paying by bank transfer, I want the order to show as paid once the funds arrive, so that I do not have to contact support to confirm receipt.
10. As a shopper who changed my basket after choosing a payment method, I want to be charged the new total, so that I am not billed for items I removed.
11. As a shopper who switched payment method during checkout, I want the abandoned attempt cancelled at the gateway, so that no authorization is left sitting against my card.
12. As a shopper, I want the payment attempt to be cancelled at the gateway if order creation fails after the charge, so that my money is not held against an order that does not exist.
13. As a returning customer, I want to save my card at checkout, so that I do not retype it next time.
14. As a returning customer, I want to see the cards I have saved, so that I can choose one to pay with.
15. As a returning customer, I want to remove a saved card, so that I control what the store keeps on file.
16. As a returning customer, I want my saved cards to belong to me and not leak between accounts, so that my payment details stay private.
17. As a guest shopper, I want checkout to work without any saved-card machinery, so that the feature does not block anonymous purchases.
18. As a merchant, I want to capture an authorized payment when I ship, so that I only take money for goods I actually send.
19. ~~As a merchant, I want to capture part of an authorization when I ship part of an order, so that partial fulfilment is supported.~~ **Withdrawn: partial capture is not supported.** See *Partial capture* under *Out of Scope*. Struck in place rather than deleted, so that every story keeps the number it was given.
20. As a merchant, I want to refund a captured payment in full or in part, so that I can resolve returns and disputes.
21. As a merchant, I want to cancel an authorization I will not fulfil, so that the shopper's funds are released.
22. As a merchant, I want a capture that the gateway has already performed to be recognised as successful rather than reported as an error, so that duplicate webhooks do not create false failures.
23. As a merchant, I want a capture attempted against a cancelled authorization to fail loudly, so that my books never record money that was never taken.
24. As a merchant, I want to configure whether payments are captured immediately or authorized then captured later, so that the flow matches how my business ships.
25. As a merchant, I want to choose which payment methods are offered, either explicitly or through a gateway-managed configuration, so that I can enable local methods without a code change.
26. As a merchant, I want a description on the charge, so that my shoppers recognise the line on their bank statement.
27. As a merchant, I want to mark a payment collection as paid manually, so that offline payments can be reconciled without a gateway.
28. As a merchant, I want the payment status shown in the admin to reflect what the gateway actually believes, so that I am not shipping against a payment that never settled.
29. As an on-call engineer, I want webhooks from other integrations sharing our Stripe account to be ignored, so that a foreign event cannot complete an unrelated cart.
30. As an on-call engineer, I want webhook signatures verified against the exact bytes the gateway sent, so that a forged webhook cannot mark an order as paid.
31. As an on-call engineer, I want a webhook that arrives before the shopper's own checkout request to not race it, so that we do not create duplicate orders or double captures.
32. As an on-call engineer, I want the gateway's transient failures retried automatically and its ambiguous failures left for reconciliation, so that a blip in the gateway does not lose a sale or invent a failed one.
33. As an on-call engineer, I want a card error to leave a record of the failed attempt on the Payment Session, so that I can reconcile it against the gateway later.
34. As an on-call engineer, I want errors from the gateway surfaced as the application's own error type, so that they are logged and reported consistently with everything else.
35. As a developer, I want the provider to reject an incomplete configuration when the server boots, so that a missing API key is not discovered by a shopper.
36. As a developer, I want a warning when the webhook secret is absent, so that I understand why webhook-dependent flows silently do nothing.
37. As a developer, I want every method on the payment provider port to be reachable from the module, so that implementing the port is not partly wasted effort.
38. As a developer, I want the Stripe adapter to be a working example of the driven port, so that adding another gateway is a matter of copying a known-good pattern.
39. As a developer, I want the amount unit used across the payment module to be stated once and enforced at the gateway boundary, so that nobody has to guess whether a number is dollars or cents.
40. As a developer, I want the tests to run in the standard verification gate, so that a regression in payments is caught before review.

**Guest**

41. As a guest, I want to pay by card without an account, so that I am not forced to register to buy.
42. As a guest, I want no card of mine stored anywhere, so that a one-off purchase leaves nothing behind.
43. As a guest, I want not to be offered a "save this card" option, so that the checkout does not promise something it cannot do.

**Authenticated, nothing saved**

44. As a logged-in shopper with no saved cards, I want the card form to be the whole payment step rather than one option in a list of one, so that the UI does not invent a choice.
45. As a logged-in shopper, I want to choose whether my card is saved, so that saving is a decision I make and not a default.
46. As a logged-in shopper who saves a card, I want it available next time, so that the second purchase is faster than the first.

**Authenticated with saved cards**

47. As a returning customer, I want my saved cards listed in the store's own UI, so that the payment step looks like the rest of the site.
48. As a returning customer, I want a usable card pre-selected, so that paying again is one press.
49. As a returning customer, I want an expired card shown as expired and not selectable, so that I do not press Pay on a card that cannot work.
50. As a returning customer, I want to remove a saved card, with a confirmation step, so that I control what the store keeps and do not lose one by a misclick.
51. As a returning customer, I want to pay with any saved card I choose, so that the selector is real and not decorative.
52. As a returning customer, I want to enter a different card without losing my saved ones, so that a one-off purchase on another card is possible.
53. As a returning customer, I want my saved cards to be mine alone, so that no other account can list, charge or delete them.
54. As a returning customer whose saved card was removed on another device, I want to be told and shown the refreshed list, so that I am not pressing Pay against a card that no longer exists.
55. As a returning customer, I want to nominate a default card, so that the card I pay with most is the one already selected.

**The wallet outside checkout**

56. As a returning customer, I want to manage my saved cards from my account, so that I do not have to start a checkout to remove one.
57. As a returning customer, I want the account wallet and the checkout selector to show the same cards in the same order, so that the two do not disagree.

**Amounts and correctness**

58. As a shopper, I want the amount charged to equal the total I saw, so that changing my cart late cannot bill me for the old basket.
59. As a shopper, I want no payment attempt to exist at the gateway until I press Place order, so that abandoning checkout leaves no trace.
60. As a shopper, I want to be charged once even if I double-press or the request is retried, so that I am not double-charged.

**Failure**

61. As a shopper whose card is declined, I want to be told it was declined and to try another, so that I can recover without contacting support.
62. As a shopper whose bank asks for 3D Secure, I want to complete the challenge and return to a placed order, so that strong authentication does not lose my basket.
63. As a shopper paying by a redirect method, I want to come back to a completed order rather than an empty checkout, so that leaving the tab is not fatal.
64. As a shopper, I want a payment failure never to leave me unsure whether I was charged, so that I do not pay twice out of doubt.
65. As an on-call engineer, I want the decline code, request id and gateway log link in the log for every failure, so that I can diagnose a payment the shopper could only describe vaguely.
66. As a shopper, I want a lost or stolen card decline to read the same as a generic one, so that the store is not a card-testing oracle.

**Design system**

67. As the store owner, I want the payment form to use my typography, spacing and colour, so that the payment step is not visibly a third party's.
68. As the store owner, I want saved cards, the card form, and any other payment method to read as one list, so that the step does not look like two components bolted together.
69. As the store owner, I want to control which fields the payment form collects, so that it does not re-ask for an address the checkout already has.
70. As a shopper, I want the card networks a method accepts shown on its row, so that I can tell at a glance whether my card will work.

**Extensibility**

71. As a developer, I want the checkout to depend on a payment adapter contract rather than on Stripe, so that adding Mercado Pago is one adapter and one registry entry.
72. As a developer, I want the saved-method selector to be provider-neutral, so that a second provider with saved methods reuses it rather than forking it.
73. As a developer, I want a second provider to need no change to the checkout form, the place-order sequence, or the cart completion workflow, so that the abstraction is load-bearing rather than aspirational.

## Layout and visual reference

A Shopify checkout payment step, attached to issue ILLO-18, is the layout and style reference. Read it for structure and treatment, not for its method list — which methods Proteus offers is a Stripe Dashboard concern, and nobody should build a Klarna integration off a screenshot.

### Anatomy

1. A section head: a compact uppercase title with a one-line trust subhead beneath it.
2. **One bordered list.** Every payment choice is a sibling row in it. There is no nested list anywhere.
3. A row is: radio on the left, label, then brand marks right-aligned — real network artwork, plus a `+N` chip when more are accepted than fit.
4. The selected row carries a full ink border, and its panel opens directly beneath it on a subtle fill.
5. The panel holds white inputs with hairline borders, with expiry and security code sharing one two-column row.
6. A billing-address checkbox sits inside the panel.
7. A legal line sits beneath the whole list.
8. A save-for-next-time block sits below that.

### Mapping onto Proteus

Proteus has four kinds of row to place in that one list, which the reference does not have to solve because Shopify's card form is not a third-party iframe. **One flat list, four row kinds, one row style**, in this order:

| Order | Row kind                             | Source                                         |
| ----- | ------------------------------------ | ---------------------------------------------- |
| 1     | Saved card                           | `GET /store/payment-methods`, one row each     |
| 2     | Use a different card                 | opens the active adapter's `NewMethodForm`     |
| 3     | Other methods of the active provider | the Payment Element's own accordion items      |
| 4     | Other providers                      | `GET /store/payment-providers`, Phase 2 onward |

Rows 3 and 4 look identical to rows 1 and 2 but are not ours to render: row 3 lives inside a cross-origin iframe. Making it match is the Appearance API's job, and it is the single hardest visual requirement in this spec. `accept-a-payment` already does exactly this — `.AccordionItem` is written as the twin of `.pm-row`, `.RadioIconOuter` / `.RadioIconInner` as the twins of the store's own radio SVG — and that pairing is what gets ported. The reference image is the target to match it against.

### Style decisions, and where they diverge from `accept-a-payment`

- **Brand marks are real artwork**, not the nominative text chips (`VISA`, `MC`, `AMEX`) `accept-a-payment` chose. They go in `packages/icons`, which already generates React components from SVG assets. The `+N` overflow chip is a bordered neutral box, matching the reference.
- **The panel carries a subtle fill**, and inputs are white on it. `accept-a-payment` used white on white with borders alone.
- **Selection is a full ink border on the row.** Inside an opened panel, the Payment Element's `--selected` accordion state is deliberately *not* given a second heavy border — the row and panel already draw one envelope, and a second stacks black rectangles. Carried over from `accept-a-payment`'s appearance config, which documents this.
- **The billing checkbox is rendered by Stripe, not by us.** `syncAddressCheckbox: 'billing'` on the Elements options produces the reference's "Use shipping address as billing address" inside the panel, and it is bound to the existing `billingSameAsShipping` field in `useCheckoutForm`. Do not render a second toggle: Proteus's checkout already has one, and two controls over one value is a bug waiting for someone to change one of them.
- **"Name on card" is collected.** `fields.billingDetails.name` stays `'auto'`; the address stays `'if_required'`, since the checkout already collected it.
- **The save-consent block sits inside the card panel, not below the list.** This is a deliberate divergence: the reference's bottom block is a Shop-account signup, which is a different thing. A save toggle sitting under a list where a non-card method is selected means nothing.
- **The legal line is a checkout-level slot** beneath the payment section, not part of the selector. It is not provider-specific and must not move when a provider is added.
- Tokens come from the existing `@proteus/ui` theme. Neither the CSS nor the Appearance config writes a colour literal that the other also writes.

## Implementation Decisions

### Amounts and the unit boundary

- The payment module continues to represent money in the **major unit** as an arbitrary-precision decimal, consistent with the rest of the codebase (pricing, cart totals, order totals, and the storefront's currency formatting).
- Conversion to and from the gateway's smallest unit happens **only inside the Stripe adapter**, at the boundary where a value crosses into or out of the vendor SDK. No other layer knows Stripe's unit.
- Two helpers are introduced alongside the adapter: one converting a major-unit decimal to a smallest-unit integer for a given currency, and its inverse. They encode the zero-decimal currency list, the standard two-decimal default, and the three-decimal currencies whose smallest-unit amounts must be rounded to a multiple of ten. Rounding for the three-decimal case rounds up, matching the reference implementation.
- Conversion applies on the way in for session creation, session update and refund; and on the way out for every amount extracted from a webhook event.
- The existing payment module spec states that amounts are integer cents. That statement is stale — the schema uses decimal columns. This spec supersedes it, and the older spec should be corrected rather than left to mislead.

### Raw request body for signature verification

- The HTTP layer gains the ability to carry the **unmodified request body bytes** from the platform adapter through to a route handler, alongside the parsed body. This is a new capability on the request port, and it must survive every platform adapter the router supports.
- The webhook route passes those bytes to the provider unchanged. Re-serialising the parsed body is not acceptable, because the gateway signs the exact bytes it sent and its payloads are not byte-identical to a re-serialisation.
- Signature verification stays inside the adapter, as required by the driven-port ADR — provider-specific verification must not leak into the route.
- A webhook whose signature does not verify is answered with a client error, not a server error, so the gateway does not retry a payload that will never verify.

### Status mapping and asynchronous payment methods

The adapter maps gateway intent states onto Payment Session statuses as follows. This corrects two mappings that currently diverge from the reference implementation.

| Gateway intent state | Payment Session status |
|---|---|
| requires payment method, with a last payment error | error |
| requires payment method, no error | pending |
| requires confirmation | pending |
| processing, method type listed as asynchronous | pending authorization |
| processing, any other method type | pending |
| requires action | requires more |
| requires capture | authorized |
| succeeded | captured |
| canceled | canceled |
| anything else | pending |

- A new provider option lists the payment method types whose `processing` state means "will settle later" rather than "settling now". When the option is absent, no method is treated as asynchronous and `processing` maps to pending.
- Determining the method type requires the intent's payment method to be expanded when it is retrieved from the gateway, and retrieved separately when a webhook delivers it as a bare identifier.

### Deferred authorization flow

Matching the reference implementation end to end, not only in the status mapping.

- The payment module's authorize operation is given a sharper contract. It returns **no Payment** only when authorization is genuinely deferred. A declined or incomplete authorization now **raises an error** instead of returning nothing. Today both cases return nothing, which is why the checkout workflow cannot tell them apart.
- The cart completion workflow treats a deferred authorization as success: the order is created with no Payment record, and the workflow's compensation logic accounts for there being nothing to reverse.
- When the gateway later confirms the funds, the webhook path authorizes the Payment Session against the already-existing order, which creates the Payment record and reconciles the order's ledger.
- The webhook path must distinguish four situations, as the reference implementation does: a Payment already exists and should be captured; no Payment exists and the gateway reports a completed charge, so the session is authorized and then captured; no cart is linked, so the session is simply authorized; and an order already exists without a Payment, so the session is authorized to backfill it.

### Idempotency

- Every write to the gateway carries an idempotency key supplied by the payment module. The adapter does not invent keys.
- Keys are durable row identifiers that exist **before** the gateway call, so that a retry after a crash presents the same key: the Payment Session id for session creation, authorization and cancellation; the Capture id for a capture; the Refund id for a refund.
- This requires the module to thread a context through to the provider facade on the capture, refund and cancel paths, which today pass no context at all.

### Payment Session updates

- The provider facade gains a session-update delegate, and the module gains the corresponding operation, so that the provider's update method becomes reachable. It is currently unreachable code.
- Updating a session with an unchanged amount does not call the gateway.
- An update returns the full provider data blob, preserving the client secret the storefront needs. Returning a partial blob would strand the storefront mid-checkout.
- A store-facing route exists to drive the update when the cart total changes. With deferred session creation there is normally nothing to update — the session is created at the moment of submit, at the total it will be charged at, priced server-side. The update path stays, because the redirect return and retry paths can still find a session that predates a cart change, but it stops being the primary defence against charging a stale total. **Server-side pricing at creation is that defence.** See *Deferred session creation*.
- The two other unreachable provider methods, payment retrieval and status retrieval, are given delegates as well so the port is fully reachable.

### Account Holders and saved payment methods

- The adapter implements Account Holder creation, update and deletion against the gateway's customer concept, carrying email, name, phone and billing address.
- Session creation attaches the Account Holder to the intent when the checkout context carries one, which is the precondition for saving a card at all.
- Saved-method listing goes through the gateway's customer-scoped listing operation with an explicit limit **and an explicit `allow_redisplay: 'always'` filter**, rather than a generic listing filtered by a possibly-empty customer identifier. The reference implementation applies a limit and no `allow_redisplay` filter, which lists methods the shopper never consented to redisplay. Setting `allow_redisplay` at confirmation is the other half of the same rule — see *Saved payment methods — backend*.
- A method is saved as a side effect of a payment the shopper consented to save, via `setup_future_usage` on the intent against the Account Holder — not by a separate setup intent, since a SetupIntent flow is out of scope. Deleting a method detaches it.
- A missing Account Holder on a save or list is an error, not an empty-string customer identifier sent to the gateway.
- Account Holders must be created by something, and **creation is gated on `hasAccount`**. Proteus's guest checkout creates a Customer row with `hasAccount: false` for every guest, so the existence of a Customer record is not the trigger — an authenticated shopper (`hasAccount: true`) reaching the payment step causes an Account Holder to be created and linked, and the checkout context carries it into session creation. A guest never causes one to exist. See *Account Holders and the three states*.
- Store-facing routes are added for listing and deleting a customer's payment methods, and for nominating the default. Creation is not a route. These are authenticated and scoped to the requesting Customer, which is necessary and **not sufficient**: ownership is additionally verified at the gateway on every saved-method read and write. The route list is enumerated in *Saved payment methods — backend*, which is authoritative.

### Error classification

The adapter classifies gateway failures rather than rethrowing them, following the reference implementation's three buckets:

- **Retry** — connection and rate-limit errors. The operation is retried with exponential backoff and jitter, up to a small bounded number of attempts. This is safe precisely because the idempotency key is stable across attempts.
- **Store and wait** — a card error that nonetheless produced an intent stores that intent on the session so it can be reconciled; a gateway API error is treated as indeterminate and stores a marker rather than assuming failure, because the charge may have succeeded.
- **Fatal** — anything else is raised, which causes the module to tear down the half-created session.

All raised errors are the application's own error type with an appropriate category, not raw vendor errors, so that error handling and logging stay consistent with the rest of the backend.

Two correctness fixes fall out of this work: a capture that fails because the intent is in an unexpected state is only treated as success when the intent actually succeeded, and the cancel path stops making a pre-flight retrieval and instead handles the already-cancelled error, removing both a round trip and a time-of-check race.

### Webhook amount extraction

- A completed charge reports the amount actually received, not the intent's nominal amount.
- An authorization reports the capturable amount, not the intent's nominal amount.

Using the nominal amount for both, as the adapter does today, works only by coincidence: with full captures only, a succeeded intent's received amount equals its nominal one. Read the field that means what is being asked, so nothing depends on the two agreeing — they stop agreeing the moment the gateway is configured for overcapture or multicapture, and it fails silently when they do.

### Provider configuration and validation

- The provider takes a configuration object covering, at minimum: API key, webhook secret, whether to capture immediately, automatic payment methods, a gateway-managed payment method configuration identifier, a default charge description, and the asynchronous payment method type list.
- Intent parameters are assembled in **one place** with a fixed precedence: values supplied by the caller, then the provider variant's own defaults, then module options, then hardcoded defaults. This is the reference implementation's most reusable idea and should be reproduced.
- An explicit payment method type list and a gateway-managed payment method configuration are mutually exclusive at the gateway, so supplying the former suppresses the latter.
- The abstract payment provider gains an **optional static validation hook**, invoked by the provider loader at boot. The Stripe adapter uses it to fail on a missing API key and to warn once on a missing webhook secret. The warning is emitted once per process even when several provider variants share one configuration.
- The Payment Session identifier is always injected into the intent's metadata by the module. The adapter treats its absence as a programming error and raises, rather than creating an intent that can never be linked back.
- The client-safe subset of this configuration is served to the storefront rather than duplicated into a storefront environment variable — see *Provider public configuration*.

### Webhook deferral

- The webhook route acknowledges the gateway immediately and defers processing, so that a webhook arriving before the shopper's own checkout request does not race it. The deferral interval and retry count are configurable, defaulting to the reference implementation's values.
- Processing is filtered before it begins: an event carrying no Payment Session identifier is dropped, as are the action types the processing path does not act on. Only a confirmed authorization or a confirmed charge causes work.
- Guarding against a null session identifier reaching a query filter is required in the processing path as well as the adapter. An undefined filter value matches every row, which is how a foreign webhook could otherwise resolve to an arbitrary cart. The reference implementation guards this in three places and that redundancy is deliberate.
- **Divergence, accepted:** the reference implementation also takes a distributed lock on the cart for the duration of processing. Proteus has neither an event bus module nor a locking module, and cart completion already carries a `TODO(locking)` for the same gap. This spec does not introduce either as general infrastructure. The deferral is built with the smallest mechanism that gives the delay-and-retry behaviour, and concurrency safety continues to rest on the existing idempotency guard in cart completion. If that guard proves insufficient under a real webhook race, a locking module is the follow-up, not a widening of this spec.

### Deferred session creation

The payment session is created inside the place-order sequence, not on provider selection. `payment-form.tsx:43`'s `createPaymentSession` call moves out of `onValueChange`; selecting a provider becomes pure form state.

This is a deliberate divergence from the Medusa storefront, which creates a session on selection because `stripe-wrapper.tsx` needs `paymentSession.data.client_secret` before `<Elements>` can mount. Proteus mounts Elements in deferred mode instead: `mode: 'payment'` with `amount` and `currency` from the cart and no client secret, exactly as `accept-a-payment`'s `Payment.jsx` does. This is why the deferred flow is possible at all, and it is the single largest structural difference from the reference storefront.

The amount passed to `<Elements>` is a display and eligibility input only. **The amount charged is priced server-side at session creation**; the browser never sends an amount. `accept-a-payment` learned this the expensive way — a hardcoded `AMOUNT = 1400` on the button over a server charging `2800` — and its fix (one server-owned total) is the pattern being ported.

### The client payment-provider port

A new `apps/store/src/features/checkout/payment/` area, holding the contract, the registry, the neutral selector, and one adapter per provider. Sketch, to be firmed up in the tickets:

```ts
type PaymentAdapterContext = {
  publicConfig: Record<string, unknown>   // from GET /store/payment-providers
  amount: number
  currencyCode: string
  customer: { id: string; hasAccount: boolean } | null
}

type SavedMethod = {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  isDefault: boolean
}

type ConfirmOutcome =
  | { kind: 'succeeded'; reference: string }
  | { kind: 'processing'; reference: string }
  | { kind: 'redirecting' }                       // the tab is leaving; render nothing
  | { kind: 'failed'; customerMessage: string }   // already sanitised for display
  | { kind: 'staleMethod' }                       // the chosen saved method is gone

type StorePaymentAdapter = {
  id: string
  Root: FC<{ context: PaymentAdapterContext; children: ReactNode }>
  NewMethodForm: FC<{ canSaveMethod: boolean }>
  savedMethods?: {
    useList: () => { methods: SavedMethod[]; isLoading: boolean; failed: boolean; refetch: () => void }
    remove: (id: string) => Promise<void>
    setDefault: (id: string) => Promise<void>
  }
  useConfirm: () => (args: {
    chosenMethodId: string | null       // null means "new method"
    saveMethod: boolean
    createSession: (providerData?: Record<string, unknown>) => Promise<Record<string, unknown>>
    returnUrl: string
  }) => Promise<ConfirmOutcome>
}
```

Three properties this buys, each a requirement rather than a nicety:

- `createSession` is injected, so the adapter never talks to our API. Deferred creation is therefore a property of the checkout and cannot be broken by an adapter.
- `ConfirmOutcome.customerMessage` is already sanitised, so the sanitising rule lives inside the adapter that knows the gateway's error vocabulary, and the checkout cannot accidentally render a raw gateway string.
- `savedMethods` is optional in exactly the way `IPaymentProvider`'s method operations are, so a provider without a wallet needs no stubs.

**Validation against Mercado Pago, on paper, before we build it.** The Phase 2 adapter's `useConfirm` calls `createSession({ token, paymentMethodId, issuerId, installments, payerEmail })` from the Payment Brick's `onSubmit` and reads a terminal status straight out of the returned provider data — no client-side confirmation step. Its `NewMethodForm` renders the Brick, which draws its own method list. Its `savedMethods` is absent in the first cut. If any of those three cannot be expressed in the contract above, the contract is wrong and this is when we find out. No Mercado Pago code is written.

### Provider public configuration

`GET /store/payment-providers` currently returns `{ id, label, isTestOnly, isEnabled }`. It gains a `publicConfig` object per provider, carrying the values the client adapter needs to boot — Stripe's publishable key, later Mercado Pago's public key and locale.

The storefront already fetches this route at the payment step, so `publicConfig` is a field on a call it makes anyway, not a new round-trip — which is the whole of learning record `0002`'s objection to `accept-a-payment`'s `GET /config`. What it buys is that enabling a provider is a backend concern end to end: Phase 2 needs no storefront environment variable, no rebuild, and no second place where "which providers exist" is written down.

`publicConfig` is a publishable-key-shaped surface and must be treated as one: it is assembled from an explicit allowlist per provider, never by spreading the provider's options object. A secret reaching it is a leak, and the test for that is a required assertion, not a code-review hope.

### The selector

Ported from `PaymentMethodsSelector.jsx`, made provider-neutral, laid out per *Layout and visual reference*. Behaviour that is specified, not incidental:

- **Three renders, one component.** Loading: skeleton rows. Empty (guest, or account with nothing saved): the adapter's `NewMethodForm` alone, with no radio group — a one-option radio group invents a choice that does not exist. Populated: rows plus a "use a different card" row that opens the form.
- **Auto-select once.** The customer's default card if they have one, otherwise the first non-expired saved method, selected on first load and never again — so a later refetch cannot move a selection the shopper made. `accept-a-payment` guards this with an `autoSelected` ref; port the guard, not just the behaviour.
- **Expiry is ours to compute.** Stripe lists expired cards; expiry is the issuer's business, not the gateway's. Expired rows are shown, labelled, and not selectable. "Expires this month" is labelled and selectable.
- **Remove is a two-step inline confirmation**, and the Remove control is a sibling of the selectable `<label>`, not nested inside it — a button inside a label fires the label's control on every click.
- **Removal is optimistic against a completed detach.** The row is dropped from local state rather than the whole list refetched, and if the removed method was selected, selection moves to the next usable one.
- **A failed wallet load is not fatal.** The selector falls back to the new-method form with a notice. A shopper who cannot see their saved cards can still pay.

### Saved payment methods — backend

Store-facing routes, all authenticated and all scoped to the requesting customer:

- `GET /store/payment-methods` — the requesting customer's saved methods, projected to the neutral `SavedMethod` shape. Never the raw gateway object.
- `DELETE /store/payment-methods/:id` — detach.
- `POST /store/payment-methods/:id/default` — nominate the default.

Creation is not a route. A method is saved as a side effect of a payment the shopper consented to save, via `setup_future_usage`.

**Ownership is verified at the gateway on every read and every write**, using `stripe.customers.retrievePaymentMethod(customerId, methodId)`, which 404s unless the method belongs to that customer. This is a required deviation from `@medusajs/payment-stripe`, whose `deletePaymentMethod` detaches whatever id it is handed with no ownership check at all. Note what Stripe does with the two failure modes: `resource_missing` for a method that does not exist, and an uncoded 404 for one that exists but belongs to someone else — it declines to confirm that another customer's payment method is real. Both collapse to the same answer for us, which is fine, because both mean "refresh the wallet".

**The default is stored at the gateway**, on the Stripe Customer's `invoice_settings.default_payment_method`. It needs no Proteus table and no migration, and it is the field Stripe itself treats as the default. `IPaymentProvider` gains an optional `setDefaultPaymentMethod`, alongside the existing optional method operations, so a provider without the concept needs no stub.

**`allow_redisplay` is set and filtered on, explicitly.** Listing filters `allow_redisplay: 'always'`; confirmation sets `payment_method_data.allow_redisplay` to `'always'` when the shopper consented and `'unspecified'` when they did not. Medusa's provider does neither, which is why a card can be attached to a customer and invisible to a selector. Setting it is its own API call after attach on the current API version.

**Editing a saved method is deliberately excluded.** No `updatePaymentMethod` on the port. Changing billing details on a stored card is a Stripe operation but not one the mission asks for, and adding it now would widen the port that Phase 2 has to implement. Removing and re-adding covers it. *This is the one part of question 3 the answer did not settle — flagged rather than assumed silently. Say if you want it in and it becomes one more port method plus a form.*

### The account wallet

`/account/payment-methods`, under the existing `_main/_authed/account/` area, alongside addresses and orders.

- Same routes, same `SavedMethod` projection, same row component as the checkout selector — the rows are extracted so both surfaces render one implementation. Two lists of cards that could disagree is the failure mode this avoids.
- List, remove, set default. No card entry: adding a card outside a purchase means a SetupIntent flow, which is its own feature and is out of scope.
- Empty state points at checkout: a card is saved by paying with it.
- Ordering is the same as the selector — default first, then most recent — so the two surfaces cannot present a different idea of "your cards".

### Account Holders and the three states

Proteus's guest checkout creates a Customer row with `hasAccount: false` for every guest, so "guest" here does not mean "no customer record". The rule is drawn at the account boundary, not the record boundary:

| State                           | Account Holder                       | Wallet      | Save option | `allow_redisplay` |
| ------------------------------- | ------------------------------------ | ----------- | ----------- | ----------------- |
| Guest (`hasAccount: false`)     | never created                        | not offered | hidden      | `unspecified`     |
| Authenticated, empty wallet     | created on reaching the payment step | empty       | shown       | per consent       |
| Authenticated, populated wallet | exists                               | listed      | shown       | per consent       |

An Account Holder is created lazily and idempotently — on first need, reusing the stored external id if one exists, exactly as `ensureCustomer` does in `accept-a-payment`. Nothing at the gateway is created for a guest, satisfying "guests leave no trace" in the sense that matters: no Stripe Customer, no stored method, nothing redisplayable.

The save option is gated on **the session, not the wallet count** — a logged-in shopper with an empty wallet still needs it to save their first card. This is a real bug the reference implementation calls out; do not gate on `savedMethods.length`.

### Error handling: the asymmetry

Ported wholesale from `paymentErrors.js`, as two pure functions with their own unit tests, because the rule is easier to verify when it is not tangled up in a component.

- **The shopper is told a bucket.** `generic_decline`, `do_not_honor`, `call_issuer`, `transaction_not_allowed`, `fraudulent`, `lost_card`, `stolen_card` and `merchant_blacklist` all produce one identical string. The subtlety that makes this correct: the *target* must be in the set too. Overriding only the four sensitive codes does not merge the buckets, it swaps which one is the odd one out, and a prober separates them exactly as before. Stripe.js rewrites decline messages in the browser and does so non-uniformly, so this cannot be delegated to the SDK.
- `payment_intent_authentication_failure` arrives as an `invalid_request_error`, not the `card_error` you would expect. Branching on `type` alone tells a shopper who fumbled a 3DS challenge that something unexpected happened. Branch on code before type.
- Actionable `decline_code`s — `insufficient_funds`, `expired_card`, `incorrect_cvc`, `processing_error` — pass Stripe's own localised message through. It is better copy than anything we would hardcode.
- Everything else — `api_error`, `api_connection_error`, `authentication_error`, `rate_limit_error`, `idempotency_error`, `invalid_request_error` — is our problem and produces one generic string.
- **The log keeps everything**: `type`, `code`, `decline_code`, and `request_log_url`, which opens the exact request in the Stripe dashboard.

Server-side the same rule inverts and the field names change, which is its own trap: browser `StripeError` is a plain object with the eight types on `.type`; server `stripe-node` errors are real `Error` subclasses with the eight types on `.rawType` and `.type` holding the class name. `if (e.type === 'card_error')` on the server compiles, runs, and silently never matches.

Server responses carry a **code, never a gateway message**. Two real strings this endpoint would otherwise forward are `"Invalid API Key provided: sk_test_*****dkey"` and `"No such PaymentMethod: 'pm_…'"`. Status codes carry what the body must not: `409 payment_method_unavailable` for a stale or foreign method (the client refetches the wallet and resets to a new card), `503` for transient gateway failures, `500` otherwise.

### Result and return paths

`redirect: 'if_required'` splits success permanently in two, and which branch a shopper takes is a property of their country rather than of their order. Both must render the same component or the redirect path rots while every local test passes.

- In-place: `confirmPayment` resolves with a PaymentIntent, the checkout calls `completeCart`, the shopper lands on the existing order confirmation route.
- Redirect: `return_url` is a checkout return route that reads `payment_intent_client_secret` from the query string, retrieves the intent, and resumes at `completeCart`.

Neither path writes anything down about money. The order is created by `completeCart`; payment truth arrives by webhook. The browser updates the UI and nothing else.

## Testing Decisions

**What makes a good test here.** A test asserts what an actor outside the system can observe: what the shopper sees and can press, the HTTP response a storefront or gateway receives, the rows the payment module persists (Payment Session status, Payment, Capture, Refund), and the requests that arrive at the vendor boundary. The vendor boundary counts as external behaviour — whether we send Stripe an integer in the smallest unit with a stable idempotency key, and the right `allow_redisplay`, is precisely the contract under test. A test must never reach for a private method, assert on the shape of an internal call chain, or restate the implementation. Every assertion must be able to fail: mutate the implementation and confirm the test goes red before trusting it.

### Seams — gateway and payment module

One architectural seam, plus one pure-function unit.

- **HTTP API tests**, with the vendor SDK faked at the module boundary. This drives route, payment module service, provider facade and adapter together against a real database, which is the highest point that still observes all three blockers — raw-body verification is a route concern, unit conversion is an adapter concern, and idempotency-key threading is a module concern, and only this seam sees all three. It also lands the coverage inside the standard verification gate, which runs the API tests.
- **A pure unit test for the currency conversion helpers**, table-driven across zero-, two- and three-decimal currencies and their rounding rules. These are pure functions rather than an architectural seam, and exercising their edge cases over HTTP would be needlessly indirect.

No provider-level test seam is introduced. Adapter behaviour — status mapping, error classification, retry, webhook parsing — is driven from the API seam by controlling what the faked vendor SDK returns or throws.

**Prior art.**

- Faking a vendor SDK with an in-memory stand-in that records the calls it received, and keeps enough real state for a genuine round trip: the S3 file provider test.
- API tests against a real database with per-test factory data: the cart, order and product API tests.
- Fake provider facade wired into the payment module service for orchestration-level assertions: the existing payment module service test. That test stays as it is; this work does not move it to the new seam.

**Coverage the tests must give.** Correct smallest-unit amount and stable idempotency key reaching the gateway for session creation, update, capture and refund. Each row of the status mapping table. A `processing` intent for a card completing the cart, and for an asynchronous method type creating an order with no Payment. The deferred backfill: a later webhook creating the Payment against an existing order. A verified webhook doing work and an unverified one being rejected with a client error. A webhook with no Payment Session identifier being ignored. Webhook amounts read from the received and capturable fields rather than the intent's nominal amount. A capture against a cancelled authorization failing. A retried transient gateway failure succeeding without a second charge. A missing API key failing at boot.

### Seams — storefront and wallet

- **Playwright specs in `apps/store`**, one per customer state, against a faked gateway. This is the only seam that can observe the deferred-creation guarantee, the three selector renders, and the shopper-visible failure copy together. The repo's existing discipline applies in full: no fixture data in `beforeAll`/`afterAll`, `await using` for lifetimes, factories from `factories.create.*`, per-test unique names, and never `.first()` — select the row the test created.
- **Backend HTTP API tests** for the payment-method routes: ownership enforcement across two customers on all three verbs, the neutral projection, `409` on a foreign or stale method, and that `publicConfig` contains only allowlisted keys.
- **Pure unit tests** for the two error functions and the expiry calculation. These are pure functions, not architectural seams; exercising their edge cases through a browser would be needlessly indirect.

**Coverage the tests must give.**

- No PaymentIntent is created before Place order is pressed, in every state. This is the headline guarantee and it needs a direct assertion against the faked gateway's call log, not an inference from the UI.
- Each of the three states renders the selector correctly, including that an account with an empty wallet gets no radio group.
- A saved card is charged; the id sent to the gateway is the one the shopper selected.
- An expired card is labelled and not selectable; auto-selection skips it and prefers the default.
- Removal confirms, detaches, drops the row, and moves the selection.
- Setting a default changes what auto-selects on the next checkout, and the account page and the selector agree on order.
- Customer A cannot list, charge, delete or set-default customer B's method — asserted at the API seam, all verbs.
- A stale method produces `409`, the wallet refetches, and the selection resets to the new-method form with an explanatory message.
- Save-consent on produces `setup_future_usage` and `allow_redisplay: 'always'`; consent off produces neither; a guest gets neither and no Stripe Customer is created.
- A decline shows the bucket string and logs the `decline_code`; `lost_card` and `generic_decline` are indistinguishable on screen and distinguishable in the log.
- The cart total changing between mount and submit charges the new total.
- The redirect return path completes the cart.
- `publicConfig` carries no secret. Asserted against the response body, per provider.

**Fixture discipline.** Every row a test needs is created by that test and disposed with it, using `await using` and the shared factories. No fixture data in `beforeAll` or `afterAll` — the suites run in parallel against one database. Anything globally unique, or listed in the UI, is made unique per test, and assertions select the row the test created rather than the first matching row.

## Out of Scope

- **Mercado Pago, entirely.** The client port is validated against Bricks on paper; no Mercado Pago code, adapter, backend provider, or dependency is added. Phase 2.
- **Adding a card outside a purchase.** A SetupIntent flow on the account page is its own feature.
- **Editing a saved method.** See *Saved payment methods — backend*; flagged, not assumed.
- **The seven method-specific provider variants** in the reference implementation (iDEAL, OXXO, BLIK, Giropay, Bancontact, Przelewy24, PromptPay). Only the generic card provider is ported. The provider loader already iterates every service a provider module exports, so the variant pattern drops in later with no infrastructure change.
- **The methods shown in the reference image** — PayPal, Klarna, Afterpay, Cash App Pay, Sezzle. The image is a layout reference. Which methods are offered is Dashboard configuration.
- **Link, Apple Pay and Google Pay.** `wallets.link: 'never'`; the express-checkout surface is separate work.
- **Subscriptions, recurring billing, off-session charges.** `MISSION.md` excludes them.
- **Tax, shipping and discounts as Stripe features.** Settled in learning record `0004`: Payment Intents was chosen with hand-built arithmetic as the accepted cost.
- **A general-purpose event bus module and a locking module.** See the accepted divergence in *Webhook deferral*. This spec builds the webhook deferral behaviour, not reusable infrastructure for either.
- **A distributed lock around cart completion.** The existing `TODO(locking)` remains open.
- **Admin UI** for saved payment methods or Account Holders. Store-facing routes only.
- **Partial capture.** Captures are all-or-nothing. Two independent reasons, either of which is enough. The adapter cannot do it: `capturePayment` calls Stripe with no `amount_to_capture`, so the whole intent is charged whatever the module recorded — capturing 40 of a 100 authorization takes 100 from the shopper and writes a Capture row of 40. And there is nothing to capture partially against: `create-order-fulfillment` rejects any order that is not `unfulfilled` and then marks it `fulfilled`, so an order is fulfilled exactly once. The admin capture route therefore rejects a body carrying `amount` rather than ignoring it, and `CreateCaptureDTO` has no field to express one. Partial *refunds* are unaffected and stay — they work against what was captured, and Stripe supports them natively.
- **Multi-currency pricing.** The currency conversion helpers must handle any currency correctly, but nothing else about multi-currency selling changes. **Known defect, deferred to whoever owns multi-currency:** the three-decimal round trip is lossy upward. Stripe accepts a three-decimal amount only as a multiple of ten, so `toSmallestUnit` rounds up — a 19.995 KWD total is sent as `20000` and read back as `20.000`. The shopper is charged 0.005 KWD more than the order total while the Payment row records the lower figure. Not reachable today: multi-currency pricing is out of scope and no three-decimal currency is sold. Two candidate fixes, so the decision is not re-derived from scratch — round the stored total to what the gateway can actually charge, or reject a total the currency cannot represent. Rounding down is not among them: it would charge a fraction less than the shopper agreed to.
- **Migrating the existing payment module service test** to the API seam. It stays where it is.

## Constraints

- `IPaymentProvider` and ADR 0010's opaque-data contract are load-bearing and stay. The client port mirrors them rather than inventing a second philosophy.
- Repo conventions apply without exception: `camelCase` throughout (the Stripe SDK's `snake_case` parameters need the existing per-line Biome suppression), `type` over `interface`, no `any`, no non-null assertions, guard clauses over nesting, comments that say why.
- The verification gate — `npm run verify` — must pass. Lint warnings fail there.
- Money is a major-unit decimal everywhere above the adapter. The smallest-unit boundary is inside the adapter and nowhere else.
- Amounts are never accepted from the browser.
- Tailwind v4 canonical classes; tokens from `@proteus/ui`, not literals.

## Risks

- **The client port is being designed against one real provider and one read-about provider.** If Bricks does not fit the contract, we find out in Phase 2 with the checkout already built on it. Mitigation: the on-paper validation is a required deliverable of the port ticket, not a note.
- **Matching an iframe to a screenshot is the hardest visual requirement here.** The Payment Element's accordion rows must be indistinguishable from ours, through an API that exposes a fixed set of rules. Some divergence will be irreducible; the tickets should say which gaps are accepted rather than leaving them to be rediscovered.
- **The Appearance config and the store's CSS are twins that can silently drift.** Sourcing both from `@proteus/ui` tokens narrows it; it does not close it.
- **Deferred creation moves a server round-trip inside the Place order press.** The shopper waits on our server, then on Stripe, after committing. Budget the perceived latency and keep the button state honest.
- **Two success paths, one of which no card can reach.** The redirect path breaks in one country while passing every local test. It must be tested with a redirect method, not assumed.
- **This spec is large, deliberately.** It was already large before the fold; the fold makes it one document rather than two. The backend blockers gate everything and should be staged first, so a working card checkout is reachable before the wallet lands.

## Acceptance Criteria

1. In every customer state, no PaymentIntent exists at the gateway until Place order is pressed. Asserted directly against the faked gateway.
2. A guest completes a card payment. No Stripe Customer is created, no method is saved, and no save option is shown.
3. A logged-in shopper with an empty wallet sees the card form as the whole payment step, with a save option, and no radio group.
4. A logged-in shopper who consents has their card saved and available on the next checkout.
5. A returning customer sees their saved cards in the store's own markup, with the default — or the first usable card — pre-selected, and pays with a chosen one.
6. An expired saved card is shown, labelled expired, not selectable, and skipped by auto-selection.
7. A saved card is removed through an inline confirmation; the row disappears and the selection moves to the next usable card.
8. A customer sets a default from `/account/payment-methods`, and the next checkout pre-selects it.
9. `/account/payment-methods` and the checkout selector list the same cards in the same order, rendered by one row component.
10. Customer A cannot list, charge, delete or set-default customer B's saved methods. Asserted at the API seam for every verb.
11. A stale or foreign method id returns `409`, the wallet refetches, and the selection resets to the new-method form with an explanatory message.
12. The amount charged equals the cart total at the moment Place order was pressed, including when the cart changed after the payment step was rendered.
13. A declined card shows the bucket message; `lost_card` and `generic_decline` are identical on screen and distinct in the log, and every failure logs `decline_code` and `request_log_url`.
14. A 3D Secure challenge completes and the order is placed.
15. A redirect payment method returns to the checkout return route and the order is placed.
16. The payment step matches the supplied reference: one flat bordered list, ink-bordered selection with a filled panel, right-aligned network artwork with a `+N` chip, the billing checkbox inside the panel, and the Payment Element's accordion rows visually indistinguishable from ours. Accepted divergences are recorded in the ticket, not discovered in review.
17. `publicConfig` carries only allowlisted, publishable values. Asserted per provider.
18. The checkout imports no Stripe symbol outside `apps/store/src/features/checkout/payment/adapters/stripe/`. Enforced by a dependency-cruiser rule, so the abstraction cannot rot.
19. `.scratch/checkout-payment/spec.md` exists and `.scratch/payment-stripe/` is gone.
20. `npm run verify` passes and the Playwright specs pass.

## Further Notes

- **This document absorbed `.scratch/payment-stripe/spec.md`, which is removed.** That spec covered the gateway and payment-module half only, and listed storefront integration as out of scope. Two specs both claiming the Account Holder surface is the drift the fold exists to prevent: one spec, one stage graph. Decided 2026-09-01, alongside the two other decisions now stated in the body: provider public configuration is backend-served on `GET /store/payment-providers` (*Provider public configuration*), and `/account/payment-methods` is in scope alongside checkout-inline management (*The account wallet*). Where its decisions were sharpened rather than moved, the sharpened text is in the section it belongs to, not in an appendix — session creation moving to submit (*Payment Session updates*), Account Holder creation gated on `hasAccount` and gateway-verified ownership and explicit `allow_redisplay` (*Account Holders and saved payment methods*), and the client-safe configuration subset (*Provider configuration and validation*).
- **Two stale documents should be corrected as part of this work.** The payment module spec records amounts as integer cents, which the schema contradicts. The Stripe adapter ticket in that same folder says the authorize step "confirms the PaymentIntent"; neither the reference implementation nor this design confirms — confirmation happens client-side, and authorize only reads back the gateway's truth. Leaving either in place will mislead the next reader.
- **The reference implementation's most transferable idea** is that the provider is a stateless translator with exactly two jobs: map our money and status vocabulary onto the gateway's, and classify errors into retry, store-and-wait, or fatal. Everything stateful — sessions, payments, captures, refunds, idempotency keys, deferral, cart completion — lives in the module and the workflows. The single piece of state the provider owns is the Payment Session identifier round-trip through the gateway's metadata, and the redundant guards around it exist to protect exactly that link.
- **Sequencing.** The three blockers gate everything: raw body first, because nothing downstream is verifiable until webhooks verify; then the unit conversion on both directions; then the status mapping. Idempotency keys, the deferred flow, session updates, error classification and configuration follow. Account Holders and saved cards are the largest single slice and the least coupled to the rest, so they can land last without holding up a working card checkout. The storefront half follows the four pieces in *Solution*, which depend on the gateway boundary landing first.
- **Scope note.** This is a large spec, deliberately, because the decision taken was parity with the reference implementation rather than a minimal fix. The blockers alone are a much smaller piece of work if a working card checkout is wanted sooner than full parity.
