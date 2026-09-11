---
paths:
  - "apps/backend/src/subscribers/**"
  - "apps/backend/src/core/event-bus/**"
  - "apps/backend/src/workflows/**"
---

# Subscribers and events

`src/subscribers/` holds the work caused by something that happened, off the caller's critical path;
`src/core/event-bus/events.ts` holds the names that work is keyed on. Before adding an event or a
handler, read `standards/rules/backend/subscribers/__docs__/README.md` and the document it routes
you to.
