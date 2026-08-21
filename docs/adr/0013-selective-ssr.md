# 13. Selective SSR for the Store App

**Status:** Accepted

## Context

The store app uses TanStack Start deployed on Cloudflare Workers. Auth tokens and cart IDs are stored in `localStorage`, a client-only API. Enabling SSR globally caused a fundamental mismatch: the server cannot access `localStorage`, so `beforeLoad` auth guards, cart queries, and any client-state-dependent logic failed or produced incorrect results during SSR.

Full SPA mode (no SSR) would avoid these issues entirely but sacrifices SEO for public pages like product listings and product detail.

## Decision

Use TanStack Start's selective SSR: SSR is disabled globally via `defaultSsr: false`, then re-enabled per route with `ssr: true` only where SEO matters.

## Key configuration

**`src/start.ts`** — the export must be named `startInstance` (the server handler reads this exact property name):

```ts
export const startInstance = createStart(() => ({
  defaultSsr: false,
}))
```

**Layout routes** in the SSR ancestry chain (`__root__`, `_main`) must have `ssr: true`. Without this, the server has no `<Outlet />` to render SSR children into — the response degrades to a shell regardless of child route settings.

**Leaf routes** opt in individually:

```ts
export const Route = createFileRoute('/_main/products/')({
  ssr: true,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(productsListQueryOptions())
  },
  headers: () => ({
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
  }),
  staleTime: 30_000,
})
```

## Route SSR map

| Route | SSR | Why |
|---|---|---|
| `__root__` | `true` | Required — provides the HTML document shell and `<Outlet />` for children |
| `_main` | `true` | Required — layout parent of SSR routes (Nav, Footer) |
| `products/` | `true` | SEO — crawlable product listing |
| `products/$productId` | `true` | SEO — crawlable product detail |
| `_authed/*` | `false` (default) | Auth-gated, no SEO value, depends on `localStorage` |
| `cart`, `checkout` | `false` (default) | User-specific, cart ID in `localStorage` |
| `login`, `register` | `false` (default) | No SEO value |

## Consequences

- **SEO routes** get full server-rendered HTML with ISR caching. Loaders run on the server and `ensureQueryData` populates the React Query cache before render.
- **SPA routes** behave as a traditional SPA. `beforeLoad`/`loader` run only on the client. No hydration mismatches from missing `localStorage`. Auth guards work correctly without server-side workarounds.
- Layout routes (`__root__`, `_main`) always SSR their components (Nav, Footer), which means those components must be SSR-safe. Since they have no `beforeLoad`/`loader`, this is straightforward.
- Adding a new SSR route requires `ssr: true` on the route and ensuring all parent layout routes also have `ssr: true`.
