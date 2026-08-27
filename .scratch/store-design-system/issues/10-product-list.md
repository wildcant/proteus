# 10 — Product list

The PLP is the last page with no chrome at all. `routes/_main/products/index.tsx` renders a bare
`<main>` around a `<Suspense>` — no heading, no result count, no sort, nothing that says what the
shopper is looking at. The page is a grid and a pager, and the grid is the wrong grid: `gap-x-4
gap-y-10` (16px / 40px) draws eight discrete cards where the reference draws a contact sheet, and
`aspect-3/4` survives in exactly two places — the card (`product-card.tsx:9`) and its skeleton
(`product-list-skeleton.tsx:8`) — and nowhere else in `apps/store/src`, now that
`09-product-detail.md` has moved the gallery and the swatches off it.

Underneath that, `product-card.tsx` and `product-list-skeleton.tsx` are the last two files still
written in the pre-token vocabulary — `bg-(--bg-subtle)` and `text-foreground` where every other
surface says `bg-surface-subtle` and `text-ink`. `04-footer.md` and `09-product-detail.md` each
cleared their own; outside `features/orders` the only other holdouts are `theme-toggle.tsx:75` and
the placeholder home page (`_main/index.tsx:11`), and neither is this ticket's page.

And there are two things wrong that a screenshot cannot show:

1. **The list has no `ORDER BY`.** `StoreProductListParams` carries `order`, the route never sends
   one, and `BaseRepository.findAndCount` adds no default (`base-repository.ts:79` only orders when
   `config.order` is set). Offset pagination over an unordered relation is free to repeat a row on
   page 2 that already appeared on page 1, and to skip another entirely. The pager is not reliable
   today and nothing on the page says so.
2. **The page a shopper is on is not in the URL.** `offset` is `useState` inside `ProductList`
   (`product-list.tsx:12`), so page 3 cannot be linked, does not survive a refresh, and forces the
   `key={q}` remount at `index.tsx:42` to reset itself when the search term changes.

Depends on `01-token-foundation.md`. Shares `ProductGrid` with the header search panel, which
`03-header.md` shipped, so every card change lands there too — which is what that component exists
for.

## The reference

Measured on 2026-08-26 with `getComputedStyle` and `getBoundingClientRect` against the live men's
all-products listing at 390×844, 768×900, 1024×900 and 1440×1000 — not read off a screenshot, so
there is no capture scale to solve for and the numbers below are the computed values themselves.

Desktop, 1440 wide:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ 40                                                                             │
│  mens                          ← 12px, #767a7f                                 │
│  ALL PRODUCTS                  ← 48px / 800 / lh 0.9                           │
│  1066 Products                 ← 12px, #767a7f                                 │
│  Stock up on your workout wardrobe or test a fresh 'fit. Shop…   ← 14px, ink   │
├──────────────────┬─────────────────────────────────────────────────────────────┤
│ filter & sort ✕  │  ┌──────────┐┌──────────┐┌──────────┐┌──────────┐          │
│ ──────────────── │  │  247×309 ││          ││          ││          │  4px gap  │
│ Sort By       ⌄  │  │   4:5    ││          ││          ││          │          │
│  ◉ Price: Low…   │  └──────────┘└──────────┘└──────────┘└──────────┘          │
│  ○ Price: High…  │   Crest Oversized Hoodie          4.1★    ← 14px ink        │
│  ○ Relevancy     │   oversized fit                          ← 14px muted       │
│  ○ Newest        │   Heavy Blue                             ← 14px muted       │
│ ──────────────── │   $46                                    ← 14px / 700       │
│ Product Type  ⌄  │                                          24px row gap       │
│ Size          ⌄  │  ┌──────────┐┌──────────┐┌──────────┐┌──────────┐          │
│ Features · Fit · │  …                                                          │
│ Activity ·       │                                                             │
│ Collection ·     │              ┌──────────────┐                               │
│ Color · pattern  │              │  Load more   │  52px ink                     │
│ Discount · Price │              └──────────────┘                               │
│      320 wide    │                  view all                                   │
│                  │       Viewing 1 - 60 of 1066 products                       │
└──────────────────┴─────────────────────────────────────────────────────────────┘
```

Phone, 390 wide — three structural differences, not a narrower version of the same page:

```
┌──────────────────────────┐
│ ☰  🔍   WORDMARK   👤 🛍  │  ← header, sticky
├──────────────────────────┤
│  mens                    │
│  ALL PRODUCTS            │  ← 32.25px, same 0.9 leading
│  Stock up on your…       │  ← the result count is display:none here
│                          │
├──────────────────────────┤  ← 1px #dee0e3, and the whole bar is
│ sort ⇅   1066 Products   │    position:sticky; top:75px; z-index:5
│              filter ⚙    │    on white
├──────────────────────────┤
│ ┌────────┐  ┌────────┐   │  ← 2 cols × 185, gap 24/4, page gutter 8px
│ │ 185×231│  │        │   │
│ └────────┘  └────────┘   │
│  Title                   │  ← details padding 8px 0 — no side inset
│  fit                     │
│  Colour                  │
│  $46                     │
└──────────────────────────┘
```

1. The filter rail is gone and its two jobs move into a sticky bar: `sort` opens a bottom sheet,
   `filter` opens a full drawer.
2. The result count leaves the page header and lands in the middle of that bar.
3. The page gutter narrows from 40px to 8px, so the contact sheet runs almost to the edge.

### Measured values

| Element | Measured (1440 / 390) | We use |
|---|---|---|
| Page eyebrow | 400, 12px, `#767a7f`, lh 1.3 | `text-sm text-ink-muted` — 14px, not their 12px, matching the store's own eyebrow at `account-detail.tsx:17` |
| Page title | 800, 48px / 32.25px, lh 0.9 | `type-display` — the clamp is an exact match |
| Result count | 400, 12px, `#767a7f`; hidden below `lg` | `text-sm text-ink-muted`, moved into the bar |
| Header rhythm | 24px between every line, 24px above and below the block | `mt-2` after the eyebrow, `mt-6` for the bar |
| Grid | `repeat(4, 247px)`, `gap: 24px 4px` | `grid-cols-2 gap-x-1 gap-y-6 sm:grid-cols-3 lg:grid-cols-4` |
| Grid, 768 | `repeat(3, 248px)`, same gaps | `sm:grid-cols-3` — ours arrives at 640, see Responsive |
| Card image | 247×309 / 185×231 → `4:5`, `object-fit: cover`, radius 0 | `aspect-4/5 object-cover` |
| Card details pad | `16px` / `8px 0px` | `py-2 lg:p-4` |
| Card title | 400, 14px, ink, capitalize | `text-sm text-ink` — no `capitalize`, see the decision |
| Card fit line | 400, 14px, `#767a7f`, `margin-top: 4px` | `mt-1 text-sm text-ink-muted` |
| Card price | **700**, 14px, ink, `margin-top: 16px` | `mt-4 font-bold text-ink` |
| Card badge | `#f4f5f6` on ink, 14px, `padding: 5px 8px` | dropped — nothing to badge |
| Rail section rule | 1px `#dee0e3` | dropped with the rail; the bar keeps `border-y` |
| Sort option row | 44px, label 14px `#767a7f`, 24px left inset | a native `<select>`, see the decision |
| Load more | 52px, `padding 16px 24px`, ink on white, 14px | dropped; the numbered pager stays |
| Page gutter | 40px / 8px | `px-4 sm:px-6 lg:px-8` — unchanged, see the decision |

Three values are worth calling out because they contradict a natural guess.

**The title is the display role, and our clamp is already exactly theirs.** `type-display` is
`clamp(2rem, 1.65rem + 1.5vw, 3rem)` (`styles.css:62`). Solved at each width that resolves to
32.25 / 37.92 / 41.76 / 48px, and the measured `h1` at 390 / 768 / 1024 / 1440 is
32.25 / 37.92 / 41.76 / 48px. All four agree to the hundredth of a pixel. There is nothing to tune,
and this is the PLP `09-product-detail.md:136` meant when it said `ALL PRODUCTS` is where
`type-display` goes — the same ticket established that the PDP `h1` is the *title* role, not this
one (`product-detail.tsx:62`).

**The price is bold.** `$46` is `font-weight: 700` at 14px — their `--fds-type-body-emphasis`. Our
card is `font-semibold` (600) today, which is the one step that makes the price stop reading as the
strongest thing in the card.

**The column gutter is 4px and the row gutter is 24px.** Not a typo and not a rounding of 8. The
near-zero column gap is the entire contact-sheet effect: images almost touch, the page reads as a
sheet of photographs rather than a set of cards, and the 16px inset on the card's text is what stops
two adjacent titles running together. Our card text is flush at 0 today, which is why the current
grid cannot simply have its gutter reduced.

## What we can actually back

Filled by reading `packages/http-schemas/src/store/product/{entities,queries}.ts`, the handler at
`apps/backend/src/api/store/products/route.ts`, its definition at `…/products/definitions.ts`, the
query split in `apps/backend/src/framework/http/apply-middleware.ts`, and the module list under
`apps/backend/src/modules/`. Twenty-four rows below; we can back eight.

| Slot | Us | Why |
|---|---|---|
| Page title | **ship** | static — `All products`, or the term when `?q=` is set |
| Page eyebrow | **ship** | static — `Shop`, or `Search` on a term. Names the section, does not claim data |
| Result count | **ship** | `count` on `StoreProductListResponse`, already returned and already ignored |
| Card image | **ship** | `product.thumbnail`, nullable, with the `PackageIcon` fallback that ships today |
| Card title | **ship** | `product.title` |
| Card fit line | **ship**, when present | `product.subtitle` is on `StoreProduct` and therefore on `StoreProductListItem`. Nullable — omitted, not stubbed |
| Card price | **ship, reworded** | `startingPrice.calculatedAmount`; see the decision — it is a *starting* price and the card does not say so |
| Sort | **ship, three options** | `order` is on `createFindParams()`, survives `applyMiddleware` into `pagination.order`, and `BaseRepository.find` maps it onto real columns. `title` and `createdAt` are both real columns on `productTable` |
| Sort: Price low→high / high→low | dropped | `startingPrice` is computed in the route *after* `listAndCountProducts` has already paged (`route.ts:24` then `:36`). Sorting by it would order one page against itself |
| Sort: Relevancy | dropped | `q` becomes `$ilike '%token%'` in `buildSearchFilter`; there is no score to rank by |
| Filter: Product Type, Collection, Activity, Features, Fit, pattern | dropped | there is no taxonomy. `modules/product/models/` is product, image, option, option-value, variant and their links — no category, no collection, no tag |
| Filter: Size, Color | dropped | option values exist per product, but `StoreProductListParams` is `createFindParams().extend({ q })` — nothing else is accepted — and `StoreProductListItem` carries no options to filter against client-side |
| Filter: Price | dropped | same reason as price sorting, plus no range params |
| Filter: Discount | dropped | `StoreCalculatedPrice` carries a literal `TODO(pricing): add originalAmount when PriceRule/PriceList is implemented`. There is no second amount, so nothing is discounted |
| Card hover image | **blocked** — see below | the list item has only `thumbnail`; the route never loads `images` |
| Card colour name | dropped | the list payload has no variants and no options |
| Card rating | dropped | no review module |
| Card wishlist heart | dropped | no customer favourites table, same finding as `09-product-detail.md` |
| Card quick-add | dropped | needs a variant to add, and the list payload has none. The PDP is one tap away |
| Card badges (`New`, `Best Seller`) | dropped | `StoreProduct` carries no timestamps at all, so the client cannot even compute newness, and there is no merchandising flag |
| Collection description | dropped | `/products` is not a collection; there is no content model behind a paragraph |
| `top 10 in category` rail | dropped | no order aggregate. Same finding as `search-best-sellers.tsx`'s `TODO(product-groups)` |
| Grid density toggle (list / single / grid) | deferred | needs no backend and is a real affordance, but it is a feature, not a redesign |
| `Load more` / `view all` | dropped | see the pagination decision |

One row is worth naming as the opposite of a subtraction: **the fit line is data we already ship
and have never rendered.** `product.subtitle` reaches the card today and is thrown away, and
`09-product-detail.md` puts it under the PDP title as the fit subtitle. Rendering it here is what
makes the PLP card and the PDP heading say the same thing about the same garment.

## Decisions

**The filter rail is dropped entirely, and no shell is left behind.** Ten filter groups — the rail's
eleventh section is `Sort By`, which is the one job in it that survives (`reference.md:91`) — and we
can back zero of the ten. The rejected alternative was an empty rail carrying only `Sort By` against
the day a taxonomy arrives: 320px of desktop width — a quarter of the page — spent on one control,
plus a `filter` button on the phone that opens a drawer with nothing in it. The sort control moves
into a bar under the page header instead, which is where the phone already puts it.

**Sort is a native `<select>`, not the reference's accordion-plus-bottom-sheet pair.** The
reference builds the control twice — a radio group inside a rail accordion above `lg`, a bottom
sheet below — because that machinery has to host ten filter groups as well. With one control that
is two implementations of a `<select>`. A native select needs no modal state, and on a phone the
platform renders it as exactly the bottom sheet the reference hand-builds. Rejected: a `Popover`
with radios, which would be the first popover on a storefront page and would still need a phone
variant.

**And it is our own `<select>`, not `@proteus/ui`'s `NativeSelect`.** That primitive puts
`className` on its *wrapper* (`native-select.tsx:12`) and hardcodes the control itself at
`h-8 rounded-lg border-input pr-8 pl-2.5` with a `ring-3` focus ring (`:19`), and its chevron
centres on the wrapper rather than the control. None of that is reachable from a class, and none of
it is this system — a 32px control misses the 44px thumb target the pager already sets as the floor
(`pagination.tsx:28`). The store has already been here once: `components/form/select.tsx:15` writes
its own `<select>` and says why in a comment — "styling the control would take eight
`**:data-[slot=native-select]:` selectors". The one existing `NativeSelect` callsite
(`variant-picker.tsx:208`) passes only `w-full rounded-none`, so it has never exercised height and
is not evidence the primitive fits.

`product-sort.tsx` follows `FloatingLabelSelect`'s shape — `appearance-none`, our own
`ChevronDownIcon` absolutely positioned, tokens throughout — minus the floating label and the 56px
box, because this is a bar control, not a form field. Rejected: `**:data-[slot=native-select]:h-11`
on the wrapper, which is the eight-selector workaround that comment already rejected once.

**Sort ships as `newest` / `az` / `za`, and `newest` is the default.** These are the three the
catalogue can actually order by. The reference's own four are two price orders we cannot do and a
relevancy score we do not compute; shipping `Price: Low to High` against a post-pagination price
would sort each page against itself and produce a list that is wrong in a way a shopper would not
be able to see. Rejected: an `Oldest` option to round the list out to four — it is a real order and
nobody has ever wanted it.

**The URL carries `sort` as a friendly enum, not the API's `order` string.** `?sort=za` validated by
`z.enum(['newest','az','za']).optional().catch(undefined)`, mapped to `order` at the query layer.
The rejected alternative — putting `?order=-title,id` straight in the address bar — leaks database
column names into a shareable URL and makes the param unvalidatable, since `parseOrder` accepts any
string and `BaseRepository.find` silently discards column names it does not recognise
(`base-repository.ts:81`). An unknown `order` is not a 400; it is an unordered list. An enum makes
that unrepresentable.

The default is *absent* from the URL, not written into it. `/products` and `/products?q=tee` stay
exactly those strings — which `header.spec.ts:117` and `:131` assert on with `toHaveURL`, and which
`search-form.tsx:46` produces by replacing the whole search object.

**`order` gains a tiebreaker, and that needs a six-line backend change.** `parseOrder`
(`core/utils/validate-query.ts:18`) returns a single-key object, so only one column can be ordered
on. Sorting by `createdAt` alone does not fix the pager, because `timestamps` defaults to
`now()` (`core/db/columns.ts:5`) and `createMany` inserts every row in one statement
(`base-repository.ts:174`) — Postgres `now()` is transaction time, so a whole seeded catalogue
shares one `createdAt` to the microsecond and `ORDER BY created_at DESC` is exactly as unstable as
no order at all.

So `parseOrder` learns comma-separated columns and the store sends `-createdAt,id`. `find()` already
handles it — `Object.entries(config.order).map(...)` then `orderBy(...clauses)` — and object key
order is preserved for string keys, so the clauses come out in the written order. The change is
backward compatible: every existing caller sends one column and gets the same single-key object
back. Rejected: a hardcoded default order inside the store route, which fixes this page and leaves
`/admin/products` and every other list endpoint with the same latent bug.

**`offset` becomes URL state, and the loader learns about it.** State that *can* live in a URL
should; `useState` is the exception that has to argue for itself, and a page number cannot. Page 3
becomes linkable, survives a refresh, and the `key={q}` remount at `index.tsx:42` goes away — a new
`q` no longer needs to destroy the component to reset its page, because `search-form.tsx:46`
already replaces the whole search object and drops `offset` with it. That remount is what
component-local state costs: a hack whose only job was resetting something that had no business
being local.

`docs/adr/0019-modals-are-url-state.md` argues this for modals; the rule is broader than that ADR,
and pagination and sort are the same claim — they describe what the shopper is looking at, so they
belong in the address bar with everything else that does.

The loader has to move with it: it hardcodes `PRODUCTS_DEFAULT_OFFSET` today, so on a cold hit to
`/products?offset=24` it would prime page 1 into the cache while the component asks for page 3, and
the SSR'd markup would be a page the shopper did not ask for. `loaderDeps` takes `q`, `sort` and
`offset`, and the loader passes all three. This is the part that generalises: a param that is not
in `loaderDeps` is a param the server renders the wrong value for.

The pager keeps its `onOffsetChange` callback API rather than becoming links, so
`orders-panel.tsx:8` — the other callsite — is untouched by this ticket. That has a cost, recorded
below.

**Paging and sorting no longer suspend, and that needs a pending state instead.** Once `offset` and
`sort` are `loaderDeps`, the loader awaits `ensureQueryData` before the navigation commits, so
`useSuspenseQuery` finds the data already in cache and `ProductListSkeleton` stops firing on
anything but a cold entry. The grid simply keeps showing the previous page until the next one lands,
with nothing on screen saying so — which on a slow connection is a Next button that appears not to
work. `useRouterState({ select: (state) => state.isLoading })` drives `aria-busy` and a 60% opacity
on the grid. This is the store's first use of router pending state; nothing else in
`apps/store/src` reads it.

**The price line reads `From $46`.** `buildStartingPrices` picks the *cheapest* variant price per
product — its own doc comment says "for `from $X` display on the storefront grid" — and the card
renders it bare today. On a product whose sizes run $46 to $60 that is a price no shopper can buy at
without knowing which one. `From` is true for every product; it is only verbose when every variant
happens to cost the same, which the payload gives us no way to know. Rejected: keeping it bare and
accepting the divergence, which is the one thing the "never ship UI with nothing behind it" rule
exists to stop — the label overclaims by exactly one word. Widening `startingPrice` to a
`{ min, max }` range so the card can drop `From` when they are equal is a backend follow-up,
recorded below.

**The card title keeps its own case.** The reference sets `text-transform: capitalize` on the card
title, which is a display decision about a catalogue whose titles are entered in whatever case the
merchant typed. Capitalising ours would rewrite `iPhone case` and `V-neck` on screen and make the
card title differ from the PDP `h1` for the same product. Rejected with no real regret.

**The page keeps its gutters; the grid does not bleed.** The reference drops to an 8px gutter below
`lg` so the sheet runs almost to the edge. Every store page ships
`mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8`, and breaking that on one page means the
PLP's title sits at a different left edge from the PDP's breadcrumb, the account heading and the
footer. The contact-sheet effect comes from the 4px *column* gap, not from the page gutter, and that
survives at any inset. Rejected: `-mx-4` on the grid alone, which bleeds the images and leaves the
card text aligned to nothing.

**The bar is sticky at every width, not just below `lg`.** The reference makes it sticky only on the
phone, because above `lg` its jobs live in a rail. One node with one behaviour is the simpler thing
and `spec.md` already sets the rule against structural switching across breakpoints. It sits at
`top-14 lg:top-20`, which is the header's own `h-14 lg:h-20` (`header.tsx:22`), and at `z-40`,
under the header's `z-50`. `position: sticky` under `body { overflow-x: hidden }` is a documented
trap, but the header itself is `sticky top-0` and ships, so the precedent is a file away.

**The empty state replaces the grid rather than following it.** Today `product-list.tsx:18`
renders `<ProductGrid>` and then, separately, the "No products found" line — so an empty result set
paints an empty grid element above the message. It becomes one branch or the other, and the copy
splits: a search that matched nothing says so with the term in it, borrowing the exact phrasing
`search-results.tsx:40` already uses, and an empty catalogue does not pretend a search happened.

## Work

- **`apps/backend/src/core/utils/validate-query.ts`** — `parseOrder` splits on `,` and folds each
  segment into one object, honouring a leading `-` per segment: `-createdAt,id` →
  `{ createdAt: 'DESC', id: 'ASC' }`. A single column produces exactly what it produces today.
  Empty segments are skipped so a trailing comma is not a column named `''`.
- **`apps/backend/src/api/store/products/__tests__/`** — one test that two pages of a catalogue
  whose rows share a `createdAt` return disjoint sets. Seed enough products in one
  `createProducts` call that they collide on the microsecond — which they will, by construction —
  then assert `page1.ids ∩ page2.ids` is empty with `order=-createdAt,id`. Invoke the
  `backend-test` skill before writing it.
- **`features/products/api/products.ts`** — `PRODUCT_SORT_NAMES` as `['newest', 'az', 'za'] as const`,
  a `PRODUCT_SORTS` map from those names to the API string (`newest → '-createdAt,id'`,
  `az → 'title,id'`, `za → '-title,id'`) and `ProductSort` as `(typeof PRODUCT_SORT_NAMES)[number]`.
  All three exported from here — the route's `z.enum` reads the tuple, so the enum and the query
  layer cannot drift. `productsListQueryOptions` is unchanged — it already takes `order` through
  `ListStoreProductsParams`.
- **`routes/_main/products/index.tsx`** — `productsSearchSchema` gains `sort` and `offset`. `sort`
  is `z.enum(PRODUCT_SORT_NAMES).optional().catch(undefined)`; `offset` is
  `z.coerce.number().int().min(0).optional().catch(undefined)` — `.catch` on both, matching the
  `q` comment at `:14`, so a hand-typed value degrades rather than erroring the route.
  `loaderDeps` returns all three and the loader passes them to `ensureQueryData`. The `key={q}`
  remount goes.
- **`features/products/components/product-list.tsx`** — `useState` goes. Reads `sort` and `offset`
  from the route, writes them with `navigate({ search: (prev) => ... })`, and resets `offset` to
  `undefined` whenever `sort` changes — a shopper on page 5 of `newest` has no page 5 in mind when
  they pick `az`. Page 1 is written as `undefined` rather than `offset=0`, so the default stays
  absent from the URL the way `sort`'s does. Renders the grid or the empty state, and the pager —
  not the header, see below. Reads `useRouterState` for the pending opacity.
- **`features/products/components/product-list-header.tsx`** *(new)* — eyebrow, title and the
  sticky bar, rendered by `index.tsx` **outside** the `<Suspense>` boundary. Only the result count
  needs the query, so only the count suspends, inside a boundary of its own with a
  `h-4 w-24 bg-surface-subtle` placeholder; it reads the same query key as the grid, so the two
  resolve from one request. `orders-panel.tsx:20` sets this split and says why in its own comment —
  "the panel chrome renders straight away and only the list suspends, so paging does not blank the
  heading". The same applies here twice over: the title and the sort control need no data, and a
  sort control that vanishes while the sort you just picked is loading is the worst moment for it
  to go.

  The eyebrow/title pair is written inline with the same two classes `account-detail.tsx:17` uses
  rather than extracted — that would be two callsites, and the third is what makes a `PageHeading`
  component worth having.
- **`features/products/components/product-sort.tsx`** *(new)* — a native `<select>` built the way
  `components/form/select.tsx` builds one (`appearance-none`, own chevron, `text-base md:text-sm`
  so iOS does not zoom on focus), at `h-11` with no border — the bar's own rules are the only ones
  the page needs. An `sr-only` `<label htmlFor>` reading `Sort by`, and the three options. Reads
  the route's `sort`, showing `newest` when the param is absent, and writes through the callback
  `ProductList` passes in; it owns no state and no navigation of its own.
- **`features/products/components/product-grid.tsx`** — gutters to `gap-x-1 gap-y-6`. The column
  ladder is unchanged; the doc comment's "the cards are 3:4" is now false and becomes 4:5. The
  grid classes stay inline and the skeleton keeps its own copy of them: nothing in `apps/store/src`
  or `packages/ui/src` exports a class-string constant, and `product-detail-skeleton.tsx` — written
  one ticket ago — hand-mirrors the gallery's `grid gap-1 lg:grid-cols-2` for exactly this reason.
  Inventing the pattern for one callsite is a worse trade than the drift risk, which is two lines
  apart in the same directory.
- **`features/products/components/product-card.tsx`** — `aspect-3/4` → `aspect-4/5`;
  `bg-(--bg-subtle)` → `bg-surface-subtle`; `text-foreground` → `text-ink`; the fallback's
  `text-border` → `text-line`. Adds the subtitle line between title and price, rendered only when
  `product.subtitle` is set. Price becomes `font-bold` with the `From ` prefix. Details get
  `py-2 lg:p-4`. `width`/`height` on the `<img>` go from `600×800` to `600×750` so the intrinsic
  ratio matches the box and the browser reserves the right space before the image lands.
- **`features/products/components/product-list-skeleton.tsx`** — the grid classes track
  `ProductGrid`'s; `aspect-3/4` → `aspect-4/5`; `bg-(--bg-subtle)` → `bg-surface-subtle`; the
  `rounded` classes go (`--radius: 0` makes them inert, and `product-detail-skeleton.tsx` already
  omits them). It stays *only* the grid — no header shapes, because the header does not suspend.
- **`features/products/components/product-empty.tsx`** *(new)* — the two-branch empty state. A
  `q`-less catalogue says `No products yet.`; a search says `No products match “term”.` and offers
  a link back to `/products` to clear it.
- **`components/pagination.tsx`** — tokens only. It is already `text-ink-muted` / `hover:text-ink`
  and already returns `null` on one page; no API change, so `orders-panel.tsx` is untouched.

## Responsive

Written phone-first: the base classes are the phone and `sm:` / `lg:` only add.

**Base (phone).** Eyebrow, then title, then the sticky bar, then a 2-up grid. The bar is
`sticky top-14 z-40 border-line border-y bg-surface`, holding the count on the left and the sort
select on the right — the reference's own split, minus the filter button it has nothing to open.
Card details take `py-2` and no horizontal inset, so a 185px card gives its title the full width;
at a 4px column gutter that leaves 4px between two adjacent titles, which is why the reference does
the same thing rather than insetting on the phone.

**`sm:` and up.** Three columns. Ours arrives at 640 where the reference's arrives at 768 — that is
existing behaviour and it stays, because `ProductGrid` is shared with the search panel and
`SEARCH_RESULTS_LIMIT` is 4 with a comment (`components/header/constants.ts:12`) saying four fills one row above `lg`
and two on a phone. Moving the ladder to the reference's `md:` / `xl:` would leave the panel showing
3 + 1 orphan between 1024 and 1279. The gutters and the card are what this ticket changes; the
column counts stay where `03-header.md` left them.

**`lg:` and up.** Four columns, and the card's details take their full `p-4` inset. The bar's sticky
offset moves to `top-20` with the header. Nothing else changes: the page keeps one column, because
the second column the reference has is the rail we are not shipping.

The select is `h-11` at every width — the 44px target `pagination.tsx:28` already sets as the floor
for a thumb, and the reason the bar cannot use `@proteus/ui`'s `NativeSelect`.

## States the reference cannot show you

- **Cold entry.** `ssr: true` with `await ensureQueryData` in the loader, so a direct hit arrives
  with the products in the markup and `ProductListSkeleton` never paints. It fires on a client
  navigation into `/products` from the header or the PDP breadcrumb, where the cache is empty. The
  skeleton stays grid-only: the header, the bar and the sort control are outside the boundary, so
  they are already on screen and there is nothing for the skeleton to stand in for. The count is
  the one thing missing, and it has its own placeholder.
- **Deep entry.** `/products?q=tee&sort=za&offset=24` is now a real address and is SSR'd at that
  exact page. This is the reason `loaderDeps` has to carry all three: with the offset missing from
  the deps, the server renders page 1 into markup the client immediately replaces.
- **In flight.** Covered by the pending decision above: the grid dims to 60% and takes `aria-busy`
  while the router is loading. The select is *not* disabled — disabling the control you just used
  moves focus to the body and a keyboard shopper loses their place.
- **Sort changed while deep in the list.** `offset` resets to `undefined`, so the new order starts
  at page 1. `scrollRestoration: true` (`router.tsx:12`) treats the new search as a new location and
  scrolls to the top, which is the right behaviour for both this and paging.
- **Empty.** Two branches, distinct from loading because loading is the skeleton and this is prose.
  Covered by the empty-state decision above.
- **A product with no thumbnail.** `PackageIcon` in a `bg-surface-subtle` box, which is what ships
  today and is unchanged apart from the token. The 4:5 box means the placeholder is the same shape
  as the photographs beside it.
- **A product with no `startingPrice`.** Already handled — `product-card.tsx:27` guards with
  `!!product.startingPrice`, and the line is omitted rather than showing a zero. A variant with no
  price set is invisible to `buildStartingPrices`, so this is reachable with real data.
- **Overflow: long titles.** They wrap, and nothing is clamped. CSS grid gives every card in a row
  the row's height, so a three-line title lengthens that row and leaves the rest of the sheet
  aligned. Rejected: `line-clamp-2`, which hides the end of a product's name in the one place a
  shopper is scanning names.
- **Failure.** Unchanged, and deliberately not invented here: a rejected fetch throws out of the
  loader to the router's default error component, because no route in `apps/store/src/routes`
  except `_auth/verify.tsx:35` declares an `errorComponent`. A storefront-wide error boundary is
  its own ticket.

## Blocked, and tracked elsewhere

**The hover image swap.** The reference stacks two `<img>` absolutely and cross-fades on hover —
the single most useful thing on its card, because it shows the garment on a body and off it without
a click. `StoreProductListItem` carries only `thumbnail`; the list route never touches
`product_image` at all. Backing it means adding a second image URL to the list response, which is
one extra query in `route.ts` beside the variants and prices it already loads. Recorded here rather
than folded in, because it changes a response shape three surfaces read.

**`startingPrice` → a price range.** The `From ` prefix is a correct hedge, not a good label. A
`{ min, max }` on the list item would let the card drop the prefix when they are equal and show a
range when they are not. `buildStartingPrices` already walks every variant price; it would track a
maximum in the same loop.

**The grid classes are duplicated between `ProductGrid` and its skeleton**, deliberately, for the
reason in Work — and so are the gallery's between `ProductGallery` and `ProductDetailSkeleton`.
Two instances is where a shared-class-constant convention would be worth establishing on purpose,
across both, rather than invented here for one.

**A crawlable pager, and the account page's own `useState` offset.** The controls stay `<button>`s
so `orders-panel.tsx` is not dragged into this ticket, which means pages 2+ are not `<a>` elements:
no middle-click, no preload on intent despite `defaultPreload: 'intent'`, and nothing for a crawler
to follow on an SSR'd route.

These are one follow-up, not two. `orders-panel.tsx:35` holds its `offset` in `useState` for the
same reason the PLP did, and by the rule above that is a defect and not a style choice — page 2 of
your order history is not linkable and does not survive a refresh either. Converting `Pagination`
to render links has to convert both callsites together, and the account route needs its own
`offset` search param before it can. Worth doing in one pass rather than leaving the store with two
pagers that disagree about where a page number lives.

**The grid density toggle.** Deferred, not dropped. It needs no backend, and a single-column phone
view is a real affordance for judging a garment. It is a feature.

## Constraint

**Must keep working.**

- `products.spec.ts:201` — `page.getByText(product.title)` after `navigate({ to: '/products' })`.
  The title stays a text node in the card. The factory *does* set `subtitle`
  (`tests/factories/db/product.ts:12`) and seeds no variants, so this test covers the fit line's
  present branch and the price's null branch — the subtitle-absent branch is uncovered, and the
  subtitle is a `faker.commerce.productAdjective()` that never contains the full title, so
  `getByText(product.title)` stays a single match.
- `header.spec.ts:117` — `toHaveURL('/products?modal=search')`. The `modal` param merges from
  `__root__` and neither `sort` nor `offset` is written unless set, so the string is unchanged.
- `header.spec.ts:131` — `toHaveURL('/products?q=${matchTerm}')` after "View all". This is the
  assertion the "default is absent from the URL" decision exists to protect. If `sort` is ever
  given a zod `.default('newest')` instead of `.optional()`, this test fails, and it should — the
  failure is the design rule being enforced.
- `header.spec.ts:133` — `page.getByText(match.title)` must stay a single match on the PLP. The
  card gains a subtitle line, not a second copy of the title.
- `cart.spec.ts:189` — `navigate({ to: '/products', search: { modal: 'cart' } })`. Typed against
  the route's search schema, so both new params must be optional or this stops typechecking.

**Legitimately breaks.**

- Nothing in the current suite asserts on the grid's classes, the card's ratio, the empty state or
  the pager, so no existing assertion breaks. That is itself the finding: the PLP has one e2e test
  and it checks that a product appears.

**Worth adding** to `products.spec.ts` — one spec per feature, so these land beside the existing PLP
test rather than in a new file — because each is a piece of this ticket with logic in it that nothing
else covers:

1. Sort round-trips. Seed two products whose titles sort unambiguously, select `Z–A`, assert the
   URL becomes `/products?sort=za` and the first card in the grid is the later title. Select by
   the accessible name `Sort by`, and assert against the factory's own titles — never `.first()`
   on an unscoped locator, per the rule in `CLAUDE.md`.
2. Paging round-trips. Seed enough products to cross `PRODUCTS_DEFAULT_LIMIT`, click Next, assert
   the URL carries `offset=12` and that a reload lands on the same page. This is the test that
   would have caught the missing `ORDER BY`, so it should also assert the two pages share no
   titles.
3. The empty state. `?q=` a random string that matches nothing and assert the search phrasing,
   including the term. Parallel specs seed products constantly, so the term has to be
   `faker.string.alpha({ length: 10 })` for the same reason `header.spec.ts:106` uses one.
