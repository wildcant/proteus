# Notifications

What a notification *is*, separated from what decides to send it.

A file here exports a builder: ids in, a `CreateNotificationDTO` out. It resolves the services it
needs from the container and does its own reads, so a caller needs to know only that something
happened — not how to assemble the body.

## Why this is not a workflow util

`src/workflows/*/utils/` is for pure functions a step feeds already-fetched data to. These builders
do the fetching, which is the part every caller would otherwise repeat.

More importantly they are shared *across* trees. The order confirmation is built by the
`order.placed` subscriber and was built by a checkout step before it; sitting under `src/workflows/`
would mean the subscriber reaches into the workflow tree to send an email, which is backwards. This
directory is owned by neither the workflow engine nor the event bus, so both may import from it and
neither is coupled to the other.

## Sending is the caller's decision

A builder never calls `createNotification`. Who sends, and what happens when the send fails, is the
caller's decision, and the two differ. A subscriber wants the throw: it is what makes the transport
retry, and it is why the order confirmation moved out of checkout, where the payment is authorized
by the time it sends and a throw would compensate the workflow and refund a valid order.

The module makes that decision explicit rather than obvious: a provider that refuses a send comes
back as a row with `status: 'failure'`, not as a rejected promise, so a caller that wants the retry
has to rethrow it. `src/subscribers/send-order-confirmation.ts` is the reference.

## Adding one

One file per notification, named after it (`order-confirmation.ts`). Keep the flat data-shaping
helper beside it when the template needs one; the builder composes the two.
