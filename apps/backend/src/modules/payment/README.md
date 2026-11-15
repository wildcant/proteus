# Payment module

The payment module holds the money side of a Cart and an Order: payment collections, the sessions a
shopper or the admin opens against them, the payments those authorize, and the captures and refunds
recorded against each payment. It talks to gateways through the payment provider port
(`core/types/payment/provider.ts`, ADR-0010). It knows nothing about Orders: workflows join a
collection to its Cart or Order through links, and write the Order's side themselves. Why an Order
is paid the way it is, and where that departs from Medusa, is ADR-0039.

## Providers

A provider is registered into the module's private container under `pp_<identifier>_<id>` and has a
row in `payment_provider`. The manual provider is always registered. Stripe and any other gateway
come from `provider-declarations.ts`, which reads the providers `projectConfig` turns on. On Node the
module's loader upserts the rows at boot. workerd skips that, so `scripts/seed-providers.ts` writes
them before a deploy.

A Region offers a provider at checkout only when the admin links the two (the region–payment-provider
link). A provider no Region links is never offered, whatever rows exist.

### The manual provider

`pp_system_default` (`providers/system.ts`) is a real provider, not a test stand-in: it is how a shop
records money it received outside any gateway, such as a bank transfer, cash on delivery or a
deposit agreed in a chat. Authorizing succeeds at once, and capturing and refunding move no money,
because the money already moved and the admin is recording it. A store that takes manual payment at
checkout links it to the Region; a card-only store doesn't, and offers nothing new.

## One collection per Order, paid by partial captures

An Order has one payment collection for its total. Completing a Cart at checkout links the Cart's
collection to the Order; converting a Draft Order creates one. A draft has none.

The admin records a payment against that collection:

1. **The first recorded payment** opens a manual session and authorizes the collection's whole
   amount, then captures the amount recorded (usually a deposit).
2. **Each later payment** captures another part of the same authorized payment, up to what is
   outstanding (usually the rest, cash on delivery).
3. **A refund** is recorded against captured money, up to what was captured and not yet refunded.
   What it returns is outstanding again, on the collection as on the Order. Once the authorization
   is fully captured, recording that amount authorizes a new manual payment for what is outstanding,
   as Medusa collects again through a new session. An authorization still open but holding less
   than the amount asked is not topped up: the capture is refused with what it still holds.

Only a manual authorization is captured this way. A card authorized at checkout and not yet captured
is never captured by recording a payment, which would charge the card as well as take the cash. The
manual authorization opened beside it covers only what the card does not hold, and a payment that
does not fit there is refused until the card's payment is captured or canceled.

Capture takes an amount, as Medusa's does, so the same collection could later be authorized by a
real gateway and captured the same way, with no change to the Order.

### Each capture and refund writes one Order Transaction

The workflow that records a capture or a refund also writes one Order Transaction in the order
module: positive for a capture, negative for a refund, with the payment-module row's kind and id as
its reference. The step looks the reference up before writing, so a retried step (a Temporal retry,
or a replay) never writes a second one for the same row. An Order's Paid Total is the sum of its
Order Transactions and its Outstanding Amount is its total minus that, so both follow what was
recorded here and nothing else.

### Recording a payment locks the collection

Recording a capture locks the payment collection's row for the length of its transaction. Two
admins recording at the same moment run one after the other, and the second sees the first's
capture, so together they can never capture more than was authorized. An amount above the Order's
Outstanding Amount is refused before anything is written, and so is a refund above what was
received.

## Payment status

An Order's payment status is aggregated at read time from its collection and the collection's
payments, captures and refunds, as Medusa aggregates it: `not_paid`, `awaiting`, `authorized`,
`partially_authorized`, `partially_captured`, `captured`, `partially_refunded`, `refunded`,
`canceled` or `requires_action`. A deposit leaves an Order `partially_captured`; the rest makes it
`captured`; a partial refund at cancel leaves it `partially_refunded`. It is independent of the
Order's status and its fulfillment status, and every read returns the three separately.

Canceling an Order cancels the Order, then voids what remains authorized on its collection
(`cancelPaymentCollection`), then records the refund the admin chose (from nothing to all of it).
The void runs under the collection's lock and is refused if a payment was recorded since the cancel
looked, so a refusal comes before any refund and leaves nothing done. The refund goes last because
it has no compensation.
