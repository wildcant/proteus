# Validating the client payment port against Mercado Pago, on paper

**Status:** done, ILLO-23. **No Mercado Pago code exists.** This is the check the spec asks for
before Phase 2 is built: the contract in `apps/store/src/features/checkout/payment/types.ts` was
designed against one real gateway and one read-about one, and the risk it carries is that Bricks
turns out not to fit — with the whole checkout already built on it.

The three claims to test are the ones the spec names. Each is worked through below against the
contract as written, not against the sketch it grew from.

## The contract, as built

```ts
type PaymentAdapterContext = { publicConfig; amount; currencyCode; customer }
type PaymentSessionOpened  = { data: Record<string, unknown>; amount: string; currencyCode: string }
type CreateSession         = (providerData?: Record<string, unknown>) => Promise<PaymentSessionOpened>
type ConfirmArgs           = { chosenMethodId; saveMethod; createSession; returnUrl; contact }
type ConfirmOutcome        = succeeded | processing | redirecting | failed | staleMethod

type StorePaymentAdapter = {
  id
  Root            // wraps the step in the gateway's own context
  NewMethodForm   // the entry form, drawn by whoever draws it
  savedMethods?   // optional
  useConfirm      // returns the callback the place-order press awaits
  useResumeRedirect?  // optional
}
```

## Claim 1 — `useConfirm` calls `createSession({ token, paymentMethodId, issuerId, installments, payerEmail })` from the Brick's `onSubmit`, and reads a terminal status straight out of the returned provider data

**Fits.** `createSession` takes an optional `providerData` blob that the checkout forwards, untyped
and uninspected, as the `data` field of `POST /store/payment-collections/:id/payment-sessions` —
which the backend already passes through to `IPaymentProvider.initiatePayment` as `input.data`.
A card token is exactly the kind of thing that blob exists for. The Stripe adapter passes nothing;
Mercado Pago passes five fields; the checkout is unchanged either way.

`PaymentSessionOpened.data` comes back as the session's provider blob, so a terminal
`status: 'approved' | 'in_process' | 'rejected'` written there by the Phase 2 backend provider is
read by the Phase 2 client adapter and mapped to `succeeded` / `processing` / `failed`. That maps
cleanly onto `ConfirmOutcome` and needs no new variant.

**One thing to know before writing it.** `useConfirm` returns a callback the *checkout's* button
awaits, and the Payment Brick renders its own submit button. Bricks supports this: hide the Brick's
button (`customization.visual.hidePaymentButton: true`) and call the controller's `getFormData()`
from `useConfirm`, which runs the Brick's own validation and returns the tokenised form data. That
is the same two-step the Stripe adapter already performs — validate locally, then open the session
— and it means Mercado Pago's local validation lands in the same place Stripe's `elements.submit()`
does, before anything reaches our server. The contract does not need to change for it; the adapter
holds the controller in a ref set from `NewMethodForm`'s `onReady`.

## Claim 2 — `NewMethodForm` renders the Brick, which draws its own method list

**Fits.** `NewMethodForm` is `FC<{ canSaveMethod: boolean }>` and the checkout renders it inside
`Root` and nothing else. The neutral selector's empty render — the one ILLO-23 builds — is the
adapter's form alone with no radio group around it, which is exactly what a Brick that draws its own
method list needs. Nothing in the checkout enumerates methods; row kind 3 in the spec's layout table
("other methods of the active provider") is drawn by the gateway in both cases.

`canSaveMethod` is ignored by the Phase 2 adapter in its first cut, which is what an optional
capability should cost: nothing.

## Claim 3 — `savedMethods` is absent

**Fits, and this is the property being tested.** `savedMethods` is optional on the adapter, in
exactly the way `listPaymentMethods` / `savePaymentMethod` / `deletePaymentMethod` are optional on
`IPaymentProvider`. The selector branches on `adapter.savedMethods` being present, so a gateway
without a wallet needs no stubs and no empty arrays. The Stripe adapter in ILLO-23 also omits it —
so the absent case is the one under test today, not a path that only Phase 2 will exercise.

## What the validation changed

Two things, both firmed up in ILLO-23 rather than deferred, and both because of this exercise:

1. **`createSession` returns `{ data, amount, currencyCode }`, not a bare blob.** The sketch had it
   return the provider data alone. The server prices the cart at session creation and the browser
   never sends an amount — so the adapter has no other way to learn what is actually being charged,
   and Stripe.js refuses a confirmation whose Elements amount disagrees with the intent's. Mercado
   Pago's adapter ignores `amount` and reads `data`; the field costs it nothing and it is what makes
   "the amount charged equals the cart total at the press" provable.
2. **`contact` moved from `PaymentAdapterContext` to `ConfirmArgs`.** It is what the shopper typed a
   moment ago, so reading it at render time would send the value from before their last edit. Stripe
   needs it for the billing details it is told never to collect; Mercado Pago needs it for
   `payerEmail`. Both want it at submit, not at mount.

## What is still unknown

- **Whether Bricks' `getFormData()` is a sufficient local-validation seam** in the same sense
  `elements.submit()` is — i.e. whether it reliably surfaces field errors without submitting.
  Read from the docs, not exercised. If it turns out not to be, the adapter validates by other
  means; the contract is unaffected either way, because local validation is entirely inside
  `useConfirm`.
- **Installments.** Mercado Pago's Brick collects an installment count that changes what the shopper
  pays in total. Nothing in this contract carries it back to the checkout for display, and nothing
  in Proteus's cart totals could show it if it did. That is a Phase 2 product question, not a port
  question — but it is the most likely place Phase 2 finds it needs something new.
