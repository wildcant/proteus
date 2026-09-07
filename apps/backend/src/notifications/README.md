# Notifications

What a notification *is*, separated from what decides to send it.

A file here exports a builder: ids in, a `CreateNotificationDTO` out. It resolves the services it
needs from the container and does its own reads, so a caller needs to know only that something
happened — not how to assemble the body.

## Why this is not a workflow util

`src/workflows/*/utils/` is for pure functions a step feeds already-fetched data to. These builders
do the fetching, which is the part every caller would otherwise repeat.

More importantly they are shared *across* trees. The order confirmation is built by a checkout step
today and by an `order.placed` subscriber next; sitting under `src/workflows/` would mean the
subscriber reaches into the workflow tree to send an email, which is backwards. This directory is
owned by neither the workflow engine nor the event bus, so both may import from it and neither is
coupled to the other.

## Sending is the caller's decision

A builder never calls `createNotification`. Who sends, and what happens when the send fails, differs
by caller: checkout swallows the failure because the payment is already authorized by the time it
sends, and throwing there would compensate the workflow and refund a valid order. A subscriber wants
the opposite — the throw is what makes the transport retry.

## Adding one

One file per notification, named after it (`order-confirmation.ts`). Keep the flat data-shaping
helper beside it when the template needs one; the builder composes the two.
