# Subscribers and events

`src/subscribers/` holds the work caused by something that happened, off the caller's critical path;
`src/core/event-bus/events.ts` holds the names that work is keyed on.

| Document | Use case |
|---|---|
| [Events](./events.md) | **Announcing that something happened.** Use when you are adding a name to the event map and choosing where it is published from. |
| [Subscribers](./subscribers.md) | **Doing work because something happened.** Use when you are writing the handler, including the case where the event already exists. |

An event is added because a subscriber wants it, so a new one is usually both at once; a second
handler for an existing event is the second document alone. `standards/rules/backend/subscribers/`
holds no rules — what is checked here is checked by the type system, the generator and one
dependency-cruiser rule, and each document's `## Enforcement` says which.
