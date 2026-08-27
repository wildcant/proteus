# Stripe payment provider — parity with the reference implementation

**Status:** ready-for-agent

Reference implementation: `@medusajs/payment-stripe` at `/Users/willo/learn/medusa/medusa-source/packages/modules/providers/payment-stripe`, plus its consumption path in the payment module, core-flows and the webhook subscriber.

---

## Problem Statement

A shopper cannot pay for an order with a card. The Stripe payment provider exists and has the right shape, but no payment can complete end to end:

- **Every charge is wrong or rejected.** Amounts are stored as decimals in the major unit (`19.99`), and they are handed to Stripe unchanged. Stripe requires an integer in the smallest unit, so a total of `19.99` is rejected outright and a total of `20` is charged as twenty cents.
- **No Stripe webhook can be trusted.** The webhook route re-serialises the request body before handing it to the provider for signature verification. Stripe signs the exact bytes it sent, so verification fails for every real event and the store learns nothing about payments that settle out of band.
- **Webhook capture throws even if the first two were fixed.** The amount extracted from a webhook is in the smallest unit and is passed straight into a capture, where it is compared against a Payment recorded in the major unit. The capture is always rejected as exceeding the capturable amount.

Beyond that, roughly half the port is unreachable or unfinished. Three provider methods have no delegate on the provider facade and can never be called. Every write to Stripe goes out without an idempotency key, so a retry after a timeout can double-charge. A cart total that changes after the Payment Session is created never reaches Stripe, so the shopper is charged the stale amount. Account Holders are not implemented at all, yet the saved-payment-method methods read a customer id that nothing ever creates. And a card that transits Stripe's `processing` state fails the whole cart, because that state is mapped to a deferred-authorization status the checkout flow treats as a hard failure.

A developer adding a second payment provider also has no working example to copy, because the one adapter in the repo does not survive contact with the real gateway.

## Solution

Bring the Stripe provider and the payment module wiring around it to behavioural parity with the reference implementation, so that:

- A shopper pays by card and is charged the correct amount, in any currency the store sells in, including currencies with zero or three decimal places.
- A shopper whose bank requires a 3D Secure challenge completes it and the order is created.
- A shopper paying with a method that settles later (bank transfer, voucher, redirect) gets an order immediately, and the Payment is recorded when the funds are confirmed.
- A returning customer can save a card and pay with it next time.
- A merchant captures, partially captures, refunds, partially refunds and cancels payments, and every one of those operations is safe to retry.
- A Stripe webhook is cryptographically verified, is ignored when it belongs to another integration sharing the same Stripe account, and does not race the shopper's own checkout request.
- A developer misconfiguring the provider finds out when the server boots, not when the first shopper tries to pay.

## User Stories

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
19. As a merchant, I want to capture part of an authorization when I ship part of an order, so that partial fulfilment is supported.
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
- A store-facing route exists to drive the update when the cart total changes.
- The two other unreachable provider methods, payment retrieval and status retrieval, are given delegates as well so the port is fully reachable.

### Account Holders and saved payment methods

- The adapter implements Account Holder creation, update and deletion against the gateway's customer concept, carrying email, name, phone and billing address.
- Session creation attaches the Account Holder to the intent when the checkout context carries one, which is the precondition for saving a card at all.
- Saved-method listing goes through the gateway's customer-scoped listing operation with an explicit limit, rather than a generic listing filtered by a possibly-empty customer identifier.
- Saving a method creates a setup intent against the Account Holder; deleting one detaches it.
- A missing Account Holder on a save or list is an error, not an empty-string customer identifier sent to the gateway.
- Account Holders must be created by something. A Customer registering, or a logged-in shopper reaching the payment step, causes an Account Holder to be created and linked, and the checkout context carries it into session creation.
- Store-facing routes are added for listing, saving and deleting a customer's payment methods. These are authenticated and scoped to the requesting Customer.

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
- A partially funded intent reports the amount still outstanding.

Using the nominal amount for all three, as the adapter does today, is wrong wherever partial capture is involved.

### Provider configuration and validation

- The provider takes a configuration object covering, at minimum: API key, webhook secret, whether to capture immediately, automatic payment methods, a gateway-managed payment method configuration identifier, a default charge description, and the asynchronous payment method type list.
- Intent parameters are assembled in **one place** with a fixed precedence: values supplied by the caller, then the provider variant's own defaults, then module options, then hardcoded defaults. This is the reference implementation's most reusable idea and should be reproduced.
- An explicit payment method type list and a gateway-managed payment method configuration are mutually exclusive at the gateway, so supplying the former suppresses the latter.
- The abstract payment provider gains an **optional static validation hook**, invoked by the provider loader at boot. The Stripe adapter uses it to fail on a missing API key and to warn once on a missing webhook secret. The warning is emitted once per process even when several provider variants share one configuration.
- The Payment Session identifier is always injected into the intent's metadata by the module. The adapter treats its absence as a programming error and raises, rather than creating an intent that can never be linked back.

### Webhook deferral

- The webhook route acknowledges the gateway immediately and defers processing, so that a webhook arriving before the shopper's own checkout request does not race it. The deferral interval and retry count are configurable, defaulting to the reference implementation's values.
- Processing is filtered before it begins: an event carrying no Payment Session identifier is dropped, as are the action types the processing path does not act on. Only a confirmed authorization or a confirmed charge causes work.
- Guarding against a null session identifier reaching a query filter is required in the processing path as well as the adapter. An undefined filter value matches every row, which is how a foreign webhook could otherwise resolve to an arbitrary cart. The reference implementation guards this in three places and that redundancy is deliberate.
- **Divergence, accepted:** the reference implementation also takes a distributed lock on the cart for the duration of processing. Proteus has neither an event bus module nor a locking module, and cart completion already carries a `TODO(locking)` for the same gap. This spec does not introduce either as general infrastructure. The deferral is built with the smallest mechanism that gives the delay-and-retry behaviour, and concurrency safety continues to rest on the existing idempotency guard in cart completion. If that guard proves insufficient under a real webhook race, a locking module is the follow-up, not a widening of this spec.

## Testing Decisions

**What makes a good test here.** A test asserts what an actor outside the system can observe: the HTTP response a storefront or gateway receives, the rows the payment module persists (Payment Session status, Payment, Capture, Refund), and the requests that arrive at the vendor boundary. The vendor boundary counts as external behaviour — whether we send Stripe an integer in the smallest unit with a stable idempotency key is precisely the contract under test. A test must never reach for a private method, assert on the shape of an internal call chain, or restate the implementation. Every assertion must be able to fail: mutate the implementation and confirm the test goes red before trusting it.

**Seams.** One architectural seam, plus one pure-function unit.

- **HTTP API tests**, with the vendor SDK faked at the module boundary. This drives route, payment module service, provider facade and adapter together against a real database, which is the highest point that still observes all three blockers — raw-body verification is a route concern, unit conversion is an adapter concern, and idempotency-key threading is a module concern, and only this seam sees all three. It also lands the coverage inside the standard verification gate, which runs the API tests.
- **A pure unit test for the currency conversion helpers**, table-driven across zero-, two- and three-decimal currencies and their rounding rules. These are pure functions rather than an architectural seam, and exercising their edge cases over HTTP would be needlessly indirect.

No provider-level test seam is introduced. Adapter behaviour — status mapping, error classification, retry, webhook parsing — is driven from the API seam by controlling what the faked vendor SDK returns or throws.

**Prior art.**

- Faking a vendor SDK with an in-memory stand-in that records the calls it received, and keeps enough real state for a genuine round trip: the S3 file provider test.
- API tests against a real database with per-test factory data: the cart, order and product API tests.
- Fake provider facade wired into the payment module service for orchestration-level assertions: the existing payment module service test. That test stays as it is; this work does not move it to the new seam.

**Coverage the tests must give.** Correct smallest-unit amount and stable idempotency key reaching the gateway for session creation, update, capture and refund. Each row of the status mapping table. A `processing` intent for a card completing the cart, and for an asynchronous method type creating an order with no Payment. The deferred backfill: a later webhook creating the Payment against an existing order. A verified webhook doing work and an unverified one being rejected with a client error. A webhook with no Payment Session identifier being ignored. Webhook amounts read from the received and capturable fields under partial capture. A capture against a cancelled authorization failing. A retried transient gateway failure succeeding without a second charge. A missing API key failing at boot.

**Fixture discipline.** Every row a test needs is created by that test and disposed with it, using `await using` and the shared factories. No fixture data in `beforeAll` or `afterAll` — the suites run in parallel against one database. Anything globally unique, or listed in the UI, is made unique per test, and assertions select the row the test created rather than the first matching row.

## Out of Scope

- **Storefront integration.** No Stripe.js, payment element, or client-side confirmation is built. The storefront currently has no Stripe code at all, and wiring the checkout UI is separate work that depends on this spec landing first.
- **The seven method-specific provider variants** in the reference implementation (iDEAL, OXXO, BLIK, Giropay, Bancontact, Przelewy24, PromptPay). Only the generic card provider is ported. The provider loader already iterates every service a provider module exports, so the variant pattern drops in later with no infrastructure change.
- **A general-purpose event bus module and a locking module.** See the accepted divergence above. This spec builds the webhook deferral behaviour, not reusable infrastructure for either.
- **A distributed lock around cart completion.** The existing `TODO(locking)` remains open.
- **Admin UI** for saved payment methods or Account Holders. Store-facing routes only.
- **Multi-currency pricing.** The currency conversion helpers must handle any currency correctly, but nothing else about multi-currency selling changes.
- **Migrating the existing payment module service test** to the API seam. It stays where it is.

## Further Notes

- **Two stale documents should be corrected as part of this work.** The payment module spec records amounts as integer cents, which the schema contradicts. The Stripe adapter ticket in that same folder says the authorize step "confirms the PaymentIntent"; neither the reference implementation nor this design confirms — confirmation happens client-side, and authorize only reads back the gateway's truth. Leaving either in place will mislead the next reader.
- **The reference implementation's most transferable idea** is that the provider is a stateless translator with exactly two jobs: map our money and status vocabulary onto the gateway's, and classify errors into retry, store-and-wait, or fatal. Everything stateful — sessions, payments, captures, refunds, idempotency keys, deferral, cart completion — lives in the module and the workflows. The single piece of state the provider owns is the Payment Session identifier round-trip through the gateway's metadata, and the redundant guards around it exist to protect exactly that link.
- **Sequencing.** The three blockers gate everything: raw body first, because nothing downstream is verifiable until webhooks verify; then the unit conversion on both directions; then the status mapping. Idempotency keys, the deferred flow, session updates, error classification and configuration follow. Account Holders and saved cards are the largest single slice and the least coupled to the rest, so they can land last without holding up a working card checkout.
- **Scope note.** This is a large spec, deliberately, because the decision taken was parity with the reference implementation rather than a minimal fix. The blockers alone are a much smaller piece of work if a working card checkout is wanted sooner than full parity.
