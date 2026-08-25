# 03 — Header

**Status:** shipped, bar less one placeholder. The bar, the side menu and the search panel are
built and wired; `Best sellers` is live under a heading it does not yet earn. See *What's left*.

The nav was the last piece of chrome wearing pre-foundation styling: hardcoded
`bg-white dark:bg-neutral-950` and `border-border` instead of the tokens, and a wordmark at
`text-sm uppercase tracking-[0.2em]` — a micro-label doing a display job, exactly the pattern `02`
removed from the login heading.

Depends on `01-token-foundation.md`. Absorbs the former `06-search-page.md`: the panel is header
chrome and splitting it across two tickets meant every decision was recorded twice.

## The reference

**The bar** — left rail of category links · centred wordmark · right cluster of search and icons.

```
 Women  Men  Accessories            WORDMARK              ⌕ What are you looking for tod…   ♡  ⌂  🛍²
```

Bar ~96px tall on desktop, hairline bottom border, no hamburger at any desktop width. Rail links
14px medium, ~32px apart, flush with the container's left edge. Wordmark in the display face,
uppercase, ~24px, optically centred on the viewport rather than between the two flanks. Search is a
*filled* control — `#f4f5f6`, **no border**, ~44px, inline-start magnifier, muted placeholder —
which is why it reads as a utility beside the icons instead of as a form field. Bag count is a
filled circle in the accent blue; it is the only hue in the bar.

**The panel** — drops from the top over whatever the shopper was reading. Empty state left,
results state right:

```
 ←  ⌕ What are you looking for today?   ✕     ←  ⌕ shirt ✕                    ✕

 TRENDING SEARCHES   BEST SELLERS    View All   SUGGESTIONS   PRODUCTS
   Cottonmove        ┌────┐ ┌────┐                Compression   ┌────┐ ┌────┐
   Cosy Luxe         └────┘ └────┘                T Shirt       └────┘ └────┘
   Devant            ★4.5 …  ★4.6 …               Oversized …   Crest …  Running …
                                                                    View all "Shirt"
```

Field ~18–20px from the panel's top edge at both widths. The product grid is the same
contact-sheet card the PLP uses — two-up on a phone, four across on desktop. `View All` sits beside
the heading in the empty state and below the grid in the results state.

## Decisions

**The left rail ships with the links we have.** There is no collection or category taxonomy in the
backend — `apps/backend/src/modules/` has no such module, and `StoreProductListParams` exposes only
`q` and the find params. "Women / Men / Accessories" has nothing behind it. The rail renders from a
static array (`Shop all` → `/products`) laid out to take N entries, so a later categories ticket
fills it without touching the header. A rail with one real destination is honest; three fake ones
are not.

**No wishlist icon.** There is no wishlist feature and no `customer` field to hang one on. An icon
that does nothing is worse than a gap in the cluster. Same reasoning removed the heart from the
side menu's header row.

**The bar is a three-column grid.** `grid-cols-[1fr_auto_1fr]` with the right cluster
`justify-self-end`. The wordmark was `absolute left-1/2` inside a flex row, which only worked while
both flanks were narrow; with a rail on one side and a 280px control on the other it would overlap
them.

**`--accent` enters the token layer here, and the badge is its first consumer.** The count sits in a
cluster of ink-coloured icons; an ink badge disappears into them. `--accent: #004eba` (their
`--fds-color-text-accent`) with a lifted `#7aa9ff` dark counterpart, paired with **`text-surface`,
not `text-white`** — the token inverts per scheme, so the numerals stay dark-on-light-blue in dark
mode where white would fall under 4.5:1.

It shadows shadcn's own `--accent`, a near-white hover surface paired with a near-black
`--accent-foreground`. Only `DropdownMenu` and `Combobox` consume that pair and the store renders
neither, so the names coexist — but the first store screen to import one of those needs
`--accent-foreground` repointed too. Documented at the token.

**The hamburger goes away above `lg`.** The reference has no desktop hamburger, and once the rail
exists the menu is duplicate navigation. Below `lg` the hamburger stays and the rail hides.

**Search is a panel, not a page.** A route renders *in place of* the page; this panel renders *on
top of* one. Admin's route-driven modals work because each is a child of the single page it covers
(`_detail/edit` under `_detail`), and search has no such parent — it opens over the home page, the
PLP, a PDP, the cart. A `/search` route shipped first and was removed: on desktop the panel is
auto-height, so the strip of viewport below it would have gone blank.

**Both overlays are the same primitive.** `Drawer` from `@proteus/ui` — `swipeDirection="up"` for
search, `"left"` for the menu. Swipe-to-dismiss comes free and the two animate identically.

**Modals are URL state.** `?modal=menu` / `?modal=search`, declared once on `__root__`. Full
reasoning in `docs/adr/0019-modals-are-url-state.md`. It removed more plumbing than it added: the
side menu takes no props, the header holds no state, a nav row is a plain `<Link>` that closes the
menu by dropping the param, and the menu's search trigger swaps `modal` in a single navigation so
one closes exactly as the other opens.

**The bar's search control is a button, not an input.** There is exactly one `<input>` in the app
and it lives in the panel, so there is no second field's value to keep in sync. Both wear the same
treatment through `SearchControl`, which swaps its element via base-ui's public `useRender`.

**Mobile dismisses the panel with a back chevron, desktop with an `✕`.** They carry different
labels — `Back` and `Close search` — because both are in the DOM at all times with only one
visible, and a shared label would make `getByLabel` ambiguous at either width.

## What shipped

**Tokens** — `--accent` on `:root` and both dark blocks, registered as `--color-accent`.

**`components/header/`** — the whole of the bar and its overlays:

| file | what |
|---|---|
| `header.tsx` | the grid, hamburger, composition. Renders `<header>`; no state left in it |
| `nav.tsx` | the rail, and the only `<nav>` landmark — the bar itself is a `<div>` |
| `wordmark.tsx` | `Proteus` at `type-heading`, shared with the checkout bar |
| `side-menu.tsx` | left drawer, full width, `?modal=menu`, label-plus-chevron rows |
| `search-triggers.tsx` | `SearchBarTrigger` (≥`lg`) and `SearchIconTrigger` (<`lg`), both self-opening |
| `search-control.tsx` | the filled treatment, element-agnostic via `useRender` |
| `search-form.tsx` | the one real input. Controlled; clear button; native WebKit clear suppressed |
| `search-drawer.tsx` | the panel. `swipeDirection="up"`, `100dvh` below `lg` |
| `search-results.tsx` | matches for a term, falling through to the empty state |
| `search-best-sellers.tsx` | the empty state |
| `constants.ts` | `SEARCH_PLACEHOLDER`, `SEARCH_RESULTS_LIMIT`, `SEARCH_DEBOUNCE_MS` |

**Elsewhere** — `lib/modal-state.ts` (`MODAL_NAMES`, root schema, `useModal`);
`hooks/use-debounce.ts` + `use-timeout-fn.ts`; `features/products/components/product-grid.tsx`
extracted from `ProductList` so the PLP and the panel cannot drift on columns or card treatment;
`useProducts`, the non-suspending sibling of `useSuspenseProducts` with `keepPreviousData`, because
a suspending read blanks its boundary on every keystroke; `routes/_checkout/route.tsx` on the
shared `Wordmark` and the tokens; `packages/ui` re-exports `useRender` so the store takes no direct
`@base-ui/react` dependency.

**Search wiring** — `/products` validates `{ q }`, `loaderDeps` on `q` only (so opening a modal does
not re-run the loader), and `ProductList` takes `q` with the route mounting it under `key={q}` so a
new term resets pagination without an effect. Typing in the panel queries live, debounced, and
`View all` hands off to the PLP.

## What's left

**`Best sellers` is a placeholder, by decision.** The heading is live; the ranking is not. The row
renders whatever `GET /store/products` returns first, capped at `SEARCH_RESULTS_LIMIT`. Carries a
`TODO(product-groups)`. Two routes out, the second likelier:

1. **The aggregate.** A read model over `order_line_item`, and `order` on the store endpoint gains
   something to sort by. Real ranking, real cost.
2. **Product groups.** A curated group a merchandiser fills — which is what the reference is
   actually running in that slot; its row is merchandised, not computed. Cheaper, and it gives the
   nav rail and the PLP the same thing they are missing.

Either way it renders through `ProductGrid` exactly as today; only the query and the heading change.

**Trending searches** has no source. There is no search-term log — `q` goes into
`buildSearchFilter` and is never recorded — and no taxonomy to fall back on. Either a static
curated array, same shape as `railLinks`, or a `search_term` table with a count. The static array
is what would ship here; the table is its own backend ticket and probably wants the event bus
`.tasks/next-todos` already has queued.

**Recent searches** is the cheapest of the three and the reference does not show it in this state —
`localStorage`, capped, cleared from the same screen. Guard the read with
`typeof localStorage !== 'undefined'`.

**The e2e specs have never been run.** They were rewritten across this ticket — drawer selectors,
URL assertions, the `header nav` → `header` rescope — and `npm run verify` does not cover them.
Run `npx -w store playwright test` before this branch merges.

## Decisions still open

**Whether the panel pages its own results.** It shows the first `SEARCH_RESULTS_LIMIT` and hands
off to the PLP for the rest, which is what the reference does. If search becomes the main way
people browse, that hand-off is the thing to revisit.

**Whether the panel's empty state should cost a query.** It fires a products request every time it
opens, where before it opened onto nothing. Cheap — `limit: 4`, only while mounted — but it is new
traffic on every tap of the magnifier.

## Out of scope

Search suggestions / typeahead — the reference's `SUGGESTIONS` column has no source. Result count,
"no results for …" copy and the filter rail are the PLP pass; the panel has its own no-match line.
A categories taxonomy is its own ticket, and the rail is built to receive it.

## Constraint

`cart.spec.ts` and `products.spec.ts` bind to the header. Current, accurate state:

- The badge is `header [aria-label="Cart"] span`. It was `header nav [...]` until `<nav>` shrank to
  the rail; anything scoped to the bar now scopes to `header`.
- Two elements answer to `aria-label="Cart"` (the `sm:hidden` link and the desktop trigger), which
  is what forces `.last()`. Do not add a third.
- The magnifier is `aria-label="Search"`, asserted with `exact: true` — the bar button and the
  panel input both carry `Search products`, which a substring match would also pick up.
- Both overlays are `[data-slot="drawer-popup"]`. `modal` is an enum, so only one is ever mounted
  and the shared selector stays unambiguous.
- The checkout layout's "no nav" assertion is `getByLabel('Cart')).toHaveCount(0)`. The old
  `Open menu` assertion went vacuous at desktop width once the hamburger became mobile-only.
