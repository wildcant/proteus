# HTTP schemas

`packages/http-schemas` is the wire contract, written once and read from three sides: the backend
validates against it, `zod-to-openapi` generates the spec from it, and Orval generates both
frontends' clients from that spec. A domain gets four files — `entities.ts`, `payloads.ts`,
`queries.ts`, `responses.ts` — under `src/admin/` or `src/store/`.

| Document | Use case |
|---|---|
| [Schemas](./schemas.md) | **Describing what an endpoint accepts and answers with.** Use when adding or changing any schema — what to name it, what every one of them must do, and the two things that break silently. |
| [Datetime fields](./datetimes.md) | **Putting a timestamp on the wire.** Use when a schema carries a `createdAt`, an expiry, or any date the client reads or filters on. |

The route that spreads these schemas into a handler is
[routes](../../backend/api/__docs__/routes.md), which also owns the two shared response envelopes —
`DeleteResponse` and `WebhookReceivedResponse` — because the rules that check them read the route
file rather than the schema.
