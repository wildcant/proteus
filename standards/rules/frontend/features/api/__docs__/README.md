# Feature API hooks

`features/{name}/api/{name}.ts` is where a feature talks to the backend, and the only place that
calls the generated API client. One file per resource, holding both how it is read and how it is
written.

| Document | Use case |
|---|---|
| [Query hooks](./query-hooks.md) | **Reading data from the API.** Use when a surface needs to show something the server holds. |
| [Mutation hooks](./mutation-hooks.md) | **Changing data on the API.** Use when something the user does has to create, update or delete a record. |

Reads and writes share one file because they share a `queryKeysFactory` instance. That is what lets
a write invalidate the exact key a read was built from, so the screen refreshes itself instead of
each caller remembering to.

Nothing in this file knows what is rendering it. On top sit
[form hooks](../../hooks/__docs__/form-hooks.md), which call one mutation hook when a form is
submitted, and [data hooks](../../hooks/__docs__/data-hooks.md), which compose several query hooks
into everything a page reads. A component may also call a query hook directly when it is the only
thing that needs the data.
