# 19. Modals Are URL State in the Store App

**Status:** Accepted

## Context

The storefront's search panel opens over whatever the shopper is reading — the home page, the
PLP, a PDP, the cart. It needed an open/closed state, and the obvious first answer was
`useState` in `Nav`.

Component state makes a modal invisible to the browser. It does not survive a refresh, it
cannot be linked to, and hardware back navigates away from the page instead of closing the
panel — the single most common way a mobile shopper dismisses an overlay.

The admin app already solves this with routes: `products/$id/_detail/edit` renders a
`RouteDrawer`, and closing navigates to the parent. That works because each modal route is a
**child of the one page it covers** — `_detail/route.tsx` renders the entire product detail
page as a layout component, so that page stays mounted and painted behind the drawer.

That structure does not transfer to an overlay with no fixed parent. A route renders *in place
of* the page, not on top of it, so `/search` as a sibling or top-level route would blank out
the page the panel is supposed to be sitting over. On desktop the panel is auto-height, so a
visible strip of the page below it would go empty.

## Decision

Modals that have no natural parent route are **globally defined search params**, declared once
on the root route.

```ts
// src/lib/modal-state.ts
export const MODAL_NAMES = ['menu', 'search'] as const

export const modalSearchSchema = z.object({
  modal: z.enum(MODAL_NAMES).optional().catch(undefined),
})
```

```ts
// src/routes/__root.tsx
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  ssr: true,
  validateSearch: modalSearchSchema,
})
```

Consumers read and write it through one hook:

```ts
const { isOpen, setOpen } = useModal('search')
```

Modals that *do* have a natural parent — a per-resource edit panel, say — should still be
routes. This is the fallback for overlays that are orthogonal to the page beneath them, not a
replacement for route-driven modals.

## Why this works

Search params merge **down** the matched route tree. From `router-core`:

```js
const strictSearch = validateSearch(route.options.validateSearch, { ...parentSearch })
preMatchSearch = { ...parentSearch, ...strictSearch }
```

A child's validated slice is spread *onto* the parent's, never substituted for it. So
`/products` can validate only `{ q }` and still carry `modal` — the root's param survives every
descendant's schema without any route having to know about it. Declaring it once on the root is
genuinely enough.

`loaderDeps` reads the merged search, so a route that returns only its own params from it —
`loaderDeps: ({ search }) => ({ q: search.q })` — will not re-run its loader when a modal opens.
A route that spreads the whole search into `loaderDeps` would refetch on every modal toggle.

## Consequences

- A modal survives refresh, is linkable (`/products?modal=search`), and hardware back closes it.
- Opening pushes a history entry; closing uses `replace`, so the pushed entry is consumed rather
  than left for a forward navigation to re-enter.
- Navigating to a search that omits `modal` closes the panel implicitly. Submitting the search
  form needs no explicit close call — it lands on `/products?q=…`, and that is the close.
- Two modals cannot be open at once. `modal` is an enum, not a flag per modal, which makes that
  unrepresentable rather than merely unlikely. It also does the hand-off for free: the side
  menu's search trigger sets `modal` to `search`, so the menu closes in the same navigation that
  opens the panel, with no coordination between the two components.
- A dismissal can be nothing at all. A nav row inside the menu is a plain `<Link>`; TanStack
  resolves search to `{}` on a navigation that does not ask for it (`if (!dest.search) return {}`),
  so following one drops `modal` and closes the menu without an onClick.
- A modal carrying an argument (a quick-view needing a product id) will need a second param
  alongside `modal`. Not needed yet, deliberately not designed for.
- Every route inherits the param whether it wants it or not. `.catch(undefined)` keeps a
  hand-typed `?modal=nonsense` from erroring the route.

## References

- <https://tanstack.com/blog/search-params-are-state>
- `src/lib/modal-state.ts`, `src/components/header/search-drawer.tsx`,
  `src/components/header/side-menu.tsx`
