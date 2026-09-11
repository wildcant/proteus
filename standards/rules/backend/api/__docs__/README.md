# API routes

`src/api/` is the HTTP surface: file-based routes under `admin/`, `store/`, `auth/` and `hooks/`,
each wired to its schemas and auth by a `definitions.ts` beside it.

| Document | Use case |
|---|---|
| [Routes](./routes.md) | **Adding or changing an endpoint.** Use when you are writing the handler and the definition that exposes it. |
| [Route helpers](./route-helpers.md) | **Placing the logic a handler grew.** Use when a handler is long enough that you want to extract something out of it. |

Every endpoint needs the first; the second is the answer to "where does this go instead of here",
and the rules behind it fire while you are still in the file the first one describes.
